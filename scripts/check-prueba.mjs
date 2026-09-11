/**
 * El plazo de la cuenta: cuánto dura y cuándo se le habla de pagar.
 *
 * Son dos reglas que se rompen solas si nadie las mira, y las dos por el mismo
 * motivo: los días viven en sitios que no pueden importarse entre sí, y el
 * momento del aviso es una condición de una línea que cualquiera puede
 * "simplificar" sin saber lo que quita.
 *
 * EL PRIMER AÑO. Es lo que se compra al entrar, para los DOS roles. Lo escribe
 * `payments-webhook/api/_alta.js`, que se despliega aparte y no comparte código
 * con la app, así que el número está copiado de `lib/planBase.ts`. Si uno se
 * queda atrás no falla nada visible: simplemente la cuenta dura otra cosa
 * distinta de la que promete la web.
 *
 * LA PRUEBA VIEJA. Quedan cuentas con una prueba de 28 días en marcha y el tope
 * sigue escrito en `firestore.rules`, que rechaza el registro con "missing or
 * insufficient permissions" si la app pide más de la cuenta. Mientras quede una
 * sola, este número se comprueba igual.
 *
 * EL AVISO. El de pantalla completa sale UNA vez, el último día. No el día que
 * se crea la cuenta: ese día el atleta acaba de pagar su año y lo que ha
 * comprado es justamente doce meses sin que le pidan nada más. La tarjeta del
 * plan sigue en su perfil todo ese tiempo para quien la busque; lo que no puede
 * pasar es que le salte a la cara sin haber empezado.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-prueba.mjs
 */
import { readFileSync } from 'node:fs';
import {
  DAY_MS,
  PRIMER_ANO_DIAS,
  TRIAL_DAYS,
  tocaElAvisoDelAtleta,
  trialUntil,
} from '../lib/planBase.ts';

const AHORA = Date.UTC(2026, 7, 15, 12, 0, 0);
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

/** Un atleta que empezó su prueba hace `dias` días. */
const atleta = (dias, extra = {}) => {
  const fin = trialUntil(AHORA - dias * DAY_MS);
  return {
    uid: 'at1',
    role: 'athlete',
    name: 'Sara',
    email: 'sara@demo.test',
    createdAt: AHORA - dias * DAY_MS,
    entryPaidAt: AHORA - dias * DAY_MS,
    subscriptionUntil: fin,
    trialEndsAt: fin,
    ...extra,
  };
};

console.log('\nSe entra pagando el primer año entero');
ok(`PRIMER_ANO_DIAS = ${PRIMER_ANO_DIAS}`, PRIMER_ANO_DIAS === 365, String(PRIMER_ANO_DIAS));

console.log('\nY el servidor escribe ese mismo año, para los dos roles');
{
  const alta = lee('payments-webhook/api/_alta.js');
  ok(
    `_alta.js escribe ${PRIMER_ANO_DIAS} días`,
    new RegExp(`PRIMER_ANO_DIAS\\s*=\\s*${PRIMER_ANO_DIAS}\\b`).test(alta),
    'es quien fija la fecha de fin cuando entra el pago'
  );
  // El año es de los DOS. Cuando esto valía solo para el atleta, el entrenador
  // pagaba su alta y se quedaba sin `subscriptionUntil`: su cuenta entraba
  // caducada y veía el muro de pago con el año recién pagado.
  const bloque = alta.slice(alta.indexOf('const datos = {'), alta.indexOf("if (perfil.role === 'trainer'"));
  ok(
    'sin distinguir el rol',
    bloque.includes('if (!perfil.entryPaidAt) {') && !bloque.includes("role === 'athlete'"),
    'el entrenador también compra su año al entrar'
  );
  // `trialEndsAt` es lo que hace que la app diga "estás de prueba" y que el
  // cron mande los avisos de prueba. Un año pagado no es una prueba.
  ok(
    'y sin marcar la cuenta como "de prueba"',
    !/datos\.trialEndsAt/.test(alta),
    'escribir trialEndsAt convertiría el año pagado en una prueba'
  );
}

console.log('\nLa prueba vieja sigue durando lo mismo donde queda escrita');
ok(`TRIAL_DAYS = ${TRIAL_DAYS}`, TRIAL_DAYS === 28, String(TRIAL_DAYS));
{
  const reglas = lee('firestore.rules');
  ok(
    `firestore.rules topa en (${TRIAL_DAYS} + 2) días`,
    reglas.includes(`(${TRIAL_DAYS} + 2) * 24 * 60 * 60 * 1000`),
    'el margen de 2 días absorbe el desfase de reloj del móvil'
  );
}

console.log('\nEl aviso a pantalla completa NO sale al crear la cuenta');
ok('recién dado de alta', !tocaElAvisoDelAtleta(atleta(0), AHORA));
ok('a los tres días', !tocaElAvisoDelAtleta(atleta(3), AHORA));
ok('a mitad de la prueba', !tocaElAvisoDelAtleta(atleta(Math.floor(TRIAL_DAYS / 2)), AHORA));
ok('faltando una semana', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 7), AHORA));
ok('faltando tres días', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 3), AHORA));
ok('faltando dos días', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 2), AHORA));

console.log('\nSale el último día, que es cuando hay algo que decidir');
ok('faltando un día', tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 1), AHORA));
ok('faltando unas horas', tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 0.2), AHORA));

console.log('\nY a quien no le toca, no le sale nunca');
ok(
  'al atleta que ya paga',
  !tocaElAvisoDelAtleta(
    atleta(TRIAL_DAYS - 1, { subscriptionUntil: AHORA + 300 * DAY_MS }),
    AHORA
  )
);
ok(
  'al entrenador (su tope son plazas, no días)',
  !tocaElAvisoDelAtleta({ ...atleta(TRIAL_DAYS - 1), role: 'trainer' }, AHORA)
);
ok(
  'al alumno de un coach (no paga plataforma)',
  !tocaElAvisoDelAtleta({ ...atleta(TRIAL_DAYS - 1), role: 'client' }, AHORA)
);
ok('sin perfil', !tocaElAvisoDelAtleta(null, AHORA));

console.log('\nY la pantalla usa esta misma regla, no una copia suya');
{
  const tarjeta = lee('components/UpgradeCard.tsx');
  ok(
    'UpgradePopup llama a tocaElAvisoDelAtleta',
    /esAtleta\s*&&\s*!tocaElAvisoDelAtleta\(profile\)/.test(tarjeta),
    'si esto se quita, el aviso vuelve a saltar el primer día'
  );
  // El cuerpo de UpgradeCard, sin el de UpgradePopup ni los comentarios que
  // los separan: entre las dos funciones está la constante del descanso.
  const cuerpoTarjeta = tarjeta.slice(
    tarjeta.indexOf('export function UpgradeCard('),
    tarjeta.indexOf('const CADA_CUANTO_MS')
  );
  ok(
    'la tarjeta del perfil no lleva esa condición',
    cuerpoTarjeta.length > 0 && !cuerpoTarjeta.includes('tocaElAvisoDelAtleta'),
    'en el perfil tiene que estar disponible todo el plazo'
  );
}

console.log(fallos === 0 ? '\n✔ El plazo dura lo que dice y el aviso llega cuando toca' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
