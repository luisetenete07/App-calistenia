/*
 * Comprobación de los avisos de "se te ha olvidado subir el entreno".
 *
 * Aquí lo que se protege es la paciencia del alumno. Un fallo que avise de más
 * —en un día de descanso, a las tres de la mañana, o después de haber
 * registrado la sesión— no es un fallo visual: es la razón por la que alguien
 * silencia la app y ya no vuelve a leer ninguno de nuestros avisos, incluidos
 * los que sí importan.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-olvido.mjs
 */
import {
  DIAS_VISTA,
  diasPendientes,
  horasDeAviso,
  textoDeAviso,
  TOPE_AVISOS,
  ULTIMA_HORA,
} from '../lib/olvido.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


const DIA = 24 * 60 * 60 * 1000;
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}
const hora = (ts) => new Date(ts).getHours();
const aLas = (d, h, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.getTime();
};

// Miércoles 5 de agosto de 2026 (getDay() = 3 → lunes=0 lo hace el índice 2).
const MIERCOLES = new Date(2026, 7, 5, 0, 0, 0).getTime();

console.log('\nLas horas del día: una por hora, desde la suya y hasta las', ULTIMA_HORA);
{
  const horas = horasDeAviso(MIERCOLES, 18, aLas(MIERCOLES, 17, 30));
  comprueba('de 18 a 22 son cinco avisos', horas.length === 5, String(horas.length));
  comprueba('el primero es a las 18', hora(horas[0]) === 18, String(hora(horas[0])));
  comprueba('el último es a las 22', hora(horas[horas.length - 1]) === 22);
  comprueba(
    'van de hora en hora',
    horas.every((h, i) => i === 0 || h - horas[i - 1] === 60 * 60 * 1000)
  );
  comprueba('todos en punto', horas.every((h) => new Date(h).getMinutes() === 0));
}

console.log('\nLo que ya ha pasado no se reprograma');
{
  // Abre la app a las 20:10: no puede resucitar los avisos de las 18 y 19.
  const horas = horasDeAviso(MIERCOLES, 18, aLas(MIERCOLES, 20, 10));
  comprueba('a las 20:10 quedan 21 y 22', horas.length === 2, String(horas.length));
  comprueba('el primero es a las 21', hora(horas[0]) === 21);
  comprueba(
    'pasada la última hora, ninguno',
    horasDeAviso(MIERCOLES, 18, aLas(MIERCOLES, 23, 0)).length === 0
  );
}

console.log('\nNadie avisa de madrugada');
{
  const horas = horasDeAviso(MIERCOLES, 7, aLas(MIERCOLES, 6, 0));
  comprueba(
    'quien entrena a las 7 recibe de 7 a 22',
    horas.length === 16,
    String(horas.length)
  );
  comprueba('ninguno pasa de las 22', horas.every((h) => hora(h) <= ULTIMA_HORA));
  comprueba('ninguno antes de las 7', horas.every((h) => hora(h) >= 7));
}

console.log('\nSolo los días que toca entrenar');
{
  // Rutina semanal: lunes (0) empuje y jueves (3) tirón. Miércoles = descanso.
  const semanal = {
    id: 'r',
    days: [
      { id: 'a', name: 'Empuje', weekday: 0, exercises: [] },
      { id: 'b', name: 'Tirón', weekday: 3, exercises: [] },
    ],
    schedule: 'weekly',
  };
  const desdeMiercoles = diasPendientes(semanal, false, aLas(MIERCOLES, 10), DIAS_VISTA);
  comprueba(
    'del miércoles al sábado solo hay jueves',
    desdeMiercoles.length === 1 && desdeMiercoles[0].nombre === 'Tirón',
    JSON.stringify(desdeMiercoles.map((d) => d.nombre))
  );
  comprueba(
    'el miércoles (descanso) no entra',
    !desdeMiercoles.some((d) => d.dia === aLas(MIERCOLES, 0))
  );

  // Un día marcado explícitamente como descanso tampoco.
  const conDescanso = {
    id: 'r',
    days: [
      { id: 'a', name: 'Empuje', weekday: 2, exercises: [] },
      { id: 'b', name: 'Descanso', weekday: 3, isRest: true, exercises: [] },
    ],
    schedule: 'weekly',
  };
  const dd = diasPendientes(conDescanso, false, aLas(MIERCOLES, 10), 2);
  comprueba('el día de descanso del coach no avisa', !dd.some((d) => d.nombre === 'Descanso'));
}

console.log('\nSi ya ha entrenado hoy, hoy no se le dice nada');
{
  const semanal = {
    id: 'r',
    days: [{ id: 'a', name: 'Empuje', weekday: 2, exercises: [] }],
    schedule: 'weekly',
  };
  const sinEntrenar = diasPendientes(semanal, false, aLas(MIERCOLES, 10), 1);
  const entrenado = diasPendientes(semanal, true, aLas(MIERCOLES, 10), 1);
  comprueba('sin registrar, hoy avisa', sinEntrenar.length === 1);
  comprueba('ya registrado, hoy no', entrenado.length === 0);
}

console.log('\nA sensaciones no se avisa: ahí elige él');
{
  const flex = {
    id: 'r',
    days: [{ id: 'a', name: 'Fuerza', exercises: [] }],
    schedule: 'flex',
  };
  comprueba('sin días programados, nada', diasPendientes(flex, false, aLas(MIERCOLES, 10)).length === 0);
  comprueba('sin rutina, nada', diasPendientes(null, false, aLas(MIERCOLES, 10)).length === 0);
}

console.log('\nEl ciclo de días sueltos también rota');
{
  const ciclo = {
    id: 'r',
    days: [
      { id: 'a', name: 'Día 1', exercises: [] },
      { id: 'b', name: 'Día 2', exercises: [] },
      { id: 'c', name: 'Descanso', isRest: true, exercises: [] },
    ],
    schedule: 'cycle',
    cycleStartDate: MIERCOLES,
  };
  const tres = diasPendientes(ciclo, false, aLas(MIERCOLES, 10), 3);
  comprueba(
    'de tres días, dos entrenan y uno descansa',
    tres.length === 2 && tres.map((d) => d.nombre).join() === 'Día 1,Día 2',
    JSON.stringify(tres.map((d) => d.nombre))
  );
}

console.log('\nCon el plan en pausa no se avisa de nada');
{
  // La mitad de la promesa de una pausa: si el alumno está lesionado y aun así
  // le llega un aviso cada hora de un entreno que no puede hacer, la pausa no
  // sirve. Se comprueba que los días de pausa desaparecen y que los de después
  // vuelven solos, sin tener que quitar la pausa a mano.
  const todosLosDias = {
    id: 'r',
    days: [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      id: `d${w}`,
      name: `Día ${w}`,
      weekday: w,
      exercises: [],
    })),
    schedule: 'weekly',
  };
  const ahora = aLas(MIERCOLES, 10);
  const hoy = new Date(MIERCOLES).setHours(0, 0, 0, 0);
  const DIA = 24 * 60 * 60 * 1000;
  const sinPausa = diasPendientes(todosLosDias, false, ahora, 4);
  const pausa = [
    { desde: hoy, hasta: hoy + DIA, porQuien: 'alumno', creadaEn: hoy },
  ];
  const conPausa = diasPendientes(todosLosDias, false, ahora, 4, { pausas: pausa });
  comprueba('sin pausa se avisa de los cuatro días', sinPausa.length === 4);
  comprueba('con dos días de pausa quedan dos', conPausa.length === 2, String(conPausa.length));
  comprueba(
    'y los que quedan son los de después de la pausa',
    conPausa.every((d) => d.dia >= hoy + 2 * DIA)
  );
  comprueba(
    'una pausa ya terminada no quita nada',
    diasPendientes(todosLosDias, false, ahora, 4, {
      pausas: [{ desde: hoy - 5 * DIA, hasta: hoy - 3 * DIA, porQuien: 'coach', creadaEn: hoy }],
    }).length === 4
  );
}

console.log('\nLos textos no se repiten seguidos');
{
  const cuatro = [0, 1, 2, 3].map((i) => textoDeAviso(i, 'Empuje').titulo);
  comprueba('cuatro títulos distintos', new Set(cuatro).size === 4, cuatro.join(' · '));
  comprueba('el quinto vuelve al primero', textoDeAviso(4, 'Empuje').titulo === cuatro[0]);
  comprueba('llevan el nombre del día', textoDeAviso(1, 'Empuje').titulo.includes('Empuje'));
  comprueba(
    'ninguno riñe',
    [0, 1, 2, 3].every((i) => {
      const t = `${textoDeAviso(i, 'Empuje').titulo} ${textoDeAviso(i, 'Empuje').cuerpo}`.toLowerCase();
      return !/vago|excusa|fall|perd(i|í)|otra vez/.test(t);
    })
  );
}

console.log('\nY nunca se pasa del tope que admite el móvil');
{
  // Peor caso: alguien que entrena todos los días y madruga.
  const todosLosDias = {
    id: 'r',
    days: [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      id: `d${w}`,
      name: `Día ${w}`,
      weekday: w,
      exercises: [],
    })),
    schedule: 'weekly',
  };
  const dias = diasPendientes(todosLosDias, false, aLas(MIERCOLES, 5), DIAS_VISTA);
  const total = dias.reduce(
    (n, d) => n + horasDeAviso(d.dia, 6, aLas(MIERCOLES, 5)).length,
    0
  );
  comprueba(`el peor caso pide ${total} y el tope es ${TOPE_AVISOS}`, total > TOPE_AVISOS);
  comprueba('el tope cabe en los 64 de iOS con sitio de sobra', TOPE_AVISOS <= 32);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
