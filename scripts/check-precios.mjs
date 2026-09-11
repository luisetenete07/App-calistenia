/*
 * Los precios: los de verdad están en lib/subscription.ts y la web tiene que
 * decir esos mismos.
 *
 * POR QUÉ ESTO EXISTE
 *
 * El precio vive en DOS sitios que no pueden importarse entre sí: las
 * constantes de la app —que es lo que usan el servidor y los avisos— y el HTML
 * de la web, escrito a mano porque es una página estática sin compilar. El día
 * que se cambie uno y no el otro no falla nada: la página sigue cargando, el
 * botón sigue abriendo Stripe, y lo único que pasa es que alguien lee un precio
 * y se le cobra otro. Eso no se descubre probando; se descubre cuando alguien
 * pide que se le devuelva el dinero.
 *
 * Y hay una cuenta más que se rompe sola: el titular de la web es el precio POR
 * MES y el total del año va en pequeño debajo. Son dos cifras que tienen que
 * cuadrar entre sí, y la de arriba sale de dividir la de abajo. Cambiar el
 * total y olvidar el mensual deja la página anunciando un descuento que no
 * existe.
 *
 * QUÉ SE COMPRUEBA
 *
 *  1. Que los cuatro precios del modelo estén escritos y en el orden que tiene
 *     sentido (el primer año por debajo de la renovación).
 *  2. Que la web diga exactamente esas cifras, con su equivalente mensual bien
 *     calculado.
 *  3. Que no quede ni rastro de los precios viejos (1 € de alta, 28 días de
 *     prueba, 10 €/mes, 96 € al año).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-precios.mjs
 */
import { readFileSync } from 'node:fs';
import {
  AHORRO_PRIMER_ANO_ATLETA_PCT,
  AHORRO_PRIMER_ANO_COACH_PCT,
  ANNUAL_PRICE_EUR,
  ATHLETE_ANNUAL_EUR,
  ATHLETE_FIRST_YEAR_EUR,
  ATHLETE_FIRST_YEAR_MONTHLY_EUR,
  ATHLETE_MONTHLY_EQUIV_EUR,
  COACH_FIRST_YEAR_EUR,
  COACH_FIRST_YEAR_MONTHLY_EUR,
  COACH_MONTHLY_EQUIV_EUR,
} from '../lib/precios.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const web = lee('web/index.html');

/** Un importe como lo escribe la web: coma decimal y solo si hay céntimos. */
const euros = (n) => `${String(n).replace('.', ',')} €`;

// =========================================================================
console.log('\n1 · Los cuatro precios del modelo');
// =========================================================================
ok('el primer año del entrenador son 27 €', COACH_FIRST_YEAR_EUR === 27, String(COACH_FIRST_YEAR_EUR));
ok('el primer año del atleta son 17 €', ATHLETE_FIRST_YEAR_EUR === 17, String(ATHLETE_FIRST_YEAR_EUR));
ok('la renovación del entrenador son 180 €', ANNUAL_PRICE_EUR === 180, String(ANNUAL_PRICE_EUR));
ok('la renovación del atleta son 95 €', ATHLETE_ANNUAL_EUR === 95, String(ATHLETE_ANNUAL_EUR));
// Entrar tiene que costar menos que quedarse: es la promesa entera del primer
// año. Si alguna vez dejara de cumplirse, la web estaría mintiendo sola.
ok('entrar cuesta menos que renovar (entrenador)', COACH_FIRST_YEAR_EUR < ANNUAL_PRICE_EUR);
ok('entrar cuesta menos que renovar (atleta)', ATHLETE_FIRST_YEAR_EUR < ATHLETE_ANNUAL_EUR);

// =========================================================================
console.log('\n2 · El precio por mes sale de dividir el año, no de la cabeza');
// =========================================================================
ok(
  `el primer año del entrenador son ${euros(COACH_FIRST_YEAR_MONTHLY_EUR)} al mes`,
  COACH_FIRST_YEAR_MONTHLY_EUR === Math.round((COACH_FIRST_YEAR_EUR / 12) * 100) / 100,
  String(COACH_FIRST_YEAR_MONTHLY_EUR)
);
ok(
  `el primer año del atleta son ${euros(ATHLETE_FIRST_YEAR_MONTHLY_EUR)} al mes`,
  ATHLETE_FIRST_YEAR_MONTHLY_EUR === Math.round((ATHLETE_FIRST_YEAR_EUR / 12) * 100) / 100,
  String(ATHLETE_FIRST_YEAR_MONTHLY_EUR)
);
ok('la renovación del entrenador son 15 € al mes', COACH_MONTHLY_EQUIV_EUR === 15);
ok(
  `la renovación del atleta son ${euros(ATHLETE_MONTHLY_EQUIV_EUR)} al mes`,
  ATHLETE_MONTHLY_EQUIV_EUR === Math.round((ATHLETE_ANNUAL_EUR / 12) * 100) / 100
);

// =========================================================================
console.log('\n3 · Y la web dice exactamente eso');
// =========================================================================
const enLaWeb = [
  [`${euros(COACH_FIRST_YEAR_MONTHLY_EUR)}`, 'el mensual del primer año del entrenador'],
  [`${euros(ATHLETE_FIRST_YEAR_MONTHLY_EUR)}`, 'el mensual del primer año del atleta'],
  [`${COACH_FIRST_YEAR_EUR} €`, 'el total del primer año del entrenador'],
  [`${ATHLETE_FIRST_YEAR_EUR} €`, 'el total del primer año del atleta'],
  [`${ANNUAL_PRICE_EUR} €`, 'la renovación del entrenador'],
  [`${ATHLETE_ANNUAL_EUR} €`, 'la renovación del atleta'],
  [`${COACH_MONTHLY_EQUIV_EUR} €`, 'el mensual de la renovación del entrenador'],
  [`${euros(ATHLETE_MONTHLY_EQUIV_EUR)}`, 'el mensual de la renovación del atleta'],
];
for (const [texto, que] of enLaWeb) {
  ok(`${que} (${texto})`, web.includes(texto), 'no está escrito en web/index.html');
}

// El ahorro que anuncia la web tiene que ser el que sale de los precios. Es el
// número más fácil de dejar viejo: se escribe una vez y nadie lo recalcula.
{
  const anunciados = [...web.matchAll(/(\d{1,2})\s*%/g)].map((m) => Number(m[1]));
  const validos = new Set([AHORRO_PRIMER_ANO_ATLETA_PCT, AHORRO_PRIMER_ANO_COACH_PCT]);
  const raros = anunciados.filter((n) => !validos.has(n));
  ok(
    `los porcentajes de la web salen de los precios (${[...validos].join(' / ')})`,
    raros.length === 0,
    `sobra(n): ${raros.join(', ')}`
  );
}

// =========================================================================
console.log('\n4 · Y no queda ni rastro de los precios viejos');
// =========================================================================
const VIEJOS = [
  ['1 € de alta', /1\s*€\s*de alta/],
  ['darme de alta por 1 €', /de alta · 1 €/],
  ['los 28 días de prueba', /28 días/],
  ['los 10 €/mes del atleta', /10\s*€\s*\/?\s*mes/],
  ['los 96 € del año del atleta', /96\s*€/],
];
for (const [que, re] of VIEJOS) {
  ok(`sin ${que}`, !re.test(web), 'sigue en web/index.html');
}

console.log(fallos === 0 ? '\n✔ La web cobra lo que dice y dice lo que cobra' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
