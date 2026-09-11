import admin from 'firebase-admin';
import { correoConfigurado, enviarCorreos } from './_correo.js';

/**
 * Tarea diaria de UDECA (Vercel Cron).
 *
 * Resuelve dos cosas que la app SOLA no puede: hasta ahora, las métricas del
 * grupo y los avisos dependían de que el propio alumno abriera la app. Si no
 * entraba, su ficha se quedaba congelada y no le llegaba ningún recordatorio.
 *
 * Cada día:
 *  1. Recalcula las métricas públicas (socialStats) de cada alumno desde sus
 *     entrenamientos, para que el entrenador vea el grupo al día aunque nadie
 *     haya abierto la app.
 *  2. Avisa por push a quien lleva días sin entrenar.
 *  3. Avisa por push de la cuota vencida o a punto de vencer.
 *  4. Avisa de que el año pagado se acaba, ANTES de que se acabe.
 *
 * Variables de entorno: FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de
 * servicio) y CRON_SECRET (lo envía Vercel como Authorization: Bearer …).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Días sin entrenar a partir de los cuales se envía el toque de atención. */
const INACTIVE_DAYS = 5;
/** Días de antelación con los que se recuerda la cuota. */
const PAYMENT_DUE_DAYS = 3;
/**
 * Cuándo se avisa de que se acaba el acceso: dos semanas antes, a tres días y
 * el último día.
 *
 * Existe porque la app lo promete por escrito, y hasta ahora no se hacía:
 * quien entraba el día después se encontraba el muro de pago sin previo aviso.
 * Enterarse así, aunque el precio sea justo, es lo que convierte a alguien que
 * iba a renovar en alguien que se va.
 *
 * Los catorce días son del modelo nuevo: lo que vence es un AÑO pagado, no una
 * prueba de cuatro semanas, y una renovación anual merece verse venir con
 * tiempo de sobra para decidirla sin prisa.
 */
const TRIAL_NUDGE_DAYS = [14, 3, 1];
/** A dónde lleva el botón del correo. */
const APP_URL = 'https://app.udeca.app';
/**
 * Lo que cuesta renovar un año, por rol (los mismos que en lib/subscription.ts:
 * ATHLETE_ANNUAL_EUR y ANNUAL_PRICE_EUR).
 */
const RENOVACION_EUR = { athlete: 96, trainer: 180 };
/** No se repite el mismo tipo de aviso antes de este plazo. */
const NUDGE_COOLDOWN_MS = 5 * DAY_MS;
/** Ventana de entrenamientos que se lee (suficiente para semana, mes y racha). */
const WINDOW_DAYS = 100;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Lunes 00:00 de la semana que contiene ts (la semana acaba el domingo 23:59). */
function startOfWeek(ts) {
  const d = new Date(ts);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.getTime();
}

function monthKeyOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartOf(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/**
 * Racha de días entrenados tolerando UN día de hueco. Es la misma regla que
 * usa la app cuando no conoce el plan del alumno; en cuanto este abre la app,
 * su versión (que respeta los descansos programados) sobrescribe esta.
 */
function streakFrom(dayStamps, floorTs) {
  if (dayStamps.length === 0) return 0;
  const trained = new Set(dayStamps);
  const oldest = Math.min(...dayStamps);
  const today = startOfDay(Date.now());
  let streak = 0;
  let gap = 0;
  for (let d = today, i = 0; d >= oldest && i < 400; d -= DAY_MS, i++) {
    if (floorTs !== undefined && d < floorTs) break;
    if (trained.has(d)) {
      streak += 1;
      gap = 0;
      continue;
    }
    if (d === today) continue; // hoy todavía puede entrenar
    gap += 1;
    if (gap >= 2) break;
  }
  return streak;
}

/** Envía notificaciones push por lotes a través de la API de Expo. */
async function sendPush(messages) {
  const valid = messages.filter((m) => m.to);
  for (let i = 0; i < valid.length; i += 100) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(valid.slice(i, i + 100)),
      });
    } catch {
      // Un aviso perdido no debe tumbar la tarea: seguimos con el resto.
    }
  }
  return valid.length;
}

export default async function handler(req, res) {
  // Vercel Cron firma la llamada con CRON_SECRET; sin él, el endpoint queda
  // abierto a cualquiera y podría usarse para spamear notificaciones.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, reason: 'No autorizado' });
    return;
  }

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      res.status(200).json({ ok: false, reason: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
      return;
    }
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    const db = admin.firestore();
    const now = Date.now();

    // ---- 1. Entrenamientos recientes, agrupados por alumno ----
    const since = now - WINDOW_DAYS * DAY_MS;
    const logsSnap = await db.collection('workoutLogs').where('date', '>=', since).get();
    const byClient = new Map();
    logsSnap.forEach((doc) => {
      const l = doc.data();
      if (!l?.clientId || typeof l.date !== 'number') return;
      const arr = byClient.get(l.clientId) ?? [];
      arr.push(l.date);
      byClient.set(l.clientId, arr);
    });

    // ---- 2. Alumnos y atletas ----
    const usersSnap = await db.collection('users').get();
    const weekStart = startOfWeek(now);
    const monthStart = monthStartOf(now);
    const nowMonth = monthKeyOf(now);
    const nowWeek = String(weekStart);
    const today = startOfDay(now);

    const writes = [];
    const messages = [];
    const correos = [];
    const nudged = [];
    let statsUpdated = 0;

    usersSnap.forEach((doc) => {
      const u = doc.data() || {};
      if (u.role !== 'client' && u.role !== 'athlete') return;
      const dates = byClient.get(doc.id) ?? [];
      const dayStamps = [...new Set(dates.map(startOfDay))];

      // --- Métricas públicas del grupo (solo alumnos con entrenador) ---
      if (u.trainerId) {
        statsUpdated += 1;
        writes.push(
          db
            .collection('socialStats')
            .doc(doc.id)
            .set(
              {
                uid: doc.id,
                trainerId: u.trainerId,
                name: u.name ?? '',
                sessionsThisWeek: dates.filter((d) => d >= weekStart).length,
                workoutsThisMonth: dates.filter((d) => d >= monthStart).length,
                streakThisMonth: streakFrom(dayStamps, monthStart),
                currentStreak: streakFrom(dayStamps),
                weekKey: nowWeek,
                monthKey: nowMonth,
                updatedAt: now,
              },
              { merge: true }
            )
        );
      }

      // --- Aviso por inactividad (solo a quien ya ha entrenado alguna vez) ---
      const last = dayStamps.length > 0 ? Math.max(...dayStamps) : null;
      const daysOff = last ? Math.round((today - last) / DAY_MS) : null;
      const lastNudge = u.lastInactivityNudge ?? 0;
      if (
        u.pushToken &&
        daysOff !== null &&
        daysOff >= INACTIVE_DAYS &&
        now - lastNudge > NUDGE_COOLDOWN_MS
      ) {
        messages.push({
          to: u.pushToken,
          title: 'Tu cuerpo te espera',
          body: `Hace ${daysOff} días de tu último entreno. Retomarlo hoy cuesta menos que mañana.`,
        });
        nudged.push({ id: doc.id, data: { lastInactivityNudge: now } });
      }

      // --- Se acaba el año pagado (o la prueba de una cuenta antigua) ---
      //
      // NO depende de tener la app instalada: este aviso sale por push Y por
      // correo. Es el único de la tarea que la app promete por escrito en la
      // tarjeta del plan, y quien usa UDECA desde el navegador no tiene push:
      // se encontraba el muro de pago sin haber sido avisado nunca.
      //
      // Se salta a quien tiene suscripción recurrente en Stripe
      // (`stripeSubscriptionId`): a ese le renueva la tarjeta sola, y decirle
      // "renueva o te quedas fuera" es asustar a quien ya ha pagado.
      if (
        (u.role === 'athlete' || u.role === 'trainer') &&
        typeof u.subscriptionUntil === 'number' &&
        u.subscriptionUntil > now &&
        !u.stripeSubscriptionId
      ) {
        const restantes = Math.ceil((u.subscriptionUntil - now) / DAY_MS);
        // El hito es el aviso que TOCA ahora; si ya se envió, no se repite.
        const hito = TRIAL_NUDGE_DAYS.filter((d) => restantes <= d).pop() ?? null;
        if (hito !== null && u.trialNudgeStage !== hito) {
          // Cuenta antigua todavía en su prueba de 28 días: el aviso es otro,
          // porque lo que se acaba no es un año pagado sino una prueba.
          const esPrueba =
            typeof u.trialEndsAt === 'number' && u.subscriptionUntil <= u.trialEndsAt;
          const precio = RENOVACION_EUR[u.role];
          const ultimoDia = hito === 1;
          const titulo = esPrueba
            ? ultimoDia
              ? 'Hoy es tu último día de prueba'
              : `Te quedan ${restantes} días de prueba`
            : ultimoDia
              ? 'Hoy se te acaba el año'
              : `Te quedan ${restantes} días de acceso`;
          const cuerpo = ultimoDia
            ? `Para seguir sin cortes, renueva desde la app: ${precio} € al año. Tu progreso se queda contigo decidas lo que decidas.`
            : `Cuando termine, seguir cuesta ${precio} € al año. Lo que has registrado no se borra pase lo que pase.`;

          if (u.pushToken) messages.push({ to: u.pushToken, title: titulo, body: cuerpo });
          if (u.email) {
            correos.push({
              to: u.email,
              subject: titulo,
              titulo,
              parrafos: [
                cuerpo,
                'Si decides no seguir, no hay que hacer nada: el acceso se acaba solo y no se cobra.',
              ],
              boton: { texto: 'Abrir UDECA', url: APP_URL },
            });
          }
          // El hito se marca aunque no haya salido ningún aviso: si no, se
          // reintentaría cada día a alguien que no tiene ni push ni correo.
          nudged.push({ id: doc.id, data: { trialNudgeStage: hito } });
        }
      }

      // --- Recordatorio de cuota (vencida o a punto de vencer) ---
      const due = u.nextPaymentDate;
      const lastPayNudge = u.lastPaymentNudge ?? 0;
      if (
        u.pushToken &&
        typeof due === 'number' &&
        due - now < PAYMENT_DUE_DAYS * DAY_MS &&
        now - lastPayNudge > NUDGE_COOLDOWN_MS
      ) {
        const overdue = due < now;
        messages.push({
          to: u.pushToken,
          title: overdue ? 'Cuota vencida' : 'Tu cuota vence pronto',
          body: overdue
            ? 'Tu cuota con tu entrenador está pendiente. Puedes pagarla desde la app.'
            : `Tu cuota vence el ${new Date(due).toLocaleDateString('es-ES')}.`,
        });
        nudged.push({ id: doc.id, data: { lastPaymentNudge: now } });
      }
    });

    await Promise.all(writes);
    const sent = await sendPush(messages);
    const mailed = await enviarCorreos(correos);
    // Marca de envío para no repetir el mismo aviso a diario.
    await Promise.all(
      nudged.map((n) => db.collection('users').doc(n.id).set(n.data, { merge: true }))
    );

    res.status(200).json({
      ok: true,
      statsUpdated,
      notified: sent,
      mailed,
      // Se dice si el correo no está configurado: así, mirando la respuesta de
      // la tarea, se ve de un vistazo si falta pegar la clave en Vercel.
      correo: correoConfigurado() ? 'ok' : 'sin-configurar',
    });
  } catch (e) {
    res.status(200).json({ ok: false, reason: e?.message ?? String(e) });
  }
}
