/*
 * Renombrar un ejercicio y que se entere quien lo tenía puesto.
 *
 * DE DÓNDE SALE ESTO
 *
 * El nombre del ejercicio está copiado dentro de cada rutina, y hasta ahora
 * corregir una falta en la biblioteca no cambiaba nada en el plan del alumno:
 * había que quitar el ejercicio y volverlo a poner, alumno por alumno, para que
 * les saliera bien escrito.
 *
 * Lo que se protege aquí no es solo que el nombre viaje, sino las dos fronteras
 * que hacen que valga la pena:
 *
 *  - NO SE TOCA EL HISTORIAL. En un entreno ya registrado el nombre es parte de
 *    un hecho fechado. Reescribirlo para que cuadre con el presente es
 *    falsificar el pasado.
 *  - NO SE ESCRIBE DE MÁS. Las funciones devuelven `null` cuando no cambia
 *    nada, y de ahí sale que un entrenador con cuarenta alumnos pague tres
 *    escrituras y no cuarenta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-renombrar-ejercicio.mjs
 */
import { readFileSync } from 'node:fs';
import { diasRenombrados, objetivosRenombrados } from '../lib/renombrarEjercicio.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const ej = (exerciseId, name) => ({ id: `r-${exerciseId}`, exerciseId, name, sets: 3, reps: '8' });
const dia = (nombre, ejercicios) => ({ id: `d-${nombre}`, name: nombre, exercises: ejercicios });

console.log('\nEl nombre nuevo llega a la rutina');
{
  const dias = [
    dia('Empuje', [ej('e1', 'Dominads'), ej('e2', 'Fondos')]),
    dia('Tirón', [ej('e1', 'Dominads')]),
  ];
  const salida = diasRenombrados(dias, 'e1', 'Dominadas');
  ok('se cambia en todos los días', salida?.[0].exercises[0].name === 'Dominadas' && salida?.[1].exercises[0].name === 'Dominadas');
  ok('y no se toca el de al lado', salida?.[0].exercises[1].name === 'Fondos');
  // No se muta lo que llega: el que llama compara antes y después para decidir
  // si escribe, y con mutación esa comparación siempre diría que no ha cambiado.
  ok('no se modifica lo que se recibe', dias[0].exercises[0].name === 'Dominads');
}

console.log('\nCuándo NO se escribe');
{
  // Este es el que ahorra el dinero: si el alumno no tiene el ejercicio, su
  // rutina no se reescribe.
  ok('sin ese ejercicio, nada', diasRenombrados([dia('Empuje', [ej('e2', 'Fondos')])], 'e1', 'X') === null);
  // Guardar sin cambiar el nombre no puede disparar cuarenta escrituras.
  ok('si ya se llamaba así, nada', diasRenombrados([dia('D', [ej('e1', 'Dominadas')])], 'e1', 'Dominadas') === null);
  ok('sin días, nada', diasRenombrados([], 'e1', 'X') === null);
  ok('sin días definidos, nada', diasRenombrados(undefined, 'e1', 'X') === null);
  ok('un día de descanso no estorba', diasRenombrados([{ id: 'd', name: 'Descanso', exercises: [] }], 'e1', 'X') === null);
  // Un nombre vacío borraría la etiqueta en el plan de todos. Ni se intenta.
  ok('un nombre vacío no se propaga', diasRenombrados([dia('D', [ej('e1', 'A')])], 'e1', '') === null);
}

console.log('\nLos objetivos del ciclo también llevan el nombre copiado');
{
  const objetivos = [
    { id: 'o1', ejercicioId: 'e1', nombre: 'Dominads', medida: 'reps', meta: 12 },
    { id: 'o2', ejercicioId: 'e2', nombre: 'Fondos', medida: 'reps', meta: 20 },
  ];
  const salida = objetivosRenombrados(objetivos, 'e1', 'Dominadas');
  ok('se cambia el que toca', salida?.[0].nombre === 'Dominadas');
  ok('y el otro se queda', salida?.[1].nombre === 'Fondos');
  ok('no se muta el original', objetivos[0].nombre === 'Dominads');
  ok('sin objetivos, nada', objetivosRenombrados(undefined, 'e1', 'X') === null);
  ok('si ya se llamaba así, nada', objetivosRenombrados(salida, 'e1', 'Dominadas') === null);
}

console.log('\nQué colecciones recorre');
{
  const f = lee('lib/firestore/renombrarEjercicio.ts');
  ok('las rutinas de los alumnos', /suyos\('routines'\)/.test(f));
  ok('las plantillas del entrenador', /suyos\('routineTemplates'\)/.test(f));
  ok('los objetivos de los ciclos', /suyos\('trainingCycles'\)/.test(f));
  /*
   * El historial NO. Si algún día alguien lo añade "por coherencia", que se
   * pare aquí: el nombre de un entreno de marzo es el de marzo.
   */
  ok('el historial no se reescribe', !/workoutLogs/.test(f), 'los entrenos ya registrados no se tocan');
  // Se filtra por entrenador: sin esto se leerían las rutinas de todo el mundo,
  // y las reglas de Firestore lo rechazarían entero.
  ok('se pide solo lo del entrenador', /where\('trainerId', '==', trainerId\)/.test(f));
}

console.log('\nEstá enganchado al guardar del ejercicio');
{
  const p = lee('app/(trainer)/exercises/[id].tsx');
  ok('se llama al propagar', /propagarNombreDeEjercicio\(\s*profile\.uid,\s*id,\s*campos\.name/.test(p));
  /*
   * Solo cuando hay algo que llevar: el nombre, o el vídeo.
   *
   * El vídeo entró en la cuenta cuando las rutinas diarias empezaron a traerse
   * los ejercicios de la biblioteca, porque esas SÍ copian el enlace dentro.
   * Los planes no: guardan el identificador y leen el vídeo de la biblioteca
   * cada vez. Lo que no puede pasar es que guardar la descripción cueste un
   * recorrido por las rutinas de los cuarenta alumnos.
   */
  ok('solo si el nombre ha cambiado', /nombreAlAbrir\.current !== campos\.name/.test(p));
  ok('o el vídeo', /videoAlAbrir\.current !== \(campos\.videoUrl \?\? ''\)/.test(p));
  ok('y se guarda cómo estaba al abrir',
    /nombreAlAbrir\.current = exercise\.name/.test(p) && /videoAlAbrir\.current = exercise\.videoUrl/.test(p));
  // Quitar el vídeo en la biblioteca también es una orden: dejar el viejo
  // puesto sería enseñar una técnica que el entrenador ha retirado.
  ok('quitar el vídeo también se propaga', /cambioElVideo \? campos\.videoUrl \?\? '' : undefined/.test(p));
  // Si falla la propagación, el ejercicio YA está guardado. Decir que no se
  // guardó nada haría que el entrenador lo escribiera otra vez.
  ok('un fallo al propagar no dice que no se guardó', /Guardado, pero no se pudo actualizar en las rutinas/.test(p));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
