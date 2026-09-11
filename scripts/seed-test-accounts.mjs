#!/usr/bin/env node
/**
 * Crea las tres cuentas de prueba de UDECA (coach, atleta y alumno) listas para
 * usar: correo ya verificado, alumno ya dentro del grupo del coach y código de
 * invitación creado. Evita la ronda de registrarse tres veces, abrir tres
 * correos de verificación y aprobar la solicitud a mano cada vez que hace falta
 * un entorno limpio.
 *
 * Es idempotente: si las cuentas ya existen las reescribe al estado inicial en
 * vez de fallar. Sirve tanto para crearlas como para "resetear" el entorno.
 *
 * NO se despliega ni se llama desde la app: se ejecuta a mano desde tu equipo.
 * Crear cuentas es una operación privilegiada y no debe existir un endpoint
 * público que lo haga.
 *
 * Uso:
 *   npm i firebase-admin          (si no lo tienes ya en el equipo)
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/serviceAccount.json \
 *     node scripts/seed-test-accounts.mjs
 *
 * Opcional:
 *   SEED_EMAIL_BASE=otro@gmail.com   (por defecto udeca.app@gmail.com)
 *   SEED_PASSWORD=otracosa           (si no, se genera una y se imprime)
 *
 * Los correos se generan con "+etiqueta" sobre la cuenta de UDECA
 * (udeca.app+coach@gmail.com…): Gmail los entrega todos a esa misma bandeja y
 * Firebase los trata como cuentas distintas. Cero cuentas de Google nuevas.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
// Copia de lib/planBase.ts: este script corre con `node` pelado, sin el gancho
// que sabe leer TypeScript, así que no puede importarlo. Si cambia allí, aquí
// también.
const PRIMER_ANO_DIAS = 365;
/**
 * Contraseña de las cuentas de prueba.
 *
 * NO se escribe ninguna por defecto ni se imprime la generada: este repositorio
 * es público, y tanto el código como los registros de GitHub Actions los puede
 * leer cualquiera. Una contraseña fija junto a unos correos predecibles sería
 * una invitación a entrar en las cuentas.
 *
 * Sin SEED_PASSWORD se pone una aleatoria que nadie conoce, y se entra usando
 * "¿Has olvidado tu contraseña?" desde la app: el aviso llega a la bandeja del
 * correo base y la contraseña la eliges tú, sin pasar por ningún registro.
 */
const PASSWORD = process.env.SEED_PASSWORD || randomPassword();

function randomPassword() {
  const abc = 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'udeca-';
  for (let i = 0; i < 12; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
const EMAIL_BASE = process.env.SEED_EMAIL_BASE || 'udeca.app@gmail.com';
const INVITE_CODE = 'TEST01';

/** udeca.app@gmail.com + "coach" -> udeca.app+coach@gmail.com */
function taggedEmail(tag) {
  const [user, domain] = EMAIL_BASE.split('@');
  if (!domain) throw new Error(`SEED_EMAIL_BASE no es un correo válido: ${EMAIL_BASE}`);
  return `${user}+${tag}@${domain}`;
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(`
✖ Falta GOOGLE_APPLICATION_CREDENTIALS.

Descarga la clave privada en Firebase Console → Configuración del proyecto →
Cuentas de servicio → Generar nueva clave privada, y ejecuta:

  GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/fichero.json node scripts/seed-test-accounts.mjs

Ese JSON es una credencial: no lo subas al repo (ya está en .gitignore).
`);
  process.exit(1);
}

// Import diferido: así los avisos de arriba salen antes de que Node se queje
// de que falta el paquete, que es lo que confunde cuando ejecutas esto por
// primera vez.
//
// Se usan los sub-módulos (firebase-admin/app, /auth, /firestore) y no el
// import por defecto: en las versiones nuevas del paquete ese objeto ya no
// expone `credential`, y el script petaba con "Cannot read properties of
// undefined". Esta forma es la misma en todas las versiones recientes.
let initializeApp, applicationDefault, getAuth, getFirestore;
try {
  ({ initializeApp, applicationDefault } = await import('firebase-admin/app'));
  ({ getAuth } = await import('firebase-admin/auth'));
  ({ getFirestore } = await import('firebase-admin/firestore'));
} catch {
  console.error(`
✖ Falta el paquete firebase-admin. Instálalo con:

  npm i --no-save firebase-admin
`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

/** Crea el usuario de Auth o lo reutiliza si ya existe, siempre verificado. */
async function ensureUser(email, name) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password: PASSWORD,
      displayName: name,
      emailVerified: true,
    });
    return existing.uid;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({
      email,
      password: PASSWORD,
      displayName: name,
      // Verificado de entrada: la app bloquea hasta verificar y aquí no
      // queremos pasar por la bandeja de entrada.
      emailVerified: true,
    });
    return created.uid;
  }
}

async function main() {
  const now = Date.now();

  const coachEmail = taggedEmail('coach');
  const athleteEmail = taggedEmail('atleta');
  const clientEmail = taggedEmail('alumno');

  const coachUid = await ensureUser(coachEmail, 'Coach de prueba');
  const athleteUid = await ensureUser(athleteEmail, 'Atleta de prueba');
  const clientUid = await ensureUser(clientEmail, 'Alumno de prueba');

  // COACH: con su primer año pagado, que es lo que compra quien entra.
  //
  // Antes nacía con la suscripción a 0 y entraba igual, porque el plan gratuito
  // cubría hasta cinco alumnos. Con el modelo del primer año eso ya no vale: una
  // cuenta de entrenador sin año pagado ve el muro, y esta es la cuenta que se
  // le entrega a quien revisa la app en Apple y en Google. Un revisor que se
  // encuentra un muro de pago rechaza la versión, y con razón.
  await db.collection('users').doc(coachUid).set({
    uid: coachUid,
    role: 'trainer',
    name: 'Coach de prueba',
    email: coachEmail,
    createdAt: now,
    inviteCode: INVITE_CODE,
    emailVerificationRequired: false,
    entryPaidAt: now,
    subscriptionUntil: now + PRIMER_ANO_DIAS * DAY_MS,
    clientCount: 1,
  });
  await db.collection('trainerCodes').doc(INVITE_CODE).set({
    trainerId: coachUid,
    full: false,
  });

  // ATLETA: es su propio entrenador y entra con su primer año pagado.
  await db.collection('users').doc(athleteUid).set({
    uid: athleteUid,
    role: 'athlete',
    name: 'Atleta de prueba',
    email: athleteEmail,
    createdAt: now,
    trainerId: athleteUid,
    emailVerificationRequired: false,
    entryPaidAt: now,
    subscriptionUntil: now + PRIMER_ANO_DIAS * DAY_MS,
  });

  // ALUMNO: ya vinculado al coach, sin pasar por solicitud ni aprobación.
  await db.collection('users').doc(clientUid).set({
    uid: clientUid,
    role: 'client',
    name: 'Alumno de prueba',
    email: clientEmail,
    createdAt: now,
    trainerId: coachUid,
    emailVerificationRequired: false,
  });
  // Por si quedó una solicitud de una ejecución anterior.
  await db.collection('joinRequests').doc(`${clientUid}_${coachUid}`).delete();

  console.log(`
✔ Cuentas de prueba listas

  Coach    ${coachEmail}
  Atleta   ${athleteEmail}
  Alumno   ${clientEmail}   (ya en el grupo del coach)

  Código de invitación del coach: ${INVITE_CODE}
${
  process.env.SEED_PASSWORD
    ? '\n  Contraseña: la que has indicado.'
    : `
  CONTRASEÑA: no se muestra a propósito. Este script suele ejecutarse desde
  GitHub Actions y, en un repositorio público, esos registros los puede leer
  cualquiera. Para entrar, usa "¿Has olvidado tu contraseña?" en la pantalla de
  acceso con cada uno de los correos de arriba: los tres avisos llegan a la
  bandeja de ${EMAIL_BASE} y eliges tú la contraseña.`
}

Vuelve a ejecutar esto cuando quieras dejar las cuentas como estaban.
`);
}

main().catch((e) => {
  console.error('✖ Error:', e.message);
  process.exit(1);
});
