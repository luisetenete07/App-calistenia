/*
 * La ficha nutricional: que no vuelva a parpadear.
 *
 * LO QUE PASABA
 *
 * "En la sección de nutrición, al rehacer la ficha nutricional, parpadea mucho y
 * te tira de la app". Eran tres cosas distintas sumándose, y las tres solo
 * ocurren en el móvil, que es justo donde no se puede abrir una consola a mirar.
 *
 *  1. La lectura AUTOMÁTICA de pasos pedía el permiso al sistema. En Android ese
 *     diálogo manda la app al fondo y la devuelve al frente al cerrarse, y
 *     volver al frente es precisamente lo que dispara la lectura: el diálogo se
 *     daba de comer a sí mismo. Medido en un navegador con un sensor de mentira:
 *     diez idas y vueltas eran once diálogos y once lecturas.
 *  2. Cada lectura escuchaba el sensor cuatro segundos, escribía en Firestore y
 *     hacía que el padre recargara la sección entera. Sin plazo entre lecturas
 *     ni cerrojo, se solapaban.
 *  3. La carga del panel colgaba del objeto `profile` ENTERO, que es nuevo cada
 *     vez que se relee la cuenta. Guardar los macros relee la cuenta, así que
 *     guardar recargaba las seis consultas de la sección.
 *
 * Y el formulario era el único de la app montado a mano —una pantalla completa
 * dentro de un `Modal`, con su propia área segura y su propio teclado—, que en
 * Android no se comporta como una pantalla: el contenido salta al abrirse y el
 * teclado tapa los campos.
 *
 * Nada de esto da error. Se ve, y solo en un teléfono.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ficha-nutricional.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** Sin comentarios: lo que se comprueba es el código, no lo que se cuenta de él. */
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const pasos = sinComentarios(lee('components/ContadorDePasos.tsx'));
const panel = sinComentarios(lee('components/PanelDeNutricion.tsx'));
const progreso = sinComentarios(lee('app/(client)/progress.tsx'));

// =========================================================================
console.log('\n1 · La lectura automática no molesta a nadie');
// =========================================================================
ok(
  'en silencio solo MIRA el permiso, no lo pide',
  /enSilencio\s*\n?\s*\?\s*await Pedometer\.getPermissionsAsync\(\)/.test(pasos),
  'pedirlo abre el diálogo del sistema, y en Android eso vuelve a disparar la lectura'
);
ok(
  'y lo pide solo cuando lo ha pulsado alguien',
  /:\s*await Pedometer\.requestPermissionsAsync\(\)/.test(pasos)
);
ok(
  'una lectura a la vez',
  /if \(leyendoRef\.current\) return;/.test(pasos),
  'dos a la vez son dos suscripciones al sensor y dos escrituras del mismo dato'
);
ok(
  'y no más de una automática por minuto',
  /ESPERA_ENTRE_LECTURAS_MS = 60 \* 1000/.test(pasos) &&
    /ahora - ultimaAutomaticaRef\.current < ESPERA_ENTRE_LECTURAS_MS/.test(pasos),
  'volver al frente pasa muchas veces seguidas'
);
ok(
  'el aviso de "leyendo" es solo para quien lo pidió',
  /if \(!enSilencio\) setLeyendo\(true\);/.test(pasos) &&
    /if \(!enSilencio\) setLeyendo\(false\);/.test(pasos),
  'encenderlo solo ya hacía parpadear la tarjeta'
);
ok(
  'si el número no cambia, no se escribe (iPhone)',
  /if \(enSilencio && aGuardar === \(deHoy\?\.steps \?\? 0\)\) return;/.test(pasos)
);
ok(
  'si el número no cambia, no se escribe (Android)',
  /if \(enSilencio && sumado === \(deHoyAndroid\?\.steps \?\? 0\)\) return;/.test(pasos),
  'esta rama escribía siempre, y cada escritura recarga la sección entera'
);
// El motivo por el que existe `registrosRef`: sin él, guardar hacía recargar al
// padre, y la lista nueva volvía a disparar la lectura. Ver el comentario largo
// en el propio componente.
ok(
  'los pasos de hoy se leen por referencia, no de la prop',
  /const registrosRef = useRef\(registros\);/.test(pasos) &&
    !/\}, \[origen, registros\]\)/.test(pasos)
);

// =========================================================================
console.log('\n2 · Guardar la ficha no recarga media app');
// =========================================================================
ok(
  'la carga de nutrición depende de QUIÉN, no del perfil entero',
  /\}, \[uid, trainerId\]\);/.test(panel),
  'el objeto del perfil es nuevo en cada relectura de la cuenta'
);
ok(
  'y la de progreso, igual',
  /\}, \[uid, trainerId, cacheKey\]\);/.test(progreso)
);
ok(
  'guardar los macros sigue releyendo la cuenta',
  /await refreshProfile\(\);/.test(panel),
  'es lo que hace que los objetivos nuevos salgan al momento'
);

// =========================================================================
console.log('\n3 · El formulario es el mismo panel que el resto de la app');
// =========================================================================
ok(
  'la calculadora vive en un Sheet',
  /<Sheet\s+visible=\{calcOpen\}/.test(panel),
  'una pantalla completa dentro de un Modal no se comporta como una pantalla en Android'
);
ok(
  'sin un ScreenContainer metido dentro',
  !/ScreenContainer/.test(panel),
  'traía otra área segura, otro teclado y otro scroll dentro de la ventana del Modal'
);
ok(
  'y el formulario de comidas sigue en su Sheet',
  /<Sheet\s+visible=\{formOpen\}/.test(panel)
);

// =========================================================================
console.log('\n4 · Y lo que se calcula, se ve');
// =========================================================================
/*
 * "Funciona bien el proceso pero no se rehace con los nuevos datos aplicados".
 *
 * Con un plan del entrenador activo, lo que calcula el alumno SÍ se guarda
 * —comprobado contra la base de datos— pero mandaba el del coach y lo suyo no
 * salía por ninguna parte. Desde fuera eso es indistinguible de que no se haya
 * guardado nada, y encima el aviso decía "Macros actualizados" mientras la
 * pantalla enseñaba los mismos números de antes.
 *
 * Quién manda no cambia: el plan del coach. Lo que cambia es que lo del alumno
 * existe a la vista y que el aviso dice la verdad.
 */
ok(
  'con plan del coach, el aviso no promete que hayan cambiado los del día',
  /En tu día sigue mandando el plan de tu entrenador/.test(panel),
  'decir "Macros actualizados" sin que cambie nada en pantalla es lo que parecía un fallo'
);
ok(
  'y sin plan del coach, sigue siendo el de siempre',
  /: 'Macros actualizados'/.test(panel)
);
ok(
  'lo calculado por el alumno se enseña',
  /Lo que has calculado tú/.test(panel)
);
ok(
  'solo cuando manda el del coach (si no, ya son los del día)',
  /targets\.fromCoach && nt \?/.test(panel)
);
ok(
  'con sus cuatro cifras',
  /nt\.dailyCalories.*nt\.proteinG.*nt\.carbsG.*nt\.fatG/s.test(panel)
);
ok(
  'y diciendo qué pasa con ellos',
  /pasan a ser tus objetivos del día/.test(panel)
);

console.log(
  fallos === 0 ? '\n✔ La ficha nutricional se está quieta' : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
