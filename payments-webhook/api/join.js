import admin from 'firebase-admin';

/**
 * Alta de alumnos en el grupo de un entrenador, decidida en el SERVIDOR.
 *
 * El plan gratuito del coach llega a FREE_CLIENT_LIMIT alumnos. Comprobarlo en
 * la app tenía dos agujeros: cualquiera con conocimientos puede saltarse una
 * comprobación de cliente, y dos aprobaciones simultáneas la pasan las dos.
 *
 * Aquí se cuentan los alumnos de verdad con el SDK de administrador y se
 * escribe el vínculo solo si procede. La app pide; el servidor decide.
 *
 * SIEMPRE se verifica el idToken de Firebase de quien llama: sin eso,
 * cualquiera podría meter alumnos en el grupo de otro entrenador.
 *
 * Acciones:
 *   approve — el entrenador acepta una solicitud (único camino por el que un
 *             alumno queda vinculado).
 *   sync    — recalcula su recuento (p. ej. tras quitar a alguien del grupo).
 *
 * Variables de entorno: FIREBASE_SERVICE_ACCOUNT (JSON de cuenta de servicio).
 */

/**
 * Alumnos incluidos en el primer año del entrenador (27 €).
 * Debe coincidir con FREE_CLIENT_LIMIT de lib/subscription.ts.
 */
const FREE_CLIENT_LIMIT = 5;

/**
 * Desde cuándo rige el modelo del primer año de pago.
 * Copia de PRIMER_ANO_DESDE en lib/planBase.ts.
 */
const PRIMER_ANO_DESDE = Date.parse('2026-09-11T00:00:00Z');

/**
 * Plazas de ESTA cuenta. Por defecto las del primer año, pero el servidor las
 * baja a cero cuando se pagó con una tarjeta que ya había comprado sus plazas
 * en otra cuenta de entrenador (ver stripe-webhook.js). Un pago, cinco plazas,
 * una vez.
 */
function plazasDe(trainer) {
  const n = trainer?.clientSlots;
  return typeof n === 'number' && n >= 0 ? n : FREE_CLIENT_LIMIT;
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

/** ¿Tiene el entrenador acceso vigente? (misma regla que la app). */
function hasActiveSubscription(trainer) {
  const until = trainer?.subscriptionUntil;
  // Sin campo = cuenta fundadora, anterior a la monetización: acceso completo.
  if (until === undefined) return true;
  return typeof until === 'number' && until > Date.now();
}

/**
 * ¿Puede este entrenador aceptar alumnos sin tope?
 *
 * OJO: no es lo mismo que tener el acceso vigente, y confundirlos regalaba la
 * app entera. Con el modelo nuevo el primer año se PAGA (27 €), así que un
 * entrenador recién dado de alta tiene suscripción vigente desde el minuto
 * uno; si el tope siguiera atado a eso, los 180 € del plan sin tope no los
 * pagaría nadie —bastaría con entrar—.
 *
 * Lo que quita el tope es el PLAN, que solo escribe Stripe al contratar la
 * suscripción anual (`subscriptionPlan === 'annual'`).
 *
 * Las cuentas ANTERIORES al cambio conservan la regla vieja: a ellas se les
 * vendió que con la suscripción activa no había tope, y eso se respeta.
 * Es la misma distinción que hace `trainerAtFreeLimit` en lib/planBase.ts.
 */
function sinTopeDeAlumnos(trainer) {
  if (trainer?.subscriptionPlan === 'annual' && hasActiveSubscription(trainer)) return true;
  if ((trainer?.createdAt ?? 0) >= PRIMER_ANO_DESDE) return false;
  return hasActiveSubscription(trainer);
}

/** Cuenta real de alumnos del entrenador. */
async function countClients(db, trainerId) {
  const snap = await db
    .collection('users')
    .where('trainerId', '==', trainerId)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Guarda el recuento en el perfil del coach y marca su código público como
 * lleno. Lo escribe el servidor para que sea un dato de confianza: la app del
 * coach ya no puede falsearlo para seguir creciendo gratis.
 */
async function writeCount(db, trainer, trainerId, count) {
  const full = !sinTopeDeAlumnos(trainer) && count >= plazasDe(trainer);
  await db.collection('users').doc(trainerId).update({ clientCount: count });
  if (trainer?.inviteCode) {
    await db
      .collection('trainerCodes')
      .doc(trainer.inviteCode)
      .set({ full }, { merge: true });
  }
  return full;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      res.status(200).json({ ok: false, reason: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
      return;
    }
    initAdmin();
    const db = admin.firestore();

    let body = {};
    if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const { idToken, action } = body;

    if (!idToken) {
      res.status(200).json({ ok: false, reason: 'Falta la identificación' });
      return;
    }

    // Identidad verificada: a partir de aquí `caller` es de fiar.
    let caller;
    try {
      caller = await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(200).json({ ok: false, reason: 'Sesión no válida. Vuelve a entrar.' });
      return;
    }

    // ---- Un entrenador acepta una solicitud de su grupo ----
    if (action === 'approve') {
      const clientId = String(body.clientId || '');
      if (!clientId) {
        res.status(200).json({ ok: false, reason: 'Falta el alumno' });
        return;
      }
      const trainerSnap = await db.collection('users').doc(caller.uid).get();
      const trainer = trainerSnap.exists ? trainerSnap.data() : null;
      if (!trainer || trainer.role !== 'trainer') {
        res.status(200).json({ ok: false, reason: 'Solo un entrenador puede aceptar alumnos.' });
        return;
      }

      const count = await countClients(db, caller.uid);
      if (!sinTopeDeAlumnos(trainer) && count >= plazasDe(trainer)) {
        await writeCount(db, trainer, caller.uid, count);
        res.status(200).json({
          ok: false,
          reason:
            plazasDe(trainer) === 0
              ? 'Esta cuenta no tiene plazas incluidas: se pagó con una tarjeta que ya las usó en otra cuenta. Pasa al plan sin tope para aceptar alumnos.'
              : `Tu plan incluye ${plazasDe(trainer)} alumnos. Pasa al plan sin tope para aceptar a más.`,
        });
        return;
      }

      await db.collection('users').doc(clientId).update({ trainerId: caller.uid });
      await db.collection('joinRequests').doc(`${clientId}_${caller.uid}`).delete();
      await writeCount(db, trainer, caller.uid, count + 1);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- Recuento al día (tras quitar alumnos, o al abrir la lista) ----
    if (action === 'sync') {
      const trainerSnap = await db.collection('users').doc(caller.uid).get();
      const trainer = trainerSnap.exists ? trainerSnap.data() : null;
      if (!trainer || trainer.role !== 'trainer') {
        res.status(200).json({ ok: false, reason: 'Solo para entrenadores' });
        return;
      }
      const count = await countClients(db, caller.uid);
      const full = await writeCount(db, trainer, caller.uid, count);
      res.status(200).json({ ok: true, count, full });
      return;
    }

    res.status(200).json({ ok: false, reason: 'Acción desconocida' });
  } catch (e) {
    res.status(200).json({ ok: false, reason: e?.message || 'Error inesperado' });
  }
}
