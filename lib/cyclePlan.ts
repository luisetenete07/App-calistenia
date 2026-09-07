import { inicioDeLaSemana, inicioDelDia, masDias } from './fechas';
import { t, frase  } from './idioma';
import type { CycleLevel, TrainingCycle, WeekPlanEntry, WorkoutLog } from './types';

/**
 * Planificación por bloques: de "quiero 12 semanas en 3 bloques" a un
 * macrociclo con sus mesociclos y sus microciclos ya colocados en el calendario.
 *
 * Todo lo de aquí es cálculo puro (sin Firestore ni React) para poder probarlo
 * y para que la pantalla no tenga que saber de fechas. Quien lo guarda es
 * `lib/firestore/cycles.ts`.
 *
 * Dos decisiones que sostienen el resto:
 *
 *  - **El microciclo es una semana natural** (lunes a domingo). No porque no
 *    existan micros de 10 días, sino porque el alumno vive en semanas y un
 *    calendario que no empieza en lunes no se entiende de un vistazo. Quien
 *    necesite otra cosa puede seguir creando ciclos sueltos a mano.
 *  - **Saltarse un entreno no mueve el plan.** Las fechas son las que el coach
 *    puso; lo que cambia es el cumplimiento que se ve en el calendario. Un plan
 *    que se desplaza solo deja de ser un plan a la tercera semana.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * LAS FECHAS SE MUEVEN CON `masDias`, NO SUMANDO MILISEGUNDOS
 *
 * Los dos domingos del año en que cambia la hora duran 23 o 25 horas. Sumando
 * 7 × 86.400.000 el resultado cae a las 23:00 del día ANTERIOR, y una
 * planificación de doce semanas casi siempre cruza uno de esos domingos: el
 * plan decía "hasta el 5 de octubre" y en la pantalla ponía el 4, y el último
 * día del bloque se daba por terminado una hora después de empezar.
 *
 * La constante se queda para la única cuenta donde sí es lo correcto: restar
 * dos lunes ya redondeados a medianoche para saber cuántas semanas hay en
 * medio, que va con `Math.round` y absorbe la hora de más o de menos.
 */

/** Un bloque del plan: el mesociclo y sus semanas. */
export interface PlanBlock {
  name: string;
  weeks: number;
  /** La última semana del bloque es de descarga. */
  deloadLast: boolean;
  goal?: string;
}

export interface PlanDraft {
  /** Nombre del macrociclo. */
  name: string;
  /** Arranque del plan (se alinea al lunes de esa semana). */
  startDate: number;
  blocks: PlanBlock[];
  /** Entrenos previstos por semana; se convierte en la meta de cada micro. */
  sessionsPerWeek: number;
  goal?: string;
}

/** Ciclo ya calculado, aún sin id de Firestore. */
export interface PlannedCycle {
  key: string;
  parentKey?: string;
  level: CycleLevel;
  name: string;
  startDate: number;
  endDate: number;
  orderIndex: number;
  isDeload?: boolean;
  targetSessions?: number;
  goal?: string;
  /** Solo microciclos que vienen de una plantilla ya programada. */
  weekPlan?: WeekPlanEntry[];
}

/** Plantillas de arranque. La estructura clásica de acumular → apretar → soltar. */
export const PLAN_TEMPLATES: { id: string; label: string; hint: string; blocks: PlanBlock[] }[] = [
  {
    id: 'fuerza12',
    label: 'Fuerza · 12 semanas',
    hint: '3 bloques de 4 semanas, con descarga al final de cada uno',
    blocks: [
      { name: 'Acumulación', weeks: 4, deloadLast: true, goal: 'Volumen y técnica' },
      { name: 'Intensificación', weeks: 4, deloadLast: true, goal: 'Más carga, menos series' },
      { name: 'Realización', weeks: 4, deloadLast: true, goal: 'Máximos y skills' },
    ],
  },
  {
    id: 'hipertrofia8',
    label: 'Hipertrofia · 8 semanas',
    hint: '2 bloques de 4 semanas',
    blocks: [
      { name: 'Base', weeks: 4, deloadLast: true, goal: 'Subir volumen semanal' },
      { name: 'Choque', weeks: 4, deloadLast: true, goal: 'Cerca del fallo' },
    ],
  },
  {
    id: 'skill16',
    label: 'Skills · 16 semanas',
    hint: '4 bloques de 4 semanas para una progresión larga',
    blocks: [
      { name: 'Preparación', weeks: 4, deloadLast: true },
      { name: 'Progresión I', weeks: 4, deloadLast: true },
      { name: 'Progresión II', weeks: 4, deloadLast: true },
      { name: 'Consolidación', weeks: 4, deloadLast: true },
    ],
  },
];

/**
 * El nombre visible de un ciclo.
 *
 * Los bloques y las semanas se guardan con el nombre que les pone la app
 * ("Semana 3", "Semana 4 · descarga"), y ese nombre es del entrenador: puede
 * renombrarlos cuando quiera. Por eso se guarda en español y se traduce AQUÍ,
 * al pintarlo: traducirlo al crearlo dejaría inglés metido en los datos de un
 * alumno que mañana vuelve al español, y encima no arreglaría los planes que
 * ya existen.
 */
export function nombreDeCiclo(nombre: string | undefined): string {
  const n = (nombre ?? '').trim();
  const m = /^Semana\s+(\d+)(\s*·\s*descarga)?$/i.exec(n);
  if (!m) return n;
  return m[2] ? frase`Semana ${Number(m[1])} · descarga` : frase`Semana ${Number(m[1])}`;
}

export function totalWeeks(draft: PlanDraft): number {
  return draft.blocks.reduce((n, b) => n + Math.max(1, b.weeks), 0);
}

export function planEndDate(draft: PlanDraft): number {
  return masDias(inicioDeLaSemana(draft.startDate), totalWeeks(draft) * 7 - 1);
}

/**
 * Convierte el borrador en la lista de ciclos a crear: 1 macro + 1 meso por
 * bloque + 1 micro por semana. Las fechas encajan sin huecos ni solapes, que es
 * justo lo que nadie acierta a mano cuando hay 16 semanas.
 */
export function buildPlan(draft: PlanDraft): PlannedCycle[] {
  const start = inicioDeLaSemana(draft.startDate);
  const semanas = totalWeeks(draft);
  const out: PlannedCycle[] = [];

  out.push({
    key: 'macro',
    level: 'macro',
    name: draft.name.trim() || 'Temporada',
    startDate: start,
    endDate: masDias(start, semanas * 7 - 1),
    orderIndex: 1,
    goal: draft.goal?.trim() || undefined,
    targetSessions: draft.sessionsPerWeek > 0 ? draft.sessionsPerWeek * semanas : undefined,
  });

  let cursor = start;
  draft.blocks.forEach((block, bi) => {
    const weeks = Math.max(1, block.weeks);
    const mesoKey = `meso-${bi}`;
    out.push({
      key: mesoKey,
      parentKey: 'macro',
      level: 'meso',
      name: block.name.trim() || `Bloque ${bi + 1}`,
      startDate: cursor,
      endDate: masDias(cursor, weeks * 7 - 1),
      orderIndex: bi + 1,
      goal: block.goal?.trim() || undefined,
      targetSessions: draft.sessionsPerWeek > 0 ? draft.sessionsPerWeek * weeks : undefined,
    });

    for (let w = 0; w < weeks; w++) {
      const esDescarga = block.deloadLast && w === weeks - 1;
      const inicio = masDias(cursor, w * 7);
      out.push({
        key: `${mesoKey}-w${w}`,
        parentKey: mesoKey,
        level: 'micro',
        name: `Semana ${w + 1}${esDescarga ? ' · descarga' : ''}`,
        startDate: inicio,
        endDate: masDias(inicio, 6),
        orderIndex: w + 1,
        isDeload: esDescarga || undefined,
        // En descarga se entrena menos: una sesión menos, nunca menos de dos.
        targetSessions:
          draft.sessionsPerWeek > 0
            ? esDescarga
              ? Math.max(2, draft.sessionsPerWeek - 1)
              : draft.sessionsPerWeek
            : undefined,
      });
    }
    cursor = masDias(cursor, weeks * 7);
  });

  return out;
}

// ---------------------------------------------------------------------------
// Lectura: del listado plano de Firestore al árbol y al calendario.
// ---------------------------------------------------------------------------

export interface CycleNode {
  cycle: TrainingCycle;
  children: CycleNode[];
}

/**
 * Agrupa los ciclos por `parentId`. Los que no tienen padre (o cuyo padre ya no
 * existe) quedan en la raíz: borrar un macro nunca esconde a sus hijos.
 */
export function buildCycleTree(cycles: TrainingCycle[]): CycleNode[] {
  const porId = new Map(cycles.map((c) => [c.id, { cycle: c, children: [] as CycleNode[] }]));
  const raiz: CycleNode[] = [];
  for (const nodo of porId.values()) {
    const padre = nodo.cycle.parentId ? porId.get(nodo.cycle.parentId) : undefined;
    if (padre && padre !== nodo) padre.children.push(nodo);
    else raiz.push(nodo);
  }
  const ordenar = (list: CycleNode[]) => {
    list.sort((a, b) => {
      const ao = a.cycle.orderIndex ?? 0;
      const bo = b.cycle.orderIndex ?? 0;
      if (ao !== bo) return ao - bo;
      return (a.cycle.startDate ?? a.cycle.createdAt) - (b.cycle.startDate ?? b.cycle.createdAt);
    });
    list.forEach((n) => ordenar(n.children));
  };
  ordenar(raiz);
  return raiz;
}

/** Descendientes de un ciclo (para borrar un plan entero, por ejemplo). */
export function descendantIds(cycles: TrainingCycle[], rootId: string): string[] {
  const hijos = new Map<string, string[]>();
  for (const c of cycles) {
    if (!c.parentId) continue;
    hijos.set(c.parentId, [...(hijos.get(c.parentId) ?? []), c.id]);
  }
  const salida: string[] = [];
  const bajar = (id: string) => {
    for (const h of hijos.get(id) ?? []) {
      salida.push(h);
      bajar(h);
    }
  };
  bajar(rootId);
  return salida;
}

export interface CalendarWeek {
  /** Lunes de la semana. */
  start: number;
  end: number;
  /** Número de semana dentro del plan (1..n). */
  index: number;
  /** Microciclo que cubre esta semana, si lo hay. */
  micro: TrainingCycle | null;
  /** Bloque (mesociclo) al que pertenece. */
  block: TrainingCycle | null;
  /** Primera semana de su bloque: la fila que lleva la etiqueta. */
  blockStart: boolean;
  /** Cuántas semanas dura el bloque (para pintar la banda). */
  blockWeeks: number;
  isDeload: boolean;
  done: number;
  target: number | null;
  isCurrent: boolean;
  isPast: boolean;
  /** Un día por posición (lunes..domingo): true si entrenó. */
  days: boolean[];
}

function weeksBetween(desde: number, hasta: number): number {
  return Math.max(1, Math.round((inicioDeLaSemana(hasta) - inicioDeLaSemana(desde)) / WEEK_MS) + 1);
}

/**
 * Calendario del plan, semana a semana: qué bloque toca, si es descarga y
 * cuántos entrenos hizo el alumno frente a los previstos.
 *
 * Se construye recorriendo las semanas del macro (o del propio ciclo si no hay
 * macro), no la lista de micros: así las semanas sin microciclo creado también
 * salen, en vez de dejar un hueco raro en mitad del calendario.
 */
export function planCalendar(
  root: TrainingCycle,
  all: TrainingCycle[],
  logs: WorkoutLog[],
  now = Date.now()
): CalendarWeek[] {
  // Solo lo que cuelga de ESTE plan: si el coach tiene dos macros seguidos, las
  // semanas del otro no pueden colarse en este calendario.
  const dentro = new Set([root.id, ...descendantIds(all, root.id)]);
  const propios = all.filter((c) => dentro.has(c.id));
  const micros = propios.filter((c) => c.level === 'micro' && c.startDate);

  const desde = inicioDeLaSemana(root.startDate ?? root.createdAt);
  const finHijos = propios.reduce<number>((max, c) => Math.max(max, c.endDate ?? 0), 0);
  const hasta = Math.max(root.endDate ?? finHijos, masDias(desde, 6));
  const semanas = weeksBetween(desde, hasta);

  const diasEntrenados = new Set(logs.map((l) => inicioDelDia(l.date)));
  const semanaActual = inicioDeLaSemana(now);

  const bloques = propios
    .filter((c) => c.level === 'meso' && c.startDate)
    .sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));

  const filas: CalendarWeek[] = [];
  for (let i = 0; i < semanas; i++) {
    const start = masDias(desde, i * 7);
    const end = masDias(start, 6);
    const micro = micros.find((m) => inicioDeLaSemana(m.startDate!) === start) ?? null;
    // El bloque sale del padre del micro; si esa semana no tiene micro creado,
    // se busca por fechas para que la banda del bloque no se corte.
    const porPadre = micro?.parentId
      ? propios.find((c) => c.id === micro.parentId)
      : undefined;
    const porFecha = bloques.find(
      (b) => (b.startDate ?? 0) <= end && (b.endDate ?? Number.MAX_SAFE_INTEGER) >= start
    );
    const block = porPadre ?? porFecha ?? null;

    const days: boolean[] = [];
    let done = 0;
    for (let d = 0; d < 7; d++) {
      const hit = diasEntrenados.has(masDias(start, d));
      days.push(hit);
      if (hit) done++;
    }

    filas.push({
      start,
      end,
      index: i + 1,
      micro,
      block,
      blockStart: !!block && (i === 0 || filas[i - 1]?.block?.id !== block.id),
      blockWeeks:
        block && block.startDate && block.endDate ? weeksBetween(block.startDate, block.endDate) : 1,
      isDeload: !!micro?.isDeload,
      done,
      target: micro?.targetSessions ?? null,
      isCurrent: start === semanaActual,
      isPast: end < inicioDelDia(now),
      days,
    });
  }
  return filas;
}

export interface BandaDeBloque {
  /** El mesociclo, o null para las semanas que no cuelgan de ninguno. */
  block: TrainingCycle | null;
  nombre: string;
  /** Semanas que ocupa (1..n) y desde qué semana del plan empieza. */
  semanas: number;
  desde: number;
  /** Cuáles de sus semanas son de descarga, por posición dentro de la banda. */
  descargas: boolean[];
  /** Semanas ya cerradas y semanas cumplidas, para el color de cada celda. */
  hechas: boolean[];
  pasadas: boolean[];
  /** Posición de la semana en curso dentro de la banda; -1 si no cae aquí. */
  actual: number;
}

/**
 * La temporada de un vistazo: una banda por bloque, y dentro una celda por
 * semana.
 *
 * El calendario semana a semana sirve para trabajar; esto sirve para ENTENDER.
 * Un plan de veinticuatro semanas en forma de lista son veinticuatro filas que
 * hay que recorrer para saber en qué punto de la temporada se está, y esa es
 * justo la pregunta que se hace un entrenador al abrir la planificación. En
 * bandas se ve de un golpe: cuánto queda del bloque, cuándo cae la descarga y
 * dónde se cayó el alumno.
 */
export function bandasDelPlan(weeks: CalendarWeek[]): BandaDeBloque[] {
  const bandas: BandaDeBloque[] = [];
  for (const w of weeks) {
    const ultima = bandas[bandas.length - 1];
    const mismaBanda =
      ultima && (w.block ? ultima.block?.id === w.block.id : ultima.block === null);
    const banda: BandaDeBloque = mismaBanda
      ? ultima
      : {
          block: w.block,
          nombre: w.block?.name ?? 'Sin bloque',
          semanas: 0,
          desde: w.index,
          descargas: [],
          hechas: [],
          pasadas: [],
          actual: -1,
        };
    if (!mismaBanda) bandas.push(banda);
    banda.semanas += 1;
    banda.descargas.push(w.isDeload);
    // "Cumplida" es haber llegado a la meta; sin meta, haber entrenado algo.
    banda.hechas.push(w.target ? w.done >= w.target : w.done > 0);
    banda.pasadas.push(w.isPast);
    if (w.isCurrent) banda.actual = banda.semanas - 1;
  }
  return bandas;
}

/** Resumen del plan para la cabecera: semana x de n y cumplimiento. */
export function planSummary(weeks: CalendarWeek[], now = Date.now()) {
  const actual = weeks.find((w) => w.isCurrent);
  const cerradas = weeks.filter((w) => w.isPast || w.isCurrent);
  const hechos = cerradas.reduce((n, w) => n + w.done, 0);
  const previstos = cerradas.reduce((n, w) => n + (w.target ?? 0), 0);
  const semanaActual = actual
    ? actual.index
    : weeks.length > 0 && inicioDeLaSemana(now) > weeks[weeks.length - 1].start
      ? weeks.length
      : 0;
  return {
    week: semanaActual,
    totalWeeks: weeks.length,
    done: hechos,
    planned: previstos,
    /** 0..1, o null si el plan no fijó metas. */
    adherence: previstos > 0 ? Math.min(1, hechos / previstos) : null,
    block: actual?.block ?? null,
    isDeload: !!actual?.isDeload,
  };
}
