/*
 * Comprobación del calendario de planificación (lib/cyclePlan.ts).
 *
 * Es cálculo puro de fechas, que es justo donde los fallos no se ven: un plan
 * con una semana de más o un bloque que empieza en martes parece correcto en
 * pantalla y descuadra el mes siguiente. Aquí se comprueba con números.
 *
 *   node --experimental-strip-types scripts/check-cycle-plan.mjs
 */
import {
  buildPlan,
  buildCycleTree,
  descendantIds,
  bandasDelPlan,
  planCalendar,
  planEndDate,
  planSummary,
  totalWeeks,
} from '../lib/cyclePlan.ts';
import { inicioDeLaSemana } from '../lib/fechas.ts';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const draft = {
  name: 'Temporada',
  // Un miércoles a propósito: el plan tiene que alinearse al lunes.
  startDate: new Date(2026, 7, 5, 13, 0, 0).getTime(),
  sessionsPerWeek: 4,
  blocks: [
    { name: 'Acumulación', weeks: 4, deloadLast: true },
    { name: 'Intensificación', weeks: 3, deloadLast: false },
  ],
};

console.log('\n1) Construcción del plan');
const plan = buildPlan(draft);
const macro = plan.find((p) => p.level === 'macro');
const mesos = plan.filter((p) => p.level === 'meso');
const micros = plan.filter((p) => p.level === 'micro');

comprueba('7 semanas en total', totalWeeks(draft) === 7);
comprueba('1 macro + 2 mesos + 7 micros', plan.length === 10, `son ${plan.length}`);
comprueba('el macro empieza en lunes', new Date(macro.startDate).getDay() === 1);
comprueba(
  'el macro dura exactamente 7 semanas',
  macro.endDate - macro.startDate === 7 * WEEK - DAY
);
comprueba('planEndDate coincide con el macro', planEndDate(draft) === macro.endDate);
comprueba(
  'los bloques encajan sin huecos ni solapes',
  mesos[1].startDate === mesos[0].endDate + DAY
);
comprueba('el último micro termina donde el macro', micros[6].endDate === macro.endDate);
comprueba(
  'las semanas son consecutivas',
  micros.every((m, i) => i === 0 || m.startDate === micros[i - 1].endDate + DAY)
);
comprueba(
  'solo la 4ª semana es de descarga',
  micros.filter((m) => m.isDeload).length === 1 && micros[3].isDeload === true
);
comprueba('en descarga se pide un entreno menos', micros[3].targetSessions === 3);
comprueba('el resto de semanas piden 4', micros[0].targetSessions === 4);
comprueba('cada micro cuelga de su meso', micros[4].parentKey === mesos[1].key);
comprueba('cada meso cuelga del macro', mesos.every((m) => m.parentKey === 'macro'));

console.log('\n2) Árbol y descendientes');
// Simula lo que devolvería Firestore: ids de verdad y parentId resueltos.
const ids = new Map(plan.map((p, i) => [p.key, `c${i}`]));
const guardados = plan.map((p, i) => ({
  id: `c${i}`,
  trainerId: 't1',
  clientId: 'a1',
  level: p.level,
  name: p.name,
  parentId: p.parentKey ? ids.get(p.parentKey) : undefined,
  orderIndex: p.orderIndex,
  startDate: p.startDate,
  endDate: p.endDate,
  isDeload: p.isDeload,
  targetSessions: p.targetSessions,
  createdAt: 0,
  updatedAt: 0,
}));

const raiz = buildCycleTree(guardados);
comprueba('una sola raíz (el macro)', raiz.length === 1);
comprueba('el macro tiene 2 bloques', raiz[0].children.length === 2);
comprueba('el primer bloque tiene 4 semanas', raiz[0].children[0].children.length === 4);
comprueba(
  'las semanas salen en orden',
  raiz[0].children[0].children.map((n) => n.cycle.orderIndex).join() === '1,2,3,4'
);
comprueba('descendientes del macro: 9', descendantIds(guardados, 'c0').length === 9);

const huerfano = { ...guardados[1], id: 'x1', parentId: 'no-existe' };
comprueba(
  'un ciclo con padre inexistente no desaparece',
  buildCycleTree([...guardados, huerfano]).length === 2
);

console.log('\n3) Calendario y cumplimiento');
const lunes = inicioDeLaSemana(draft.startDate);
// Semana 1: entrena 4 días (cumple). Semana 2: solo 1. Semana 3: ninguno.
const logs = [
  ...[0, 1, 3, 5].map((d) => ({ date: lunes + d * DAY })),
  { date: lunes + WEEK + 2 * DAY },
];
const semanas = planCalendar(guardados[0], guardados, logs, lunes + WEEK + 3 * DAY);

comprueba('7 filas, una por semana', semanas.length === 7);
comprueba('la semana 1 cuenta 4 entrenos', semanas[0].done === 4);
comprueba('la semana 2 cuenta 1', semanas[1].done === 1);
comprueba('la semana 3 cuenta 0', semanas[2].done === 0);
comprueba('la meta de la semana 1 es 4', semanas[0].target === 4);
comprueba('la semana 4 va marcada como descarga', semanas[3].isDeload === true);
comprueba('la semana 1 ya es pasado', semanas[0].isPast === true);
comprueba('la semana 2 es la actual', semanas[1].isCurrent === true);
comprueba('la semana 3 no es pasado', semanas[2].isPast === false);
comprueba(
  'cada bloque marca su primera semana',
  semanas.filter((w) => w.blockStart).length === 2
);
comprueba('la semana 5 pertenece al segundo bloque', semanas[4].block?.name === 'Intensificación');
comprueba(
  'los días entrenados caen donde toca',
  semanas[0].days.join() === 'true,true,false,true,false,true,false'
);

const resumen = planSummary(semanas, lunes + WEEK + 3 * DAY);
comprueba('vamos por la semana 2 de 7', resumen.week === 2 && resumen.totalWeeks === 7);
comprueba('5 entrenos hechos de 8 previstos', resumen.done === 5 && resumen.planned === 8);
comprueba(
  'cumplimiento 63 %',
  Math.round(resumen.adherence * 100) === 63,
  String(Math.round(resumen.adherence * 100))
);
comprueba('el bloque actual es Acumulación', resumen.block?.name === 'Acumulación');

console.log('\n3b) La temporada en bandas');
{
  // Una lista de veinticuatro semanas no dice en qué punto de la temporada se
  // está, que es justo lo que se viene a mirar. En bandas sí.
  const bandas = bandasDelPlan(semanas);
  comprueba('una banda por bloque', bandas.length === 2, String(bandas.length));
  comprueba('con su nombre', bandas[0].nombre === 'Acumulación' && bandas[1].nombre === 'Intensificación');
  comprueba('la primera son 4 semanas', bandas[0].semanas === 4);
  comprueba('la segunda son 3', bandas[1].semanas === 3);
  comprueba('las semanas se numeran seguidas', bandas[0].desde === 1 && bandas[1].desde === 5);
  comprueba('la descarga cae en la última de la primera', bandas[0].descargas.join() === 'false,false,false,true');
  comprueba('la semana 1 se cumplió', bandas[0].hechas[0] === true);
  comprueba('la 2 no llegó a la meta', bandas[0].hechas[1] === false);
  comprueba('hoy está en la primera banda, segunda semana', bandas[0].actual === 1);
  comprueba('y no en la segunda banda', bandas[1].actual === -1);
  comprueba(
    'todas las semanas del plan están en alguna banda',
    bandas.reduce((n, b) => n + b.semanas, 0) === semanas.length
  );
}

console.log('\n4) Dos planes seguidos no se mezclan');
const segundo = guardados.map((c, i) => ({
  ...c,
  id: `s${i}`,
  parentId: c.parentId ? `s${Number(c.parentId.slice(1))}` : undefined,
  startDate: c.startDate + 7 * WEEK,
  endDate: c.endDate + 7 * WEEK,
}));
const soloPrimero = planCalendar(guardados[0], [...guardados, ...segundo], logs, lunes);
comprueba('el calendario del primer plan sigue teniendo 7 semanas', soloPrimero.length === 7);
comprueba(
  'ninguna semana del primero apunta a un bloque del segundo',
  soloPrimero.every((w) => !w.block || w.block.id.startsWith('c'))
);

console.log('\n5) El domingo en que cambia la hora no corre las fechas un día');
{
  /*
   * LOS DOS DOMINGOS DEL AÑO QUE NO DURAN 24 HORAS
   *
   * Sumando 7 × 86.400.000 milisegundos, la semana que cruza el cambio de hora
   * cae a las 23:00 del SÁBADO en vez de a las 00:00 del domingo. Una
   * planificación de doce semanas cruza casi siempre uno de esos domingos, así
   * que el plan decía "hasta el 25 de octubre" y en pantalla ponía el 24, y el
   * último día del bloque se daba por terminado una hora después de empezar.
   *
   * Se comprueba en la zona horaria de España, que es donde vive el negocio:
   * en UTC no hay cambio de hora y este fallo no se ve nunca.
   */
  const antes = process.env.TZ;
  process.env.TZ = 'Europe/Madrid';
  try {
    // Arranca dos semanas antes del cambio de hora de octubre de 2026.
    const plan = buildPlan({
      name: 'Otoño',
      startDate: new Date(2026, 9, 12, 10, 0, 0).getTime(),
      sessionsPerWeek: 3,
      blocks: [{ name: 'Bloque', weeks: 4, deloadLast: false }],
    });
    const aMedianoche = (t) => {
      const d = new Date(t);
      return d.getHours() === 0 && d.getMinutes() === 0;
    };
    comprueba(
      'todas las fechas del plan caen a medianoche',
      plan.every((c) => aMedianoche(c.startDate) && aMedianoche(c.endDate)),
      plan.filter((c) => !aMedianoche(c.startDate) || !aMedianoche(c.endDate))
        .map((c) => `${c.name}: ${new Date(c.startDate)} → ${new Date(c.endDate)}`)
        .join(' | ')
    );
    const micros = plan.filter((c) => c.level === 'micro');
    comprueba(
      'y cada semana empieza en lunes',
      micros.every((m) => new Date(m.startDate).getDay() === 1),
      micros.map((m) => new Date(m.startDate).toDateString()).join(' | ')
    );
    comprueba(
      'la última semana acaba el domingo que le toca',
      new Date(micros[micros.length - 1].endDate).toDateString() === 'Sun Nov 08 2026',
      new Date(micros[micros.length - 1].endDate).toDateString()
    );

    // Y el calendario que se pinta a partir de eso tiene las semanas justas.
    const semanas = planCalendar(
      { id: 'm', level: 'macro', startDate: plan[0].startDate, endDate: plan[0].endDate, createdAt: 0 },
      [],
      [],
      plan[0].startDate
    );
    comprueba('el calendario saca las cuatro semanas', semanas.length === 4, String(semanas.length));
  } finally {
    if (antes === undefined) delete process.env.TZ;
    else process.env.TZ = antes;
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
