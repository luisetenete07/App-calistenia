import admin from 'firebase-admin';

/**
 * Activación del primer año, en un solo sitio.
 *
 * Lo usan DOS caminos distintos: el webhook, cuando el pago trae el uid, y
 * api/claim-entry, cuando alguien se registra después de haber pagado en la
 * web. Si cada uno escribiera sus campos por su cuenta, tarde o temprano uno
 * de los dos se olvidaría de las plazas o de la fecha de fin y habría cuentas
 * activadas a medias según por dónde entrasen.
 *
 * El guion bajo del nombre no es decorativo: Vercel no publica como función
 * los ficheros de /api que empiezan por "_", así que esto es un módulo
 * compartido y no un endpoint abierto a internet.
 */

/**
 * El primer año, que es lo que se compra al entrar.
 *
 * Copia del `PRIMER_ANO_DIAS` de lib/planBase.ts. Este servidor se despliega
 * aparte (Vercel) y no comparte código con la app, así que el número vive en
 * los dos sitios. Aquí es donde se escribe de verdad la fecha de fin.
 *
 * Antes eran 28 días de prueba para el atleta y nada para el entrenador. Ahora
 * la entrada ES el primer año —27 € el entrenador, 17 € el atleta— y el reloj
 * de los dos empieza al pagar.
 */
export const PRIMER_ANO_DIAS = 365;

/**
 * DOS CAMPAÑAS DE FUNDADORES, UNA POR TIPO DE CUENTA
 *
 * Entrenadores y atletas tienen su propia serie, con su propio contador, su
 * propio interruptor y su propio tope. Hay un entrenador fundador #1 y un
 * atleta fundador #1, y no se pisan.
 *
 * Al principio compartían contador, y el resultado no era el que se quiere: el
 * primer atleta que llegaba se encontraba con un #0043 porque antes se habían
 * dado de alta cuarenta y dos entrenadores. El número dejaba de decir "fuiste
 * de los primeros" para decir "llegaste tarde", que es justo lo contrario de
 * para lo que existe.
 *
 * Son además dos productos que se venden por separado y en momentos distintos:
 * quien abre la campaña de atletas no tiene por qué abrir la de entrenadores el
 * mismo día, ni ponerle el mismo tope.
 *
 * Quien YA tiene número se lo queda tal cual. Los números repartidos no se
 * tocan nunca —ver el porqué en lib/fundador.ts—, así que las cuentas de antes
 * de esta separación conservan el suyo aunque venga de la cuenta compartida.
 */
const MOSTRADOR = { trainer: 'fundadores', athlete: 'fundadoresAtletas' };

/**
 * Reparte el número de fundador de su serie, si esa campaña sigue abierta.
 *
 * El número es correlativo y no se reutiliza: el 7 es el séptimo que pagó su
 * alta y lo seguirá siendo aunque los seis de antes se borren la cuenta. Por
 * eso el contador se guarda aparte (en `config/…`) y se incrementa en una
 * TRANSACCIÓN: dos altas simultáneas no pueden llevarse el mismo número.
 *
 * Cada campaña arranca CERRADA y se abre poniendo `abierta: true` en su
 * documento desde la consola de Firebase; se puede fijar un tope con `limite`.
 * Empieza y termina cuando lo decide quien lleva el marketing, no cuando se
 * despliega código — y cerrada por defecto porque repartir números antes de
 * tiempo no tiene vuelta atrás: el número 1 solo se da una vez.
 */
async function repartirNumeroDeFundador(db, uid, rol) {
  const doc = MOSTRADOR[rol];
  if (!doc) return null;
  const ref = db.collection('config').doc(doc);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const datos = snap.exists ? snap.data() : {};
      if (datos.abierta !== true) return null;
      const siguiente = typeof datos.siguiente === 'number' ? datos.siguiente : 1;
      if (typeof datos.limite === 'number' && siguiente > datos.limite) return null;
      t.set(ref, { siguiente: siguiente + 1, ultimoUid: uid, updatedAt: Date.now() }, { merge: true });
      return siguiente;
    });
  } catch {
    // Que falle el contador no puede impedir que la cuenta se active: el alta
    // es lo que la persona ha pagado; el número es un extra.
    return null;
  }
}

/**
 * ¿Cuántas cuentas de ENTRENADOR han pagado ya con esta tarjeta?
 *
 * El primer año del entrenador incluye cinco plazas de alumno. Si la misma
 * tarjeta paga un segundo primer año, no compra otras cinco plazas: compra una
 * cuenta más, vacía. Así abrir cuentas deja de ser una forma de esquivar los
 * 180 € y pasa a ser solo trabajo extra para el que lo intente.
 *
 * No se bloquea ni se borra nada: cuentas legítimas comparten tarjeta (una
 * pareja, un centro que paga por dos entrenadores). Se marca y se decide,
 * nunca se castiga en automático.
 */
export async function cuentasConLaMismaTarjeta(db, fingerprint, uid) {
  const ref = db.collection('payerCards').doc(fingerprint);
  const snap = await ref.get();
  const previas = (snap.exists ? snap.data().trainerUids : []) || [];
  const otras = previas.filter((x) => x !== uid);
  return { ref, otras, yaEstaba: previas.includes(uid) };
}

/**
 * Marca la cuenta como dada de alta (primer año pagado).
 *
 * Devuelve false si no había nada que hacer (cuenta inexistente, o que no
 * paga plataforma), para que quien llame pueda decirlo.
 */
export async function aplicarAlta(db, uid, { huella = null, customerId = null } = {}) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const perfil = snap.data();
  if (perfil.role !== 'trainer' && perfil.role !== 'athlete') return false;

  const datos = { entryPaidAt: Date.now(), stripeCustomerId: customerId };
  if (huella) datos.payerFingerprint = huella;

  // Lo que se compra al entrar es el PRIMER AÑO, y vale para los dos roles: el
  // entrenador y el atleta pagan su año por adelantado. El reloj empieza AQUÍ
  // y no al registrarse: si tardó dos días en pagar, no los pierde. Solo la
  // primera vez, y sin acortar nunca un acceso mayor que ya tuviera
  // (cortesías, prórrogas dadas a mano, o un plus ya contratado).
  //
  // No se escribe `trialEndsAt`: esto no es una prueba, es un año pagado. Ese
  // campo es lo que hace que la app diga "estás de prueba" y que la tarea
  // diaria mande los avisos de prueba, y las dos cosas serían mentira.
  if (!perfil.entryPaidAt) {
    const fin = Date.now() + PRIMER_ANO_DIAS * 24 * 60 * 60 * 1000;
    datos.subscriptionUntil = Math.max(fin, perfil.subscriptionUntil || 0);
  }

  if (perfil.role === 'trainer' && huella) {
    const { ref, otras, yaEstaba } = await cuentasConLaMismaTarjeta(db, huella, uid);
    if (otras.length > 0) {
      // Esta tarjeta ya compró sus plazas. La cuenta entra igual, pero sin
      // plazas incluidas: para tener alumnos, el plan anual sin tope.
      datos.clientSlots = 0;
      datos.sharedCardWith = otras;
    }
    if (!yaEstaba) {
      await ref.set(
        {
          trainerUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  }

  // Fundador: solo la primera vez, y solo si SU campaña sigue abierta. Cada
  // rol tiene la suya, con su contador y su interruptor.
  if (!perfil.founderNumber) {
    const numero = await repartirNumeroDeFundador(db, uid, perfil.role);
    if (numero !== null) {
      datos.founderNumber = numero;
      datos.founderSince = Date.now();
    }
  }

  await db.collection('users').doc(uid).set(datos, { merge: true });
  return true;
}
