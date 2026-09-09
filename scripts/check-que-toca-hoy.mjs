/*
 * Qué sesión toca hoy (lib/schedule.ts · resolveSessionFor).
 *
 * POR QUÉ EXISTE
 *
 * Esta función decide lo primero que ve un alumno al abrir la app: qué entrena
 * hoy. No la probaba nada, y ahí llevaba tiempo escondido un fallo grande:
 *
 *   if (routine.schedule === 'cycle' && routine.cycleStartDate)
 *
 * Ese `&& routine.cycleStartDate` exigía que el plan tuviera FECHA DE INICIO.
 * Un plan por ciclos guardado sin ella —que es lo que queda cuando nadie toca
 * la fecha al crearlo— se caía a la rama semanal, y como un plan por ciclos no
 * tiene días de la semana asignados, acababa devolviendo siempre el primer día.
 *
 * El ciclo NO rotaba. Y lo peor: "reiniciar el ciclo" y "fijar el día de hoy"
 * parecían funcionar —la pantalla cambiaba de día— pero al volver a entrar
 * estaba otra vez el Día 1. Un botón que aparenta funcionar y no funciona es
 * peor que no tenerlo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-que-toca-hoy.mjs
 */
import { readFileSync } from 'node:fs';
import { resolveSessionFor } from '../lib/schedule.ts';
import { masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const HOY = Date.now();

/** Un ciclo de tres: entrenar, entrenar, descansar. */
const ciclo = (extra = {}) => ({
  id: 'r1',
  schedule: 'cycle',
  days: [
    { id: 'd1', name: 'Empuje' },
    { id: 'd2', name: 'Tirón' },
    { id: 'd3', name: 'Descanso', isRest: true },
  ],
  ...extra,
});

console.log('\nUn ciclo CON fecha de inicio');
{
  const r = ciclo({ cycleStartDate: masDias(HOY, -4) });
  // Cuatro días desde el inicio, ciclo de tres: 4 % 3 = 1 → el segundo día.
  const s = resolveSessionFor(r, HOY);
  ok('rota con los días', s.day?.name === 'Tirón', s.day?.name);
  ok('y lo dice', s.cycleLabel === 'Día 2 de 3', s.cycleLabel);
  // Mañana toca el descanso: 5 % 3 = 2.
  const m = resolveSessionFor(r, masDias(HOY, 1));
  ok('mañana toca descansar', m.isRest === true && m.day === null);
}

console.log('\nUn ciclo SIN fecha de inicio (el fallo que había)');
{
  const r = ciclo();
  const s = resolveSessionFor(r, HOY);
  // Sin ancla ninguna, el ciclo empieza hoy: Día 1. Lo que NO puede pasar es
  // que se comporte como un plan semanal y deje de ser un ciclo.
  ok('empieza por el Día 1', s.day?.name === 'Empuje', s.day?.name);
  ok('y sigue siendo un ciclo', s.cycleLabel === 'Día 1 de 3', s.cycleLabel ?? '(ninguna: se fue al modo semanal)');

  /*
   * LO IMPORTANTE: que el alumno pueda fijar el día aunque el coach no pusiera
   * fecha. Antes esto se ignoraba por completo, y por eso "fijar el día de hoy"
   * no sobrevivía a cerrar la pantalla.
   */
  const conAncla = resolveSessionFor(r, HOY, { alumno: { ancla: masDias(HOY, -1), decididaEn: HOY } });
  ok('el alumno puede fijar qué día es hoy', conAncla.day?.name === 'Tirón', conAncla.day?.name);
  ok('con su etiqueta', conAncla.cycleLabel === 'Día 2 de 3', conAncla.cycleLabel);

  // Y que ese día siga puesto mañana, corrido uno: es lo que significa que el
  // ciclo "continúe" desde ahí y no que se quede clavado.
  const manana = resolveSessionFor(r, masDias(HOY, 1), {
    alumno: { ancla: masDias(HOY, -1), decididaEn: HOY },
  });
  ok('y mañana el ciclo avanza solo', manana.isRest === true, manana.day?.name ?? 'descanso');
}

console.log('\nManda el último que lo decidió, no la fecha más grande');
{
  /*
   * ESTO ANTES SE DECIDÍA CON UN `Math.max` DE LAS DOS FECHAS, y de ahí salían
   * los fallos que traían a los alumnos de cabeza. Ahora cada ancla lleva la
   * fecha en que se decidió, y gana la más nueva. Ver lib/ciclo.ts.
   */
  const r = ciclo({ cycleStartDate: masDias(HOY, -4), cycleStartDateSetAt: masDias(HOY, -4) });
  const s = resolveSessionFor(r, HOY, { alumno: { ancla: HOY, decididaEn: HOY } });
  ok('lo que hizo el alumno gana a lo viejo del coach', s.day?.name === 'Empuje', s.day?.name);

  // Y al revés: si el coach reprograma el ciclo DESPUÉS, gana él.
  const r2 = ciclo({ cycleStartDate: HOY, cycleStartDateSetAt: HOY });
  const s2 = resolveSessionFor(r2, HOY, { alumno: { ancla: masDias(HOY, -10), decididaEn: masDias(HOY, -10) } });
  ok('y lo que reprograma el coach gana a lo viejo del alumno', s2.day?.name === 'Empuje', s2.day?.name);

  /*
   * EL FALLO Nº 3: una fecha de inicio FUTURA del coach.
   *
   * Un coach que el viernes deja el plan preparado "para el lunes" guardaba una
   * fecha mayor que la de hoy. Con `Math.max` ganaba siempre, así que el alumno
   * pulsaba "reiniciar el ciclo" y no pasaba absolutamente nada, ni ese día ni
   * ninguno de los siguientes.
   */
  const rFutura = ciclo({ cycleStartDate: masDias(HOY, 3), cycleStartDateSetAt: masDias(HOY, -1) });
  const s3 = resolveSessionFor(rFutura, HOY, { alumno: { ancla: HOY, decididaEn: HOY } });
  ok('una fecha futura del coach no tumba el reinicio del alumno',
    s3.day?.name === 'Empuje' && s3.cycleLabel === 'Día 1 de 3', s3.cycleLabel);

  // Sin fecha de cuándo lo puso el coach (rutinas de versiones anteriores),
  // gana el alumno: lo suyo es siempre un gesto reciente dentro de la app.
  const rVieja = ciclo({ cycleStartDate: masDias(HOY, 3) });
  ok('y sin saber cuándo lo puso el coach, gana el alumno',
    resolveSessionFor(rVieja, HOY, { alumno: { ancla: HOY, decididaEn: HOY } }).cycleLabel === 'Día 1 de 3');
}

console.log('\nY las pausas congelan el ciclo el día que toque');
{
  const r = ciclo({ cycleStartDate: masDias(HOY, -4) });
  const pausas = [
    { desde: masDias(HOY, -3), hasta: masDias(HOY, -2), porQuien: 'alumno', creadaEn: HOY },
  ];
  // Sin pausa el jueves sería el día 2 (4 % 3); con dos días congelados, el 3.
  ok('dos días de pausa retrasan el ciclo dos días',
    resolveSessionFor(r, HOY, { pausas }).cycleLabel === 'Día 3 de 3',
    resolveSessionFor(r, HOY, { pausas }).cycleLabel);

  /*
   * EL FALLO Nº 1: una pausa vieja seguía moviendo un ciclo que empezó DESPUÉS
   * de ella. El alumno pulsaba "reiniciar" y le salía un día cualquiera.
   */
  const reinicio = resolveSessionFor(r, HOY, {
    alumno: { ancla: HOY, decididaEn: HOY },
    pausas: [{ desde: masDias(HOY, -8), hasta: masDias(HOY, -7), porQuien: 'alumno', creadaEn: HOY }],
  });
  ok('una pausa anterior al reinicio no lo mueve', reinicio.cycleLabel === 'Día 1 de 3', reinicio.cycleLabel);
}

console.log('\nLos otros modos siguen igual');
{
  const semanal = {
    id: 'r2',
    schedule: 'weekly',
    days: [{ id: 'a', name: 'Día A', weekday: 0 }, { id: 'b', name: 'Día B', weekday: 2 }],
  };
  // El lunes toca lo del lunes. Se busca un lunes de verdad para no depender
  // del día en que se ejecute esto.
  let lunes = HOY;
  for (let i = 0; i < 7; i++) {
    if (new Date(masDias(HOY, i)).getDay() === 1) { lunes = masDias(HOY, i); break; }
  }
  ok('el semanal va por el día de la semana', resolveSessionFor(semanal, lunes).day?.name === 'Día A');
  ok('y un día sin nada asignado es descanso',
    resolveSessionFor(semanal, masDias(lunes, 1)).isRest === true);

  const flex = { id: 'r3', schedule: 'flex', days: [{ id: 'x', name: 'Suave' }] };
  ok('en Sensaciones no hay día impuesto', resolveSessionFor(flex, HOY).day === null);

  const gtg = { id: 'r4', schedule: 'gtg', days: [{ id: 'g', name: 'Dominadas' }] };
  ok('grease the groove nunca descansa', resolveSessionFor(gtg, HOY).isRest === false);

  ok('sin rutina no se inventa nada', resolveSessionFor(null, HOY).day === null);
  ok('ni con una rutina vacía', resolveSessionFor({ id: 'x', schedule: 'cycle', days: [] }, HOY).day === null);

  /*
   * DOS DÍAS EN EL MISMO DÍA DE LA SEMANA
   *
   * Nada lo impide, y a veces se hace a propósito. Pero la app solo puede
   * PROPONER uno —el primero—, así que el segundo existe y se puede entrenar
   * desde la tira de días, pero nunca sale como "lo de hoy" ni en los avisos.
   * Es una trampa silenciosa: el entrenador cree que ha programado dos sesiones
   * y el alumno solo ve una. Se avisa en el editor, y esto vigila que el aviso
   * siga estando.
   */
  const dosLunes = {
    id: 'r5',
    schedule: 'weekly',
    days: [{ id: 'a', name: 'Empuje', weekday: 0 }, { id: 'b', name: 'Core', weekday: 0 }],
  };
  ok('con dos días en el mismo día de la semana se propone el primero',
    resolveSessionFor(dosLunes, lunes).day?.name === 'Empuje');
  const editor = readFileSync(new URL('../app/(trainer)/clients/[id]/routine.tsx', import.meta.url), 'utf8');
  ok('y el editor se lo dice al entrenador',
    /diasRepetidos\.has\(day\.weekday\)/.test(editor) && /Otro día del plan cae en el mismo día/.test(editor));
}

console.log('\nUn día de descanso sigue teniendo nombre');
{
  /*
   * EL FALLO QUE ESTO CIERRA
   *
   * "A un alumno le pone que es día 6 de descanso en la pantalla principal, y
   * cuando entra en la pestaña de entrenamiento le sale día 3 de
   * entrenamiento".
   *
   * La cuenta del ciclo estaba bien en las dos: lo que fallaba era qué día ABRÍA
   * la pantalla de entreno. `day` se pone a null cuando toca descansar —y así
   * debe ser, para que nadie confunda un descanso con una sesión—, pero la
   * pantalla no tenía entonces ningún día que abrir y se caía al primero de
   * entrenar. Resultado: la portada decía descanso y el entreno enseñaba otro
   * día cargado, con sus ejercicios y su botón de empezar.
   *
   * `diaDeHoy` responde a la otra pregunta: en qué día del plan estás, se
   * entrene o no.
   */
  const r = ciclo({ cycleStartDate: masDias(HOY, -2) });
  const s = resolveSessionFor(r, HOY);
  ok('hoy toca descansar, así que no hay sesión', s.day === null && s.isRest === true);
  ok('pero se sabe qué día del plan es', s.diaDeHoy?.name === 'Descanso', s.diaDeHoy?.name);
  ok('y su etiqueta lo dice', s.cycleLabel === 'Día 3 de 3', s.cycleLabel);

  // En un día de entrenar, los dos apuntan a lo mismo.
  const entrena = resolveSessionFor(r, masDias(HOY, 1));
  ok('en un día de entrenar, los dos son el mismo', entrena.day?.id === entrena.diaDeHoy?.id);

  // Semanal: igual. Un día de la semana marcado como descanso por el coach.
  const semanal = {
    id: 'r9',
    schedule: 'weekly',
    days: [{ id: 'a', name: 'Empuje', weekday: 0 }, { id: 'z', name: 'Descanso', weekday: 1, isRest: true }],
  };
  let martes = HOY;
  for (let i = 0; i < 7; i++) {
    if (new Date(masDias(HOY, i)).getDay() === 2) { martes = masDias(HOY, i); break; }
  }
  const m = resolveSessionFor(semanal, martes);
  ok('en semanal, el descanso también tiene nombre', m.isRest === true && m.diaDeHoy?.name === 'Descanso');

  // Y sin plan no se inventa ninguno.
  ok('sin rutina no hay día', resolveSessionFor(null, HOY).diaDeHoy === null);
  ok('en Sensaciones tampoco', resolveSessionFor({ id: 'f', schedule: 'flex', days: [{ id: 'x' }] }, HOY).diaDeHoy === null);

  /*
   * Y que la pantalla de entreno lo USE: es donde se veía el fallo. Si vuelve a
   * caerse al primer día de entrenar, el alumno vuelve a ver dos días distintos
   * en dos pantallas de la misma app.
   */
  const entrenoTsx = readFileSync(new URL('../app/(client)/workout.tsx', import.meta.url), 'utf8');
  ok('la pantalla de entreno abre el día que toca, aunque sea de descanso',
    /session\.day\?\.id \?\?\s*\n?\s*session\.diaDeHoy\?\.id/.test(entrenoTsx));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
