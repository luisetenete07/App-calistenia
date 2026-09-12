/*
 * El plan personalizado: tres modos, y el tercero es el del entrenador.
 *
 * QUÉ SE PROTEGE
 *
 * 1. QUE SIGAN SIENDO TRES. "Grease the groove" era un cuarto plan entero y no
 *    le pegaba: es una forma de entrenar UN día, no una programación. Se quitó
 *    del selector y vive donde significa algo — un día suelto dentro del plan
 *    personalizado y la rutina diaria—. Volver a meterlo es fácil y silencioso.
 *
 * 2. QUE LO PERSONALIZABLE SEA SOLO DEL TERCERO. Un plan semanal con
 *    vocabulario propio y permisos distintos sería el mismo producto contado de
 *    cuatro maneras.
 *
 * 3. QUE EL RIR SIGA SIENDO UN RIR. Media app lee ese campo —la media de
 *    esfuerzo del bloque, el plan de la semana, los informes—. Escribir ahí un
 *    "80 %" o una "B" no rompe nada a la vista: hace que todas esas medias
 *    salgan igual y sean falsas, que es mucho peor.
 *
 * 4. QUE LO QUE NO SE TOCA SE COMPORTE COMO SIEMPRE. Quien no abra el panel de
 *    personalización tiene que encontrarse exactamente la app de antes.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-plan-personalizado.mjs
 */
import { readFileSync } from 'node:fs';
import {
  comoLlamaALaRutina,
  comoLlamaALaSerie,
  comoRir,
  MAX_NIVELES,
  minutosEstimados,
  nivelesDeTexto,
  nivelesPropios,
  gruposDeLaRutina,
  opcionesDeEsfuerzo,
  POR_DEFECTO,
  rirComoValor,
  tocaPreguntarEsfuerzo,
} from '../lib/planPersonalizado.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const editorCoach = sinComentarios(lee('app/(trainer)/clients/[id]/routine.tsx'));
const editorAtleta = sinComentarios(lee('app/(client)/my-plan.tsx'));
const entreno = sinComentarios(lee('app/(client)/workout.tsx'));

// =========================================================================
console.log('\n1 · Tres modos, y el tercero se llama igual en los dos editores');
// =========================================================================
for (const [quien, texto] of [
  ['el editor del entrenador', editorCoach],
  ['el del atleta', editorAtleta],
]) {
  ok(
    `${quien}: sin "Grease the groove" como plan`,
    !/texto: 'Grease the groove'/.test(texto),
    'es una forma de entrenar un día, no una programación'
  );
  ok(
    `${quien}: el tercero es "Crear personalizado"`,
    /texto: 'Crear personalizado'/.test(texto)
  );
  // El selector es un array de opciones: si vuelve a haber cuatro, se nota aquí.
  const bloque = texto.slice(texto.indexOf('opciones={['), texto.indexOf('onChange={setSchedule}'));
  ok(
    `${quien}: son tres opciones`,
    (bloque.match(/valor: '/g) ?? []).length === 3,
    bloque.replace(/\s+/g, ' ').slice(0, 120)
  );
  // Y un plan viejo de ese modo se abre como personalizado, no a medias.
  ok(
    `${quien}: un plan viejo de gtg se abre como personalizado`,
    /modo === 'gtg' \? 'flex' : modo/.test(texto)
  );
}
// Lo que NO se ha quitado: el día suelto de grease the groove dentro del plan.
ok(
  'el día de grease the groove sigue existiendo dentro del plan',
  /toggleGtgDay/.test(editorCoach) && /day\.gtg/.test(editorCoach)
);

// =========================================================================
console.log('\n2 · Lo personalizable es SOLO del plan personalizado');
// =========================================================================
ok(
  'la configuración solo se guarda en ese modo',
  /personalizado: schedule === 'flex' \? configuracionAGuardar\(\) : undefined/.test(editorCoach),
  'guardarla en los otros dos sería dejar escrito un ajuste que no se aplica'
);
ok(
  'y en el entreno solo se lee en ese modo',
  /const perso = isFlex \? routine\?\.personalizado : undefined;/.test(entreno)
);

/*
 * Y QUE LO QUE SE GUARDA SEA LO QUE EL ENTRENADOR ACABA DE TOCAR.
 *
 * `handleSave` es un `useCallback`, así que congela todo lo que no esté
 * declarado en sus dependencias. Sin `perso` ahí, guardaba la configuración tal
 * y como estaba al ABRIR la pantalla —la de por defecto— y se perdían en
 * silencio la escala, el vocabulario y los permisos. Desde fuera se ve como
 * "la app no guarda los datos en personalizado", y es peor que un error: el
 * plan sí se guarda, así que nada avisa de que falta la mitad.
 */
{
  const deps = editorCoach.slice(
    editorCoach.indexOf('const handleSave = useCallback'),
    editorCoach.indexOf('const saveRoutineTemplate') > 0
      ? editorCoach.indexOf('const saveRoutineTemplate')
      : editorCoach.length
  );
  const lista = deps.slice(deps.lastIndexOf('}, ['), deps.lastIndexOf(']);') + 3);
  ok(
    'el guardado depende de la configuración tocada',
    /\bperso\b/.test(lista) && /\bnivelesTexto\b/.test(lista),
    lista.replace(/\s+/g, ' ').slice(0, 160)
  );
}
// Corregir un entreno que lleve el esfuerzo del día tiene que estar permitido:
// si no, la corrección entera se rechaza con "permisos insuficientes".
ok(
  'las reglas dejan corregir el esfuerzo de la sesión',
  /hasOnly\(\['exercises', 'durationMin', 'feedback', 'esfuerzo'\]\)/.test(lee('firestore.rules'))
);

// =========================================================================
console.log('\n3 · El RIR sigue siendo un RIR');
// =========================================================================
ok('un RIR se guarda como número', comoRir('rir', '3') === 3);
ok('"Fallo" son cero repeticiones', comoRir('rir', 'Fallo') === 0);
ok('"4+" son cuatro', comoRir('rir', '4+') === 4);
ok('un porcentaje NO se guarda como RIR', comoRir('porcentaje', '80 %') === undefined);
ok('una etiqueta propia tampoco', comoRir('propia', 'B') === undefined);
ok(
  'y el entreno escribe el número por ese camino',
  /rir: comoRir\(escala, valor\)/.test(entreno),
  'si se escribiera el valor a pelo, un "80 %" acabaría en el campo del RIR'
);
// Ida y vuelta: lo ya guardado se tiene que poder volver a enseñar marcado.
for (const [rir, etiqueta] of [
  [0, 'Fallo'],
  [1, '1'],
  [3, '3'],
  [4, '4+'],
  [9, '4+'],
]) {
  ok(`RIR ${rir} se vuelve a enseñar como "${etiqueta}"`, rirComoValor(rir) === etiqueta);
}
ok('sin RIR, nada marcado', rirComoValor(undefined) === undefined);

// =========================================================================
console.log('\n4 · Las escalas');
// =========================================================================
ok('RIR trae cinco opciones', opcionesDeEsfuerzo({ escala: 'rir', cuando: 'ejercicio' }).length === 5);
ok(
  'el porcentaje va de menos a más',
  opcionesDeEsfuerzo({ escala: 'porcentaje', cuando: 'ejercicio' })[0] === '60 %'
);
ok(
  'la propia respeta el orden del entrenador',
  opcionesDeEsfuerzo({ escala: 'propia', cuando: 'ejercicio', niveles: ['C', 'A', 'B'] }).join() ===
    'C,A,B',
  'reordenársela sería corregirle el método'
);
ok(
  'la propia vacía no deja la pantalla sin fichas',
  nivelesPropios({ escala: 'propia', cuando: 'ejercicio', niveles: [] }).length > 0
);
ok('se leen de un texto con comas', nivelesDeTexto(' A , B ,, C ').join() === 'A,B,C');
ok(
  `y no pasan de ${MAX_NIVELES}`,
  nivelesDeTexto('1,2,3,4,5,6,7,8').length === MAX_NIVELES,
  'más de seis fichas no caben en una fila de móvil'
);

// =========================================================================
console.log('\n5 · Cuándo se pregunta');
// =========================================================================
ok('por defecto, por ejercicio', tocaPreguntarEsfuerzo(undefined, 'ejercicio'));
ok('y no al terminar', !tocaPreguntarEsfuerzo(undefined, 'sesion'));
const alFinal = { esfuerzo: { escala: 'rir', cuando: 'sesion' } };
ok('con "al terminar", no por ejercicio', !tocaPreguntarEsfuerzo(alFinal, 'ejercicio'));
ok('y sí al terminar', tocaPreguntarEsfuerzo(alFinal, 'sesion'));
const nunca = { esfuerzo: { escala: 'rir', cuando: 'nunca' } };
ok('con "nunca", en ningún sitio', !tocaPreguntarEsfuerzo(nunca, 'ejercicio') && !tocaPreguntarEsfuerzo(nunca, 'sesion'));
// El de la sesión entera va en su propio campo del registro, no en el último
// ejercicio: son dos preguntas distintas.
ok(
  'el esfuerzo del día se guarda aparte',
  /\.\.\.\(esfuerzoSesion \? \{ esfuerzo: esfuerzoSesion \} : \{\}\)/.test(entreno)
);

// =========================================================================
console.log('\n6 · Lo que se ve antes de elegir');
// =========================================================================
ok(
  'sin plan personalizado, lo de siempre (intensidad y ejercicios)',
  POR_DEFECTO.ficha.intensidad === true && POR_DEFECTO.ficha.ejercicios === true
);
ok('y nada nuevo encendido sin pedirlo', POR_DEFECTO.ficha.duracion === false);
// La duración estimada: series × (trabajo + descanso), menos el último descanso.
ok('una rutina vacía no dura nada', minutosEstimados([]) === 0);
ok(
  'cuatro series con minuto de descanso son unos seis minutos',
  minutosEstimados([{ sets: 4, restSeconds: 60 }]) === 6,
  String(minutosEstimados([{ sets: 4, restSeconds: 60 }]))
);
ok(
  'y se suman los ejercicios',
  minutosEstimados([{ sets: 3 }, { sets: 3 }]) > minutosEstimados([{ sets: 3 }])
);
ok(
  'los grupos salen sin repetir y en orden',
  gruposDeLaRutina([
    { muscleGroup: 'Tirón' },
    { muscleGroup: 'Empuje' },
    { muscleGroup: 'Tirón' },
    {},
  ]).join() === 'Tirón,Empuje'
);

// =========================================================================
console.log('\n7 · El vocabulario');
// =========================================================================
ok('por defecto, Día y Serie', comoLlamaALaRutina() === 'Día' && comoLlamaALaSerie() === 'Serie');
ok(
  'y lo que escriba el entrenador',
  comoLlamaALaRutina({ vocabulario: { rutina: 'Bloque' } }) === 'Bloque'
);
ok(
  'un espacio en blanco no cuenta como nombre',
  comoLlamaALaRutina({ vocabulario: { rutina: '   ' } }) === 'Día',
  'si contara, el plan se quedaría sin palabra para sus rutinas'
);

// =========================================================================
console.log('\n8 · Lo que puede tocar el alumno');
// =========================================================================
ok('nada, mientras no se active', !POR_DEFECTO.permisos.saltar && !POR_DEFECTO.permisos.anadir);
ok(
  'saltar deja el ejercicio a la vista, no lo borra',
  /saltado: !ex\.saltado/.test(entreno) && /Saltado hoy/.test(entreno),
  'borrarlo dejaría una sesión que parece completa y un coach que no se entera'
);
ok(
  'y lo saltado no cuenta para el progreso',
  /ex\.saltado \? 0 : ex\.sets\.length/.test(entreno)
);
ok(
  'al reordenar se mueven las DOS listas',
  /setCombinedDay\(\{ \.\.\.dia, exercises: mueve\(dia\.exercises\) \}\)/.test(entreno) &&
    /setLog\(\(prev\) => mueve\(prev\)\)/.test(entreno),
  'la pantalla las cruza por posición: mover una sola enseña el objetivo de otro ejercicio'
);
ok(
  'lo añadido sale del propio plan, no de la nada',
  /routine\?\.days \?\? \[\]\)\s*\.flatMap\(\(d\) => d\.exercises\)/.test(entreno),
  'un ejercicio escrito a mano entra sin biblioteca, sin categoría y sin histórico'
);
ok(
  'y la rutina del entrenador no se toca',
  /const diaEditable = \(\): RoutineDay \| null =>/.test(entreno) &&
    /id: `propio-\$\{Date\.now\(\)\}`/.test(entreno),
  'lo que el alumno cambia es SU sesión de hoy'
);

console.log(
  fallos === 0 ? '\n✔ El plan personalizado es del entrenador, y solo ese' : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
