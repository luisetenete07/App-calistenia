/*
 * Precios escritos en la app.
 *
 * La app no dice precios: ni cifras, ni "gratis", ni "desde X" (el porqué está
 * en lib/subscription.ts). Un precio escrito en una pantalla es un precio que
 * hay que volver a publicar cada vez que cambie y que se queda viejo en la
 * versión que el usuario no ha actualizado; y en iOS, además, es motivo de
 * rechazo.
 *
 * Esto vigila que no vuelva a colarse uno. Lo que sí puede llevar importes es
 * lo que un ALUMNO le paga a su ENTRENADOR: eso no es el precio de UDECA, es
 * la cuota que cada entrenador pone, y esa sí vive en la app.
 *
 *   node scripts/check-sin-precios.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const CARPETAS = ['app', 'components'];

/**
 * Ficheros donde un importe es legítimo, con el motivo.
 *
 * Todos son de lo mismo: la cuota que un entrenador le cobra a su alumno y los
 * pagos que registra. Ese dinero es suyo y la app tiene que enseñarlo.
 */
const PERMITIDOS = {
  'app/(trainer)/dashboard.tsx': 'cobros del entrenador a sus alumnos',
  'app/(trainer)/clients/[id]/index.tsx': 'la cuota de ese alumno',
  'app/(trainer)/clients/index.tsx': 'cuotas de la lista de alumnos',
  'app/(client)/dashboard.tsx': 'lo que el alumno le debe a su entrenador',
  'app/(client)/profile.tsx': 'su cuota con el entrenador',
  'components/ProgressCard.tsx': 'tarjeta de marca, sin precios de plataforma',
};

const PATRONES = [
  // Un importe en euros escrito a mano en el texto de una pantalla.
  { re: /\d+\s*€|€\s*\d|EUR\s*\d/, que: 'un importe' },
  // Las constantes de precio de la plataforma no pintan nada en una pantalla.
  {
    re: /ANNUAL_PRICE_EUR|ATHLETE_ANNUAL_EUR|COACH_FIRST_YEAR_EUR|ATHLETE_FIRST_YEAR_EUR|COACH_MONTHLY_EQUIV_EUR|ATHLETE_MONTHLY_EQUIV_EUR|COACH_FIRST_YEAR_MONTHLY_EUR|ATHLETE_FIRST_YEAR_MONTHLY_EUR|AHORRO_PRIMER_ANO_/,
    que: 'una constante de precio',
  },
  // "Gratis" tampoco: el alumno no le paga a UDECA, pero sí a su entrenador.
  { re: /\bgratis\b/i, que: '"gratis"' },
];

function* ficheros(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* ficheros(ruta);
    else if (/\.tsx?$/.test(nombre)) yield ruta;
  }
}

let sueltos = 0;
for (const carpeta of CARPETAS) {
  for (const ruta of ficheros(join(RAIZ, carpeta))) {
    const rel = ruta.slice(RAIZ.length);
    if (PERMITIDOS[rel]) continue;
    readFileSync(ruta, 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        // Los comentarios pueden hablar de precios: es donde se explica por qué
        // no los hay. Lo que no puede es enseñarlos.
        const limpia = linea.trim();
        if (limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('/*')) return;
        for (const { re, que } of PATRONES) {
          if (re.test(linea)) {
            console.log(`  ✖ ${rel}:${i + 1} — ${que}`);
            console.log(`      ${limpia.slice(0, 92)}`);
            sueltos++;
          }
        }
      });
  }
}

if (sueltos === 0) {
  console.log('✔ La app no dice ningún precio');
  console.log(
    `  (${Object.keys(PERMITIDOS).length} ficheros permitidos: cuotas de entrenador a alumno)`
  );
}
process.exit(sueltos === 0 ? 0 : 1);
