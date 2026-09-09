#!/usr/bin/env node
/**
 * Prueba de las reglas de Firestore contra el emulador.
 *
 * Existe por un fallo concreto: al pasar los cobros a fechas exactas, la app
 * empezó a escribir `billingAnchorDay` en el alumno, pero ese campo no estaba
 * en la lista de los que el entrenador puede tocar. Resultado: TODA
 * confirmación de cobro fallaba con "permisos insuficientes", y no se detectó
 * porque el emulador de desarrollo no cargaba las reglas.
 *
 * Comprueba las dos caras: que la app puede hacer lo que necesita, y que NO
 * puede hacer lo que no debe. Un permiso de más es tan fallo como uno de menos.
 *
 * Uso (con el emulador levantado y las reglas cargadas):
 *   node scripts/seed-emulator.mjs && node scripts/check-rules.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  deleteField,
} from 'firebase/firestore';

const HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const app = initializeApp({ apiKey: 'demo', projectId: 'udeca-demo', appId: '1:1:web:1' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
connectFirestoreEmulator(db, HOST, 8080);

const PW = 'Demo1234';
let fallos = 0;

/** Ejecuta una escritura y comprueba si el resultado es el esperado. */
async function comprobar(descripcion, esperado, accion) {
  let permitido;
  try {
    await accion();
    permitido = true;
  } catch (e) {
    if (e.code !== 'permission-denied') throw e;
    permitido = false;
  }
  const bien = permitido === esperado;
  if (!bien) fallos++;
  const signo = bien ? '✔' : '✖';
  const real = permitido ? 'permitido' : 'rechazado';
  const quiero = esperado ? 'permitido' : 'rechazado';
  console.log(`  ${signo} ${descripcion}: ${real}${bien ? '' : ` (se esperaba ${quiero})`}`);
}

const coach = await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
const alumnos = await getDocs(
  query(collection(db, 'users'), where('trainerId', '==', coach.user.uid))
);
if (alumnos.empty) {
  console.error('✖ No hay alumnos sembrados. Ejecuta antes scripts/seed-emulator.mjs');
  process.exit(1);
}
const alumno = alumnos.docs[0];
console.log(`\n(alumno de prueba: ${alumno.data().name} / ${alumno.data().email})`);

/**
 * Un valor de ancla DISTINTO del que ya tiene el alumno.
 *
 * `affectedKeys()` compara el documento antes y después: escribir el mismo
 * valor que ya había no cuenta como cambio, así que la comprobación pasaría
 * aunque el campo estuviese prohibido. Con un valor nuevo, el campo entra
 * de verdad en el diff y la regla se pone a prueba.
 */
const anclaNueva = ((alumno.data().billingAnchorDay ?? 1) % 28) + 1;

console.log('\nEl entrenador sobre un alumno suyo');
await comprobar('confirmar un cobro (con billingAnchorDay)', true, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    {
      paymentStatus: 'paid',
      nextPaymentDate: Date.now() + 30 * 86400000,
      billingAnchorDay: anclaNueva,
      paymentReportedAt: deleteField(),
    },
    { merge: true }
  )
);
await comprobar('cambiar la cuota mensual', true, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { monthlyFeeEur: (alumno.data().monthlyFeeEur ?? 0) + 1 },
    { merge: true }
  )
);
// El enlace con el que paga ESE alumno. Va por alumno porque cada plan tiene
// su precio; lo pone el entrenador junto a la cuota.
await comprobar('ponerle su enlace de pago', true, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { paymentLink: `https://buy.stripe.com/${Date.now()}` },
    { merge: true }
  )
);
await comprobar('y quitárselo', true, () =>
  setDoc(doc(db, 'users', alumno.id), { paymentLink: deleteField() }, { merge: true })
);
await comprobar('cambiarle el nombre', false, () =>
  setDoc(doc(db, 'users', alumno.id), { name: 'No debería' }, { merge: true })
);
await comprobar('regalarle suscripción', false, () =>
  setDoc(doc(db, 'users', alumno.id), { subscriptionUntil: Date.now() + 1e10 }, { merge: true })
);

console.log('\nEl entrenador sobre sí mismo');
await comprobar('regalarse suscripción', false, () =>
  setDoc(
    doc(db, 'users', coach.user.uid),
    { subscriptionUntil: Date.now() + 1e10 },
    { merge: true }
  )
);
await comprobar('falsear su recuento de alumnos', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { clientCount: 0 }, { merge: true })
);
// El alta de 1 € da 5 plazas UNA vez; si el coach pudiera escribir este campo,
// se regalaría plazas y el control de multicuentas no valdría nada.
await comprobar('regalarse plazas de alumno', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { clientSlots: 999 }, { merge: true })
);
await comprobar('falsear la huella de su tarjeta', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { payerFingerprint: 'otra' }, { merge: true })
);
// Todo el muro de alta se sostiene sobre este campo: si la propia cuenta
// pudiera escribirlo, el euro sería voluntario y la tarjeta no se conocería.
await comprobar('darse el alta a sí mismo', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { entryPaidAt: Date.now() }, { merge: true })
);
// La tarjeta de fundador vale porque el número lo reparte el servidor: si se
// pudiera escribir, cualquiera sería el número 1.
await comprobar('nombrarse fundador', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { founderNumber: 1 }, { merge: true })
);
await comprobar('cambiar su propio nombre', true, () =>
  setDoc(doc(db, 'users', coach.user.uid), { name: 'Luis Tena' }, { merge: true })
);

// El "otro alumno" tiene que ser DISTINTO del de prueba: si coincide, estaría
// escribiendo en su propio documento y la comprobación no probaría nada.
const otroEmail =
  alumno.data().email === 'alumno2@demo.test' ? 'alumno@demo.test' : 'alumno2@demo.test';
const otro = await signInWithEmailAndPassword(auth, otroEmail, PW);
console.log(`\nUn alumno (${otroEmail}) sobre OTRO alumno`);
await comprobar('marcarle como pagado', false, () =>
  setDoc(doc(db, 'users', alumno.id), { paymentStatus: 'paid' }, { merge: true })
);
await comprobar('quitarle el entrenador', false, () =>
  setDoc(doc(db, 'users', alumno.id), { trainerId: otro.user.uid }, { merge: true })
);

// El enlace del grupo privado puede vivir en `config/comunidad`. Si se pudiera
// leer desde la app, el formulario de la comunidad dejaría de ser una puerta.
await comprobar('leer los ajustes del servidor (config)', false, () =>
  getDoc(doc(db, 'config', 'comunidad'))
);

/*
 * LA VERSIÓN MÍNIMA ES LA EXCEPCIÓN, Y TIENE QUE SERLO
 *
 * `config/version` dice qué versión de la app ha dejado de valer, y la app
 * necesita leerla para saber si le toca el muro de "actualiza para seguir". Si
 * no pudiera, el muro no aparecería NUNCA: es tanto como no tenerlo.
 *
 * Escribirla sigue prohibido, y esta es de las prohibiciones que más importan
 * de todo el fichero: quien pudiera escribir ahí una versión altísima dejaría
 * fuera de la app a todos los usuarios a la vez, de golpe.
 */
await comprobar('leer la versión mínima', true, () => getDoc(doc(db, 'config', 'version')));
await comprobar('dejar a todos fuera subiendo la versión mínima', false, () =>
  setDoc(doc(db, 'config', 'version'), { minima: '99.0.0' })
);

/*
 * LA RUTINA DIARIA: la pone el entrenador, la hace el alumno.
 *
 * Las dos mitades importan. Si el alumno pudiera escribir la rutina, se
 * quitaría lo que no le apetece y su entrenador seguiría creyendo que lo hace.
 * Y si el entrenador pudiera marcar lo hecho, el registro dejaría de ser lo que
 * el alumno ha hecho para ser lo que su entrenador cree.
 */
console.log('\nRutina diaria');
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador le pone la rutina diaria a su alumno', true, () =>
  setDoc(doc(db, 'rutinasDiarias', alumno.id), {
    trainerId: coach.user.uid,
    clientId: alumno.id,
    activa: true,
    nombre: 'Diaria',
    ejercicios: [{ id: 'e1', nombre: 'Pino', objetivo: '3 series de 30 s' }],
    updatedAt: Date.now(),
  })
);
// Un entrenador no puede escribirle la rutina a quien no es suyo.
await comprobar('pero no a un alumno que no es suyo', false, () =>
  setDoc(doc(db, 'rutinasDiarias', 'de-otro-cualquiera'), {
    trainerId: coach.user.uid,
    clientId: 'de-otro-cualquiera',
    activa: true,
    nombre: 'Diaria',
    ejercicios: [],
    updatedAt: Date.now(),
  })
);

await signInWithEmailAndPassword(auth, alumno.data().email, PW);
await comprobar('el alumno la LEE', true, () => getDoc(doc(db, 'rutinasDiarias', alumno.id)));
// Quitarse el ejercicio que no apetece dejaría al entrenador creyendo que se
// hace: la rutina la escribe quien la manda.
await comprobar('pero no se la reescribe', false, () =>
  setDoc(doc(db, 'rutinasDiarias', alumno.id), {
    trainerId: coach.user.uid,
    clientId: alumno.id,
    activa: false,
    nombre: 'Ya no',
    ejercicios: [],
    updatedAt: Date.now(),
  })
);
const claveDia = `${alumno.id}_2026-01-01`;
await comprobar('y marca lo que ha hecho hoy', true, () =>
  setDoc(doc(db, 'rutinasDiariasDias', claveDia), {
    clientId: alumno.id,
    trainerId: coach.user.uid,
    date: Date.now(),
    hechos: ['e1'],
    updatedAt: Date.now(),
  })
);

await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador ve lo que lleva hecho', true, () =>
  getDoc(doc(db, 'rutinasDiariasDias', claveDia))
);
// Dar por hecho el ejercicio de otro no es una función: es falsear su registro.
await comprobar('pero no puede darlo por hecho él', false, () =>
  setDoc(doc(db, 'rutinasDiariasDias', claveDia), {
    clientId: alumno.id,
    trainerId: coach.user.uid,
    date: Date.now(),
    hechos: ['e1', 'e2'],
    updatedAt: Date.now(),
  })
);

// Un alta pagada en la web queda apuntada a un correo. Si se pudiera leer o
// escribir desde la app, cualquiera se regalaría el euro o se llevaría la
// lista de correos de quien ha pagado.
await comprobar('leer las altas pagadas en la web', false, () =>
  getDoc(doc(db, 'entryPayments', 'loquesea'))
);
await comprobar('inventarse un alta pagada', false, () =>
  setDoc(doc(db, 'entryPayments', 'loquesea'), { email: 'yo@ejemplo.com', paidAt: Date.now() })
);

// Borrarse la cuenta exige poder llevarse el nombre de la clasificación.
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('borrar su propia ficha de la clasificación', true, () =>
  setDoc(doc(db, 'socialStats', otro.user.uid), {
    uid: otro.user.uid,
    trainerId: coach.user.uid,
    name: 'Prueba',
    updatedAt: Date.now(),
  }).then(() => deleteDoc(doc(db, 'socialStats', otro.user.uid)))
);

/*
 * EN QUÉ CLASIFICACIÓN PUEDE APARECER CADA UNO
 *
 * El grupo lo dice el perfil, que solo escribe el entrenador al aceptar a
 * alguien. Antes lo decía quien escribía la ficha, y eso valía para dos cosas
 * malas: colarse en el ranking de cualquier entrenador con el nombre que se
 * quisiera, y —la que se notaba— volver solo al grupo del que te acababan de
 * expulsar, porque la app del alumno seguía escribiendo con el perfil viejo.
 */
await comprobar('meterse en la clasificación de otro entrenador', false, () =>
  setDoc(doc(db, 'socialStats', otro.user.uid), {
    uid: otro.user.uid,
    // Un entrenador que no es el suyo: el propio alumno.
    trainerId: alumno.id,
    name: 'Colado',
    updatedAt: Date.now(),
  })
);
await comprobar('publicar en la clasificación de SU entrenador', true, () =>
  setDoc(doc(db, 'socialStats', otro.user.uid), {
    uid: otro.user.uid,
    trainerId: otro.user.uid === coach.user.uid ? otro.user.uid : coach.user.uid,
    name: 'Prueba',
    updatedAt: Date.now(),
  })
);
// Y el entrenador puede sacarlo, que es lo que pasa al expulsarlo.
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador saca a un alumno de la clasificación', true, () =>
  deleteDoc(doc(db, 'socialStats', otro.user.uid))
);

/*
 * Y SE DEVUELVE LO BORRADO.
 *
 * Esta comprobación borra de verdad una ficha que viene de la semilla. Sin
 * reponerla, la siguiente prueba que mire la clasificación se encuentra un
 * miembro menos y falla por algo que no tiene nada que ver con lo que estaba
 * probando — que es la peor manera de perder una tarde.
 */
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('y la ficha se repone para la siguiente prueba', true, () =>
  setDoc(doc(db, 'socialStats', otro.user.uid), {
    uid: otro.user.uid,
    trainerId: coach.user.uid,
    name: otro.user.displayName || (otroEmail === 'alumno2@demo.test' ? 'Ana Gil' : 'Marcos Ruiz'),
    currentStreak: 0,
    sessionsThisWeek: 0,
    totalWorkouts: 0,
    updatedAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

console.log('\nEsfuerzo (RIR) y programación de la semana');
// El RIR se lo activa el ENTRENADOR a su alumno: si se lo pudiera activar (o
// quitar) el propio alumno, el dato dejaría de significar lo que el entrenador
// cree que significa.
//
// Primero se lo pone el entrenador, aquí y no en la semilla: borrar un campo
// que NO existe es un no-op, y las reglas lo dejan pasar porque no cambia
// nada. Sin esta línea, la comprobación de más abajo aprobaba sin probar
// nada — y solo cuando al sorteo le tocaba el alumno que ya lo llevaba puesto.
await comprobar('el entrenador se lo activa (preparación)', true, () =>
  setDoc(doc(db, 'users', otro.user.uid), { trackRir: true }, { merge: true })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
// Se prueba QUITÁRSELO, que es el caso que hace daño: si el alumno pudiera
// apagarlo, el entrenador seguiría creyendo que ese dato existe. (Ponerlo al
// valor que ya tiene no cambia nada, así que no probaría nada.)
await comprobar('el alumno NO se apaga el RIR que le puso su entrenador', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { trackRir: false }, { merge: true })
);
await comprobar('ni se lo borra del perfil', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { trackRir: deleteField() }, { merge: true })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador SÍ se lo activa a su alumno', true, () =>
  setDoc(doc(db, 'users', alumno.id), { trackRir: true }, { merge: true })
);
await comprobar('pero no puede colar otra cosa de paso', false, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { trackRir: true, subscriptionUntil: Date.now() + 999999999 },
    { merge: true }
  )
);

// Ser VIP es el plan que ese alumno tiene contratado, no una casilla suya. Si
// pudiera marcárselo él, se llevaría gratis las clases del plan de arriba.
console.log('\nAlumno VIP (clases reservadas)');
await comprobar('el entrenador marca VIP a su alumno', true, () =>
  setDoc(doc(db, 'users', alumno.id), { vip: true }, { merge: true })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('el alumno NO se marca VIP a sí mismo', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { vip: true }, { merge: true })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador se lo quita', true, () =>
  setDoc(doc(db, 'users', alumno.id), { vip: false }, { merge: true })
);
await comprobar('y no puede colar la suscripción de paso', false, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { vip: true, subscriptionUntil: Date.now() + 999999999 },
    { merge: true }
  )
);
// No se deja puesto: el resto de comprobaciones no tienen por qué encontrarse
// un alumno VIP de la vez anterior.
await comprobar('limpieza', true, () =>
  setDoc(doc(db, 'users', alumno.id), { vip: false }, { merge: true })
);

// El enlace de pago lo pone el ENTRENADOR. Si el alumno pudiera cambiárselo,
// se pegaría un enlace de 5 € y estaría cambiándose la cuota.
await comprobar('el entrenador le pone un enlace (preparación)', true, () =>
  setDoc(
    doc(db, 'users', otro.user.uid),
    { paymentLink: 'https://buy.stripe.com/del-entrenador' },
    { merge: true }
  )
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('el alumno NO se cambia su enlace de pago', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { paymentLink: 'https://buy.stripe.com/5-euros' }, { merge: true })
);
await comprobar('ni se lo borra', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { paymentLink: deleteField() }, { merge: true })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
// Se recoge lo que ha ensuciado la prueba: el enlace lo puso ella, no la
// semilla, y dejarlo puesto engaña a cualquier revisión posterior.
await setDoc(doc(db, 'users', otro.user.uid), { paymentLink: deleteField() }, { merge: true });
// Cursos: quién puede decir que ha visto una lección.
//
// El caso que importa es el del ENTRENADOR. Si pudiera marcar lecciones como
// vistas en nombre de su alumno, el porcentaje del panel dejaría de significar
// "lo ha visto" y pasaría a significar "alguien dijo que lo vio" — y él
// seguiría decidiendo sobre ese dato igualmente, que es lo que lo hace
// peligroso.
await comprobar('el entrenador NO marca lecciones por su alumno', false, () =>
  setDoc(
    doc(db, 'courseProgress', alumno.id),
    { uid: alumno.id, lessons: { c1: ['l1'] }, updatedAt: Date.now() },
    { merge: true }
  )
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('cada uno marca las suyas', true, () =>
  setDoc(
    doc(db, 'courseProgress', otro.user.uid),
    { uid: otro.user.uid, lessons: { c1: ['l1', 'l2'] }, updatedAt: Date.now() },
    { merge: true }
  )
);
await comprobar('pero no las de otro alumno', false, () =>
  setDoc(
    doc(db, 'courseProgress', alumno.id),
    { uid: alumno.id, lessons: { c1: ['l1'] }, updatedAt: Date.now() },
    { merge: true }
  )
);
await comprobar('ni cotillea por dónde va otro alumno', false, () =>
  getDoc(doc(db, 'courseProgress', alumno.id))
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador SÍ ve por dónde va su alumno', true, () =>
  getDoc(doc(db, 'courseProgress', otro.user.uid))
);

await comprobar('programa la semana de SU alumno', true, () =>
  addDoc(collection(db, 'trainingCycles'), {
    trainerId: coach.user.uid,
    clientId: alumno.id,
    level: 'micro',
    name: 'Semana de prueba',
    weekPlan: [{ exerciseId: 'x', sets: 4, reps: '8' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('el alumno NO se programa su propia semana', false, () =>
  addDoc(collection(db, 'trainingCycles'), {
    trainerId: coach.user.uid,
    clientId: otro.user.uid,
    level: 'micro',
    name: 'La mía',
    weekPlan: [{ exerciseId: 'x', sets: 99 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

console.log('\nPlantillas de plan (planTemplates)');
// La plantilla es el método del entrenador. Ni sus alumnos ni otro entrenador
// tienen por qué verla: lo que el alumno necesita es SU plan, no el molde.
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
const plantilla = await addDoc(collection(db, 'planTemplates'), {
  trainerId: coach.user.uid,
  name: 'Mi método',
  blocks: [{ name: 'Bloque', weeks: [{ name: 'Semana 1', targetSessions: 4 }] }],
  createdAt: Date.now(),
});
await comprobar('el entrenador crea la suya', true, () => getDoc(plantilla));
await comprobar('no puede crearla a nombre de otro', false, () =>
  addDoc(collection(db, 'planTemplates'), {
    trainerId: 'otro-entrenador',
    name: 'Robada',
    blocks: [],
    createdAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('un alumno NO lee la plantilla de su entrenador', false, () =>
  getDoc(plantilla)
);
await comprobar('ni la borra', false, () => deleteDoc(plantilla));
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await deleteDoc(plantilla).catch(() => {});

console.log('\nTabla de progreso (progressTrackers)');
// Se limpia al final: esta prueba escribe en la misma base que usa la app para
// revisarla a mano, y dejar ejercicios inventados ahí ensucia la pantalla.
await comprobar('el alumno LEE su propia tabla', true, () =>
  getDoc(doc(db, 'progressTrackers', otro.user.uid))
);
await comprobar('el alumno NO puede escribir su tabla', false, () =>
  setDoc(
    doc(db, 'progressTrackers', otro.user.uid),
    { trainerId: otro.user.uid, clientId: otro.user.uid, exerciseIds: ['x'], updatedAt: Date.now() },
    { merge: true }
  )
);

await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador SÍ escribe la tabla de su alumno', true, () =>
  setDoc(
    doc(db, 'progressTrackers', alumno.id),
    {
      trainerId: coach.user.uid,
      clientId: alumno.id,
      exerciseIds: ['a', 'b'],
      updatedAt: Date.now(),
    },
    { merge: true }
  )
);

// Esta comprobación va AQUÍ y no antes: leer un documento que no existe está
// permitido a propósito (para que la pantalla cargue sin selección), así que
// solo prueba algo una vez el documento existe de verdad.
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('un alumno NO lee la tabla de otro alumno', false, () =>
  getDoc(doc(db, 'progressTrackers', alumno.id))
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

// Un documento con el dueño equivocado (de un fallo antiguo o de un cambio de
// entrenador) no puede quedar bloqueado: el entrenador actual lo recupera.
await comprobar('el entrenador recupera una tabla con dueño equivocado', true, () =>
  setDoc(
    doc(db, 'progressTrackers', alumno.id),
    { trainerId: coach.user.uid, exerciseIds: ['c'], updatedAt: Date.now() },
    { merge: true }
  )
);

// Deja la tabla como estaba: sin selección, que es el comportamiento por
// defecto (se muestran todos los ejercicios).
await deleteDoc(doc(db, 'progressTrackers', alumno.id)).catch(() => {});

/*
 * LA PROPAGACIÓN NECESITA PODER PREGUNTAR POR LAS RUTINAS DIARIAS DE SUS ALUMNOS
 *
 * Al corregir un ejercicio de la biblioteca, la app recorre las rutinas diarias
 * del entrenador para llevar el nombre y el vídeo nuevos a quien lo tuviera
 * puesto (ver lib/firestore/renombrarEjercicio.ts). Eso es una CONSULTA por
 * `trainerId`, no una lectura por id, y las reglas la tienen que admitir.
 *
 * Si no la admitieran, no saltaría ningún error visible: la propagación fallaría
 * en silencio y el entrenador vería el ejercicio bien en su biblioteca y mal en
 * la rutina diaria de sus alumnos, sin entender por qué.
 */
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
console.log('\nLa propagación de un ejercicio a las rutinas diarias');
await comprobar('el entrenador consulta las rutinas diarias de sus alumnos', true, () =>
  getDocs(query(collection(db, 'rutinasDiarias'), where('trainerId', '==', coach.user.uid)))
);
// Y no las de otro: la consulta sin filtro, o con el uid de otro, se rechaza.
await comprobar('pero no las de otro entrenador', false, () =>
  getDocs(query(collection(db, 'rutinasDiarias'), where('trainerId', '==', 'otro-cualquiera')))
);
await comprobar('ni todas de golpe', false, () => getDocs(collection(db, 'rutinasDiarias')));

console.log(
  fallos === 0
    ? '\n✔ Todas las comprobaciones de reglas pasan.\n'
    : `\n✖ ${fallos} comprobación(es) de reglas han fallado.\n`
);
process.exit(fallos === 0 ? 0 : 1);
