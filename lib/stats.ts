import {
  resolveLoad,
  type RoutineSchedule,
  setMarks,
  type ExerciseLoad,
  type ExerciseMeasure,
  type LoggedExercise,
  type WeightLog,
  type WorkoutLog,
} from './types';
import { diasEntre, inicioDeLaSemana, inicioDelDia, masDias, mesLargo } from './fechas';
import { anclaEfectiva, indiceDelCiclo, type AnclaDelAlumno } from './ciclo';
import type { PausaPlan } from './pausa';
import { frase } from './idioma';

/**
 * Convierte a número tolerando la coma decimal española (66,4 → 66.4). Sin
 * esto, `Number("66,4")` da NaN y el peso se perdería en volúmenes y marcas.
 */
export function toNum(value: string | number | undefined | null): number {
  if (value == null) return NaN;
  return Number(String(value).replace(',', '.'));
}

export interface LastPerformance {
  weight?: string;
  reps?: string;
  date: number;
}

/**
 * Para cada ejercicio (por exerciseId), devuelve el mejor/último registro
 * previo: el peso y reps de la serie más pesada de la última sesión en que
 * se hizo. Mostrar el rendimiento anterior mientras entrenas es una función
 * clave de las apps de coaching líderes (TrueCoach, Trainerize).
 */
export function lastPerformanceByExercise(
  logs: WorkoutLog[]
): Record<string, LastPerformance> {
  const sorted = [...logs].sort((a, b) => b.date - a.date);
  const result: Record<string, LastPerformance> = {};

  for (const log of sorted) {
    for (const ex of log.exercises) {
      if (result[ex.exerciseId]) continue; // ya tenemos el más reciente
      // Solo series COMPLETADAS con marca apuntada: si en la última sesión el
      // ejercicio quedó sin hacer, se sigue buscando en sesiones anteriores
      // para no mostrar "última vez" en blanco.
      const done = ex.sets.filter((s) => s.completed && s.reps.trim() !== '');
      if (done.length === 0) continue;
      // Serie más DURA por carga efectiva (la goma resta); si ninguna lleva
      // peso, la última hecha. Sin esto, "la última vez" de un ejercicio
      // asistido enseñaba la serie con MÁS goma, o sea la más fácil.
      let best: { weight?: string; reps?: string } | null = null;
      let bestWeight = -Infinity;
      for (const set of done) {
        const kg = effectiveLoadKg(ex, set.weight);
        if (set.weight && kg !== 0 && kg > bestWeight) {
          bestWeight = kg;
          best = { weight: set.weight, reps: set.reps };
        }
      }
      if (!best) best = { reps: done[done.length - 1].reps };
      result[ex.exerciseId] = { ...best, date: log.date };
    }
  }

  return result;
}

/*
 * Las fechas viven en lib/fechas.ts, que es la única copia de cada una.
 *
 * Aquí había otras cuatro —`masDias`, `diasEntre`, `inicioDelDia`, `inicioDeLaSemana`—
 * y las mismas estaban repetidas en lib/cyclePlan.ts, lib/cycleStats.ts y
 * components/CycleProgress.tsx. Cinco versiones de "cuándo empieza la semana"
 * son cinco oportunidades de equivocarse con el domingo, que es el fallo
 * clásico de esa función: `getDay()` devuelve 0 y hay que retroceder seis
 * días, no uno.
 */

/**
 * Racha actual de días de entrenamiento: número de días consecutivos (hasta
 * hoy o ayer) en los que se registró al menos una sesión. Es la métrica de
 * constancia que usan apps como Strava, Duolingo o Future.
 */
/**
 * Racha con protector: cuenta DÍAS ENTRENADOS y tolera un día de descanso
 * entre sesiones (el descanso forma parte del plan — en el Método REIN TENA
 * se entrena a días alternos). Se rompe con 2+ días seguidos sin entrenar.
 */
/** Contexto de plan para la racha: rutina activa y ancla del ciclo del alumno. */
export interface StreakPlan {
  routine?: {
    schedule?: RoutineSchedule;
    cycleStartDate?: number;
    cycleStartDateSetAt?: number;
    days: { weekday?: number; isRest?: boolean }[];
  } | null;
  /** Lo que el alumno decidió sobre su ciclo, con la fecha en que lo decidió. */
  cycleAnchor?: AnclaDelAlumno | null;
  /**
   * Pausas del plan. Van aparte de `restDays` aunque sus días también estén
   * ahí: en `restDays` sirven para que la pausa no rompa la racha, y aquí para
   * saber qué día del ciclo tocaba en cada día que se mira hacia atrás.
   */
  pausas?: PausaPlan[];
  /** Días (a medianoche) marcados como descanso en modo Sensaciones. */
  restDays?: number[];
}

/** Índice de día de la semana con lunes=0 para un timestamp. */
function weekdayOf(ts: number): number {
  const d = new Date(ts).getDay();
  return d === 0 ? 6 : d - 1;
}

/**
 * Racha de entrenos CONSCIENTE del plan: los días de descanso programados por
 * el coach (aunque sean varios seguidos) no cuentan ni la rompen; la racha
 * solo se rompe al saltarse UN día de entrenamiento programado. Si no se
 * conoce el plan (modo flexible o sin rutina), se tolera 1 día de hueco.
 */
export function currentStreak(logs: WorkoutLog[], plan?: StreakPlan, floorTs?: number): number {
  if (logs.length === 0) return 0;
  const DAY = 24 * 60 * 60 * 1000;
  const trained = new Set(logs.map((l) => inicioDelDia(l.date)));
  const oldest = Math.min(...trained);
  const today = inicioDelDia(Date.now());

  const r = plan?.routine;
  // ¿Tocaba entrenar el día d? true/false según el plan; null = plan desconocido.
  const scheduled = (d: number): boolean | null => {
    if (!r || r.days.length === 0) return null;
    if (r.schedule === 'cycle' && (r.cycleStartDate || plan?.cycleAnchor?.ancla)) {
      /*
       * El día del ciclo se pide PARA EL DÍA `d`, que aquí siempre es del
       * pasado. Antes se calculaba con el ancla ya desplazada por la pausa
       * acumulada HOY: en los días anteriores a la pausa esa cuenta sobraba, y
       * la racha daba por descanso días en los que sí tocaba entrenar (o al
       * revés). Con la racha, equivocarse es romperla sin motivo.
       */
      const anchor = anclaEfectiva(r, plan?.cycleAnchor);
      const idx = indiceDelCiclo(anchor, r.days.length, d, plan?.pausas);
      const day = r.days[idx];
      return day ? !day.isRest : null;
    }
    // Grease the groove no tiene días de descanso: se entrena todos los días,
    // poco y repartido. Un día sin ninguna serie es un día saltado, no un
    // descanso del plan.
    if (r.schedule === 'gtg') return true;
    if (r.schedule === 'flex') return null;
    const usesWeekdays = r.days.some((day) => day.weekday !== undefined);
    if (!usesWeekdays) return null;
    return r.days.some((day) => day.weekday === weekdayOf(d) && !day.isRest);
  };

  let streak = 0;
  let unknownGap = 0;
  for (let d = today, i = 0; d >= oldest && i < 400; d -= DAY, i++) {
    // Reinicio mensual: no contamos días anteriores al suelo (p. ej. día 1 del mes).
    if (floorTs !== undefined && d < floorTs) break;
    if (trained.has(d)) {
      streak += 1;
      unknownGap = 0;
      continue;
    }
    if (d === today) continue; // hoy aún puede entrenar: no rompe.
    // Descanso elegido por el alumno (Sensaciones): no cuenta ni rompe.
    if (plan?.restDays?.includes(d)) continue;
    const s = scheduled(d);
    if (s === true) break; // se saltó un entrenamiento programado.
    if (s === false) continue; // descanso programado: no cuenta ni rompe.
    // Plan desconocido: tolerancia clásica de 1 día de hueco.
    unknownGap += 1;
    if (unknownGap >= 2) break;
  }
  return streak;
}

/**
 * Clave de la semana natural que contiene ts (lunes 00:00). Sirve para saber
 * si unas métricas semanales guardadas siguen siendo de la semana en curso o
 * son de una anterior (la semana termina el domingo a las 23:59).
 */
export function weekKeyOf(ts: number = Date.now()): string {
  return String(inicioDeLaSemana(ts));
}

/** Número de sesiones registradas en la semana en curso (lunes-domingo). */
export function sessionsThisWeek(logs: WorkoutLog[]): number {
  const weekStart = inicioDeLaSemana(Date.now());
  return logs.filter((l) => l.date >= weekStart).length;
}

/** Clave "YYYY-MM" del mes de un timestamp (para agrupar por mes de calendario). */
export function monthKeyOf(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Inicio (medianoche del día 1) del mes que contiene ts. */
export function monthStartOf(ts: number = Date.now()): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Sesiones registradas dentro del mes de calendario de ref (se reinicia cada mes). */
export function workoutsInMonth(logs: WorkoutLog[], ref: number = Date.now()): number {
  const d = new Date(ref);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return logs.filter((l) => l.date >= start && l.date < end).length;
}

/**
 * Mejor racha (días de calendario CONSECUTIVOS con al menos un entreno) lograda
 * dentro del mes de ref. Para el podio de "mejor racha del mes" del ranking.
 */
export function bestStreakInMonth(logs: WorkoutLog[], ref: number = Date.now()): number {
  const DAY = 24 * 60 * 60 * 1000;
  const d = new Date(ref);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const days = [
    ...new Set(
      logs.filter((l) => l.date >= start && l.date < end).map((l) => inicioDelDia(l.date))
    ),
  ].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const day of days) {
    run = prev && day - prev === DAY ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

/** Número de semanas distintas con al menos un entrenamiento. */
export function activeWeeks(logs: WorkoutLog[]): number {
  return new Set(logs.map((l) => inicioDeLaSemana(l.date))).size;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // nombre de icono Ionicons
  unlocked: boolean;
}

/**
 * Calcula el estado de los logros a partir de los datos ya existentes del
 * alumno. Los logros/insignias son un patrón clásico de gamificación en las
 * mejores apps de fitness para reforzar la adherencia.
 */
export function computeAchievements(
  workoutLogs: WorkoutLog[],
  weightLogs: WeightLog[]
): Achievement[] {
  const totalWorkouts = workoutLogs.length;
  const streak = currentStreak(workoutLogs);
  const weeks = activeWeeks(workoutLogs);
  const weightEntries = weightLogs.length;

  const weightProgress =
    weightLogs.length >= 2
      ? weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg
      : 0;

  return [
    {
      id: 'first-workout',
      title: 'Primer paso',
      description: 'Completa tu primer entrenamiento',
      icon: 'flag',
      unlocked: totalWorkouts >= 1,
    },
    {
      id: 'ten-workouts',
      title: 'Constante',
      description: 'Registra 10 entrenamientos',
      icon: 'barbell',
      unlocked: totalWorkouts >= 10,
    },
    {
      id: 'fifty-workouts',
      title: 'Guerrero',
      description: 'Registra 50 entrenamientos',
      icon: 'flame',
      unlocked: totalWorkouts >= 50,
    },
    {
      id: 'streak-3',
      title: 'En racha',
      description: '3 días seguidos entrenando',
      icon: 'trending-up',
      unlocked: streak >= 3,
    },
    {
      id: 'streak-7',
      title: 'Imparable',
      description: '7 días seguidos entrenando',
      icon: 'rocket',
      unlocked: streak >= 7,
    },
    {
      id: 'month-active',
      title: 'Mes de fuego',
      description: 'Entrena durante 4 semanas distintas',
      icon: 'calendar',
      unlocked: weeks >= 4,
    },
    {
      id: 'tracker',
      title: 'Bajo control',
      description: 'Registra tu peso 5 veces',
      icon: 'scale',
      unlocked: weightEntries >= 5,
    },
    {
      id: 'transformation',
      title: 'Transformación',
      description: 'Reduce 3 kg desde tu inicio',
      icon: 'ribbon',
      unlocked: weightProgress <= -3,
    },
    {
      id: 'hundred-workouts',
      title: 'Centurión',
      description: 'Registra 100 entrenamientos',
      icon: 'shield-checkmark',
      unlocked: totalWorkouts >= 100,
    },
    {
      id: 'streak-14',
      title: 'Máquina',
      description: '14 días seguidos entrenando',
      icon: 'flash',
      unlocked: streak >= 14,
    },
    {
      id: 'streak-30',
      title: 'Leyenda',
      description: '30 días seguidos entrenando',
      icon: 'trophy',
      unlocked: streak >= 30,
    },
    {
      id: 'weeks-12',
      title: 'Trimestre',
      description: 'Entrena durante 12 semanas distintas',
      icon: 'medal',
      unlocked: weeks >= 12,
    },
    {
      id: 'twentyfive-workouts',
      title: 'Veterano',
      description: 'Registra 25 entrenamientos',
      icon: 'barbell',
      unlocked: totalWorkouts >= 25,
    },
  ];
}

/** Marcas históricas de un ejercicio: mejor peso y mejores reps sin lastre. */
/**
 * Carga efectiva de una serie en kilos: el lastre SUMA y la asistencia RESTA.
 *
 * Es la diferencia entre una marca y su contraria. Diez segundos de planche
 * con 15 kg de goma no son un récord frente a tres segundos sin goma: son un
 * ejercicio MÁS FÁCIL. Tratar esos 15 kg como carga positiva —que es lo que se
 * hacía— celebraba retrocesos como si fueran progresos, que es la forma más
 * rápida de que alguien deje de creerse los récords de la app.
 *
 * Sin carga declarada se asume lastre, que es como se comportaban los registros
 * antiguos: quien apuntaba kilos, los estaba añadiendo.
 */
export function effectiveLoadKg(
  ex: { load?: ExerciseLoad; band?: boolean },
  weight: string | number | undefined | null
): number {
  const w = Math.abs(toNum(weight));
  if (!w) return 0;
  return resolveLoad(ex) === 'assisted' ? -w : w;
}

/** Cómo se dice una carga: "15 kg" si es lastre, "15 kg de goma" si asiste. */
export function loadLabel(kg: number): string {
  return kg < 0 ? frase`${Math.abs(kg)} kg de goma` : `${kg} kg`;
}

export interface ExerciseBest {
  /** Mejor carga EFECTIVA (negativa si lo mejor que hizo fue con asistencia). */
  bestLoadKg: number;
  /** Repeticiones (o segundos) logradas con esa carga. */
  bestRepsAtLoad: number;
  /** Máximo a peso corporal exacto: ni lastre ni goma. */
  bestReps: number;
  /** ¿Ha llegado alguna vez a peso corporal o más? Sin esto, el 0 no se puede
   *  distinguir de "nunca ha hecho una serie". */
  hasUnassisted: boolean;
}

function parseReps(reps: string): number {
  const n = parseInt(reps, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Mejores marcas históricas por ejercicio a partir del historial. */
export function bestsByExercise(logs: WorkoutLog[]): Record<string, ExerciseBest> {
  const bests: Record<string, ExerciseBest> = {};
  for (const log of logs) {
    for (const ex of log.exercises) {
      const b = (bests[ex.exerciseId] ??= {
        // Empieza por debajo de todo para que la PRIMERA serie, aunque sea con
        // mucha goma, quede registrada como su mejor marca hasta ahora.
        bestLoadKg: -Infinity,
        bestRepsAtLoad: 0,
        bestReps: 0,
        hasUnassisted: false,
      });
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const kg = effectiveLoadKg(ex, set.weight);
        const r = parseReps(set.reps);
        if (r === 0 && kg === 0) continue;
        if (kg > b.bestLoadKg || (kg === b.bestLoadKg && r > b.bestRepsAtLoad)) {
          b.bestLoadKg = kg;
          b.bestRepsAtLoad = r;
        }
        if (kg >= 0) b.hasUnassisted = true;
        // Máximo a peso corporal EXACTO: ni lastre ni goma.
        if (kg === 0 && r > b.bestReps) b.bestReps = r;
      }
    }
  }
  return bests;
}

export interface PersonalRecord {
  exerciseName: string;
  /** Descripción corta del récord, p.ej. "12 kg × 8" o "15 reps". */
  label: string;
}

/**
 * Récord actual de un ejercicio con el formato correcto SEGÚN SU TIPO:
 *  - Segundos (isométrico): máximo aguante  → "45 s"
 *  - Con lastre: mejor serie a peso         → "8 × 20 kg"
 *  - Repeticiones a peso corporal: máx reps → "12 reps"
 * Nunca mezcla datos de series distintas.
 */
export function exerciseRecord(
  logs: WorkoutLog[],
  exerciseId: string,
  measureByExercise?: Record<string, string>
): { label: string; metric: 'reps' | 's' | 'kg' } | null {
  const best = bestsByExercise(logs)[exerciseId];
  if (!best) return null;
  // Medida conocida del ejercicio (la última registrada manda). Los entrenos
  // antiguos no la guardaban: para esos vale la de la biblioteca, o un aguante
  // de 40 segundos se anunciaría como "40 repeticiones".
  let measure = (measureByExercise?.[exerciseId] as ExerciseMeasure | undefined) ?? 'reps';
  for (const log of logs) {
    const ex = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex?.measure) measure = ex.measure;
  }
  if (measure === 'seconds' && best.bestReps > 0) {
    return { label: `${best.bestReps} s`, metric: 's' };
  }
  if (best.bestLoadKg !== 0 && Number.isFinite(best.bestLoadKg)) {
    // También se anuncia la mejor marca CON goma cuando es lo único que hay:
    // esconderla dejaría sin récord a quien todavía está progresando con
    // asistencia, que es justo quien más necesita verlo.
    const reps = best.bestRepsAtLoad > 0 ? `${best.bestRepsAtLoad} × ` : '';
    return { label: `${reps}${loadLabel(best.bestLoadKg)}`, metric: 'kg' };
  }
  if (measure === 'seconds') return null;
  return best.bestReps > 0 ? { label: `${best.bestReps} reps`, metric: 'reps' } : null;
}

/**
 * Compara la sesión recién completada con las mejores marcas históricas y
 * devuelve los récords personales conseguidos hoy (más peso, o más reps con
 * el mismo peso / sin lastre).
 */
export function detectNewPRs(
  history: WorkoutLog[],
  session: LoggedExercise[],
  /**
   * Las mejores marcas ya calculadas, si quien llama las lleva al día.
   *
   * Existe para poder recorrer un historial entero sesión a sesión sin
   * recalcularlo todo en cada paso (ver lib/marcas.ts). Lo importante es que
   * la REGLA de qué es un récord siga viviendo aquí y en un solo sitio: el día
   * que el ranking cuente como récord algo que la app no celebró —o al revés—
   * nadie entiende su propia clasificación.
   */
  bestsPrecalculados?: Record<string, ExerciseBest>
): PersonalRecord[] {
  const bests = bestsPrecalculados ?? bestsByExercise(history);
  const prs: PersonalRecord[] = [];

  for (const ex of session) {
    const b = bests[ex.exerciseId] ?? {
      bestLoadKg: -Infinity,
      bestRepsAtLoad: 0,
      bestReps: 0,
      hasUnassisted: false,
    };
    const unit = ex.measure === 'seconds' ? 's' : 'reps';
    // Recorremos TODAS las series de hoy y nos quedamos con la MEJOR (el máximo),
    // no con la última que supere la marca. Así "9 dominadas" no queda tapado por
    // una serie posterior de 6.
    // La serie más DURA de hoy por carga efectiva: con goma cuenta en
    // negativo, así que una serie asistida nunca puede tapar a una sin goma.
    let heavy: { kg: number; r: number } | null = null;
    let maxReps = 0; // máximo de reps/segundos a peso corporal exacto
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const kg = effectiveLoadKg(ex, set.weight);
      const r = parseReps(set.reps);
      if (r === 0 && kg === 0) continue;
      if (kg !== 0 && (!heavy || kg > heavy.kg || (kg === heavy.kg && r > heavy.r))) {
        heavy = { kg, r };
      }
      if (kg === 0 && r > maxReps) maxReps = r;
    }
    let record: PersonalRecord | null = null;
    // Récord de carga: la serie más dura de hoy supera la mejor histórica.
    // Quitarle goma también es récord: menos asistencia es más carga efectiva.
    if (heavy && (heavy.kg > b.bestLoadKg || (heavy.kg === b.bestLoadKg && heavy.r > b.bestRepsAtLoad))) {
      record = {
        exerciseName: ex.name,
        label: `${loadLabel(heavy.kg)} × ${heavy.r || '—'}`,
      };
    } else if (maxReps > 0 && b.bestReps > 0 && maxReps > b.bestReps) {
      // Récord de repeticiones/segundos a peso corporal: el máximo real de hoy.
      record = { exerciseName: ex.name, label: `${maxReps} ${unit}` };
    }
    if (record) prs.push(record);
  }
  return prs;
}

/** Métricas agregadas de una sesión para el resumen post-entreno. */
/**
 * Un ejercicio es isométrico si su medida guardada es 'seconds' O si la medida
 * ACTUAL en la biblioteca del entrenador (mapa opcional) lo es. Así una plancha
 * marcada como segundos se muestra en segundos aunque el registro sea antiguo.
 */
export function isIsometricExercise(
  ex: LoggedExercise,
  measureByExercise?: Record<string, string>
): boolean {
  const m = ex.measure ?? measureByExercise?.[ex.exerciseId];
  return m === 'seconds' || m === 'secondsDual';
}

/**
 * Ejercicio anotado por lados (izquierda y derecha): cada serie trae dos
 * marcas del mismo tipo. Para los totales suman las dos, porque las dos se han
 * hecho de verdad.
 */
export function isDualSidedExercise(
  ex: LoggedExercise,
  measureByExercise?: Record<string, string>
): boolean {
  const m = ex.measure ?? measureByExercise?.[ex.exerciseId];
  return m === 'repsDual' || m === 'secondsDual';
}

/**
 * Ejercicio 'combo': cada serie tiene repeticiones Y aguante (muscle up +
 * front lever). Suma en los dos contadores a la vez.
 */
export function isComboExercise(
  ex: LoggedExercise,
  measureByExercise?: Record<string, string>
): boolean {
  const m = ex.measure ?? measureByExercise?.[ex.exerciseId];
  return m === 'combo';
}

export function sessionTotals(
  session: LoggedExercise[],
  measureByExercise?: Record<string, string>
) {
  let sets = 0;
  let reps = 0;
  let seconds = 0;
  let volumeKg = 0;
  for (const ex of session) {
    const isSeconds = isIsometricExercise(ex, measureByExercise);
    const isCombo = isComboExercise(ex, measureByExercise);
    const isDual = isDualSidedExercise(ex, measureByExercise);
    // La goma ASISTE (resta carga), no se levanta: sus kg no suman volumen.
    // Solo cuenta el peso añadido (lastre, mancuernas, máquinas).
    const weightCounts = resolveLoad(ex) !== 'assisted';
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const r = parseReps(set.reps);
      sets += 1;
      // Reps de ejercicios por repeticiones; segundos de los isométricos. El
      // combo aporta a los dos: sus repeticiones y su aguante.
      // Por lados, la serie trae dos marcas: cuentan las dos, porque las dos
      // se han hecho. Sumarlas al mismo contador es lo correcto para el total
      // de la sesión (el detalle por lado se ve en el registro).
      const r2 = isDual ? parseReps(set.side2 ?? '') : 0;
      // Los bloques de una serie en clúster se han hecho de verdad: cuentan
      // todos. Lo que NO se hace es fingir que fueron una sola serie seguida.
      const rc = (set.clusters ?? []).reduce((s, m) => s + parseReps(m), 0);
      if (isCombo) {
        reps += r + rc;
        seconds += parseReps(set.seconds ?? '');
      } else if (isSeconds) {
        seconds += r + r2 + rc;
      } else {
        reps += r + r2 + rc;
      }
      if (weightCounts) volumeKg += (toNum(set.weight) || 0) * (r + r2 + rc);
    }
  }
  return { sets, reps, seconds, volumeKg: Math.round(volumeKg) };
}

/**
 * Resumen semanal del grupo para el coach: sesiones de esta semana vs la
 * anterior y cuántos alumnos distintos han entrenado esta semana.
 */
export function weekComparison(logs: WorkoutLog[]): {
  thisWeek: number;
  lastWeek: number;
  activeClients: number;
} {
  const currentWeek = inicioDeLaSemana(Date.now());
  const previousWeek = masDias(currentWeek, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  const active = new Set<string>();
  for (const log of logs) {
    const week = inicioDeLaSemana(log.date);
    if (week === currentWeek) {
      thisWeek += 1;
      active.add(log.clientId);
    } else if (week === previousWeek) {
      lastWeek += 1;
    }
  }
  return { thisWeek, lastWeek, activeClients: active.size };
}

export interface WeeklySetsByGroup {
  weekStart: number;
  pushSets: number;
  pullSets: number;
}

/**
 * Series COMPLETADAS por semana separadas por patrón: empuje (grupo muscular
 * 'Empuje') y tirón ('Tirón'). El mapa exerciseId → grupo muscular viene de la
 * biblioteca del entrenador (el registro de la serie no guarda el grupo).
 */
/**
 * Series completadas por semana para las categorías que se pidan.
 *
 * Sustituye al par fijo Empuje/Tirón: no todo el mundo entrena en esos dos
 * patrones, y a quien trabaja sobre todo Core o Tren inferior esas dos gráficas
 * le salían planas. Aquí manda quien mira: se piden las categorías que
 * interesan y se devuelven sus series semana a semana.
 */
export function weeklySetsForGroups(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>,
  groups: string[],
  weeks = 8
): { weekStart: number; byGroup: Record<string, number> }[] {
  const currentWeek = inicioDeLaSemana(Date.now());
  const wanted = new Set(groups);
  const result = Array.from({ length: weeks }, (_, i) => ({
    weekStart: masDias(currentWeek, -7 * (weeks - 1 - i)),
    byGroup: Object.fromEntries(groups.map((g) => [g, 0])) as Record<string, number>,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(inicioDeLaSemana(log.date));
    if (i === undefined) continue;
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId];
      if (!group || !wanted.has(group)) continue;
      result[i].byGroup[group] += ex.sets.filter((s) => s.completed).length;
    }
  }
  return result;
}


/**
 * Mapa muscular: series completadas por grupo muscular en los últimos `days`
 * días, ordenado de mayor a menor. Grupos sin biblioteca → "Otros".
 */
export function setsByMuscleGroup(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>,
  days = 28
): { group: string; sets: number }[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.date < since) continue;
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId] ?? 'Otros';
      const done = ex.sets.filter((s) => s.completed).length;
      if (done > 0) totals.set(group, (totals.get(group) ?? 0) + done);
    }
  }
  return [...totals]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export interface MonthlyWorkouts {
  key: string;
  label: string;
  monthStart: number;
  sessions: WorkoutLog[];
  totalSets: number;
  totalReps: number;
  totalSeconds: number;
  volumeKg: number;
}

/**
 * Agrupa los entrenamientos por mes (más reciente primero), con el total de
 * series, reps, segundos isométricos y volumen de cada mes. Es el "registro de
 * entrenamiento mensual" del alumno.
 */
export function workoutsByMonth(
  logs: WorkoutLog[],
  measureByExercise?: Record<string, string>
): MonthlyWorkouts[] {
  const map = new Map<string, MonthlyWorkouts>();
  for (const log of logs) {
    const d = new Date(log.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let m = map.get(key);
    if (!m) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      m = {
        key,
        label: mesLargo(monthStart),
        monthStart,
        sessions: [],
        totalSets: 0,
        totalReps: 0,
        totalSeconds: 0,
        volumeKg: 0,
      };
      map.set(key, m);
    }
    m.sessions.push(log);
    const t = sessionTotals(log.exercises, measureByExercise);
    m.totalSets += t.sets;
    m.totalReps += t.reps;
    m.totalSeconds += t.seconds;
    m.volumeKg += t.volumeKg;
  }
  const months = [...map.values()].sort((a, b) => b.monthStart - a.monthStart);
  for (const m of months) m.sessions.sort((a, b) => b.date - a.date);
  return months;
}

/** Actividad agregada por semana (últimas `weeks`), para gráficas. */
export function weeklyActivity(
  logs: WorkoutLog[],
  weeks = 8
): { weekStart: number; sessions: number; volumeKg: number }[] {
  const currentWeek = inicioDeLaSemana(Date.now());
  const result = Array.from({ length: weeks }, (_, i) => ({
    weekStart: masDias(currentWeek, -7 * (weeks - 1 - i)),
    sessions: 0,
    volumeKg: 0,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(inicioDeLaSemana(log.date));
    if (i === undefined) continue;
    result[i].sessions += 1;
    result[i].volumeKg += sessionTotals(log.exercises).volumeKg;
  }
  return result;
}

export interface WeeklyVolumePoint {
  weekStart: number;
  /** Volumen en kg (peso × reps) de los ejercicios por repeticiones. */
  volumeKg: number;
  /** Segundos totales de trabajo isométrico (ejercicios medidos en segundos). */
  isoSeconds: number;
  /** Segundos isométricos de empuje (grupo muscular 'Empuje'). */
  isoPushSeconds: number;
  /** Segundos isométricos de tirón (grupo muscular 'Tirón'). */
  isoPullSeconds: number;
}

/**
 * Volumen semanal ampliado. Además del volumen en kg (peso × reps de los
 * ejercicios por repeticiones), suma los SEGUNDOS totales de trabajo
 * isométrico (ejercicios medidos en segundos, donde el valor va en `reps`),
 * separando empuje de tirón según el grupo muscular del ejercicio. El mapa
 * `muscleByExercise` (exerciseId → grupo muscular) proviene de la biblioteca
 * del entrenador, ya que el registro de la serie no guarda el grupo.
 */
export function weeklyVolume(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string> = {},
  weeks = 8
): WeeklyVolumePoint[] {
  const currentWeek = inicioDeLaSemana(Date.now());
  const result: WeeklyVolumePoint[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: masDias(currentWeek, -7 * (weeks - 1 - i)),
    volumeKg: 0,
    isoSeconds: 0,
    isoPushSeconds: 0,
    isoPullSeconds: 0,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(inicioDeLaSemana(log.date));
    if (i === undefined) continue;
    const bucket = result[i];
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId];
      const isIso = ex.measure === 'seconds';
      // Kg de goma no cuentan como volumen: la goma resta carga, no la añade.
      const weightCounts = resolveLoad(ex) !== 'assisted';
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const n = parseReps(set.reps);
        if (isIso) {
          bucket.isoSeconds += n;
          if (group === 'Empuje') bucket.isoPushSeconds += n;
          else if (group === 'Tirón') bucket.isoPullSeconds += n;
        } else if (weightCounts) {
          // La goma asiste: no se levanta, así que no suma volumen.
          bucket.volumeKg += Math.max(0, effectiveLoadKg(ex, set.weight)) * n;
        }
      }
    }
  }
  for (const r of result) r.volumeKg = Math.round(r.volumeKg);
  return result;
}

/** Ejercicios más entrenados (por nº de sesiones en que aparecen). */
export function topExercises(logs: WorkoutLog[], n = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const seen = new Set<string>();
    for (const ex of log.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      seen.add(ex.exerciseId);
      counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Días (timestamp a medianoche) con al menos un entrenamiento. */
export function trainingDays(logs: WorkoutLog[]): Set<number> {
  return new Set(logs.map((l) => inicioDelDia(l.date)));
}

/** Ejercicios que aparecen en el historial (id + nombre), más recientes primero. */
export interface PeriodSnapshot {
  sessions: number;
  sets: number;
  volumeKg: number;
  weightKg: number | null;
}

/**
 * Comparador "tú hace 3 meses → hoy": últimos 28 días frente a la misma
 * ventana de 28 días hace 3 meses. null si entonces no había datos (alumno
 * nuevo): la tarjeta simplemente no se muestra.
 */
export function thenVsNow(
  logs: WorkoutLog[],
  weights: WeightLog[]
): { then: PeriodSnapshot; now: PeriodSnapshot } | null {
  const DAY = 24 * 60 * 60 * 1000;
  const nowTs = Date.now();
  const snapshot = (from: number, to: number): PeriodSnapshot => {
    let sessions = 0;
    let sets = 0;
    let volumeKg = 0;
    for (const log of logs) {
      if (log.date < from || log.date > to) continue;
      sessions += 1;
      const t = sessionTotals(log.exercises);
      sets += t.sets;
      volumeKg += t.volumeKg;
    }
    // Peso corporal al final de la ventana (último registro hasta esa fecha).
    let weightKg: number | null = null;
    for (const w of weights) {
      if (w.date <= to) weightKg = w.weightKg;
    }
    return { sessions, sets, volumeKg: Math.round(volumeKg), weightKg };
  };
  const then = snapshot(nowTs - 112 * DAY, nowTs - 84 * DAY);
  if (then.sessions === 0) return null;
  return { then, now: snapshot(nowTs - 28 * DAY, nowTs) };
}

/**
 * Ritmo de progreso: pendiente (unidades por mes de 30 días) por regresión
 * lineal simple sobre los puntos de un ejercicio. null si no hay base (<3).
 */
export function trendPerMonth(points: { date: number; value: number }[]): number | null {
  if (points.length < 3) return null;
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const t0 = points[0].date;
  const xs = points.map((p) => (p.date - t0) / MONTH);
  const ys = points.map((p) => p.value);
  const n = points.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return null;
  return (n * sxy - sx * sy) / den;
}

export function listExercisesInLogs(logs: WorkoutLog[]): { exerciseId: string; name: string }[] {
  const map = new Map<string, string>();
  const sorted = [...logs].sort((a, b) => b.date - a.date);
  for (const log of sorted) {
    for (const ex of log.exercises) {
      if (!map.has(ex.exerciseId)) map.set(ex.exerciseId, ex.name);
    }
  }
  return Array.from(map, ([exerciseId, name]) => ({ exerciseId, name }));
}

/** Una celda de la matriz semanal: la mejor serie de ese ejercicio esa semana. */
export interface MatrixCell {
  /** Serie REAL principal (la más pesada): "12", "8×20", "45s". */
  label: string;
  /**
   * Segunda serie REAL (la de más repeticiones) cuando NO coincide con la más
   * pesada. Nunca se mezclan datos de series distintas en un solo número.
   */
  alt?: string;
  /** Ese día logró su máx. de peso y su máx. de reps en series distintas. */
  mark?: boolean;
  /** Puntuación numérica para comparar semanas (tendencia). */
  score: number;
  /**
   * La serie principal en números, para poder decir CUÁNTO se ha mejorado y no
   * solo si la flecha sube. En isométricos, `reps` son los segundos.
   */
  reps: number;
  weight: number;
}
export interface MatrixRow {
  exerciseId: string;
  name: string;
  measure: 'reps' | 'seconds';
  /** Nº de semanas con datos (para ordenar por relevancia). */
  weeksActive: number;
  /** Una celda por semana (de más antigua a más reciente); null = sin datos. */
  cells: (MatrixCell | null)[];
}
export interface WeeklyMatrix {
  /** Lunes de cada semana, de más antigua a más reciente. */
  weekStarts: number[];
  rows: MatrixRow[];
}

/**
 * Matriz de progreso semanal por ejercicio (estilo hoja de cálculo). Por cada
 * ejercicio y semana, la MEJOR serie: reps, reps×lastre o segundos. Pensada para
 * que el coach vea de un vistazo la evolución y reestructure la rutina.
 */
export function weeklyExerciseMatrix(
  logs: WorkoutLog[],
  weeks = 8,
  measureByExercise?: Record<string, string>
): WeeklyMatrix {
  const currentWeek = inicioDeLaSemana(Date.now());
  const weekStarts = Array.from({ length: weeks }, (_, i) => masDias(currentWeek, -7 * (weeks - 1 - i)));
  const colOf = new Map(weekStarts.map((w, i) => [w, i]));

  // exerciseId -> { name, measure, cells }
  const rows = new Map<string, MatrixRow>();

  for (const log of logs) {
    const col = colOf.get(inicioDeLaSemana(log.date));
    if (col === undefined) continue;
    for (const ex of log.exercises) {
      const measure: 'reps' | 'seconds' =
        ex.measure === 'seconds' || measureByExercise?.[ex.exerciseId] === 'seconds'
          ? 'seconds'
          : 'reps';
      // De ESTA sesión tomamos DOS series REALES, sin mezclar sus datos:
      // la más pesada y la de más repeticiones. Si son la misma serie, se
      // muestra una sola; si difieren, ambas + una "marca" del día.
      let heavy: { r: number; w: number } | null = null; // serie más dura
      let topReps: { r: number; w: number } | null = null; // serie con más reps
      for (const set of ex.sets) {
        if (!set.completed) continue;
        // Carga EFECTIVA: la goma resta. Sin esto, una serie asistida salía
        // como "la más pesada" y tapaba a la que se hizo sin ayuda.
        const w = effectiveLoadKg(ex, set.weight);
        // Cada bloque de un clúster compite por su cuenta. Sumarlos daría una
        // marca que nunca se hizo del tirón, y esta tabla enseña series reales.
        for (const marca of [set.reps, ...(set.clusters ?? [])]) {
          const rp = parseInt(marca, 10);
          const r = Number.isNaN(rp) ? 0 : rp;
          if (r === 0 && w === 0) continue;
          if (!heavy || w > heavy.w || (w === heavy.w && r > heavy.r)) heavy = { r, w };
          if (!topReps || r > topReps.r || (r === topReps.r && w > topReps.w)) topReps = { r, w };
        }
      }
      if (!heavy || !topReps) continue;

      const fmt = (s: { r: number; w: number }) =>
        s.w > 0 ? `${s.r}×${s.w}` : s.w < 0 ? `${s.r}×${Math.abs(s.w)}g` : `${s.r}`;
      let label: string;
      let alt: string | undefined;
      let mark = false;
      let score: number;
      // Números de la serie principal, los mismos que se pintan en `label`.
      let mainReps: number;
      let mainWeight: number;
      if (measure === 'seconds') {
        // En isométricos la "mejor serie" es la de más segundos (guardados en reps).
        label = `${topReps.r}s`;
        score = topReps.r;
        mainReps = topReps.r;
        mainWeight = 0;
      } else {
        // Serie principal = la más pesada (una serie real, tal cual se hizo).
        label = fmt(heavy);
        score = heavy.w !== 0 ? heavy.w * 1000 + heavy.r : heavy.r;
        mainReps = heavy.r;
        mainWeight = heavy.w;
        // Si la de más reps es OTRA serie distinta, se muestra aparte + marca.
        if (heavy.r !== topReps.r || heavy.w !== topReps.w) {
          alt = fmt(topReps);
          mark = true;
        }
      }

      let row = rows.get(ex.exerciseId);
      if (!row) {
        row = {
          exerciseId: ex.exerciseId,
          name: ex.name,
          measure,
          weeksActive: 0,
          cells: Array(weeks).fill(null),
        };
        rows.set(ex.exerciseId, row);
      }
      const prev = row.cells[col];
      // Nos quedamos con la mejor serie de la semana (mayor puntuación).
      if (!prev || score > prev.score) {
        row.cells[col] = { label, alt, mark, score, reps: mainReps, weight: mainWeight };
      }
    }
  }

  const result = [...rows.values()];
  for (const r of result) r.weeksActive = r.cells.filter(Boolean).length;
  // Orden: primero los ejercicios con más semanas de datos, luego alfabético.
  result.sort((a, b) => b.weeksActive - a.weeksActive || a.name.localeCompare(b.name));
  return { weekStarts, rows: result };
}

export interface ExerciseProgressPoint {
  date: number;
  reps: number;
  weight: number;
  /**
   * Mejor aguante de la sesión, en segundos. Solo lo llenan los ejercicios
   * 'combo', donde la serie tiene repeticiones Y aguante y hay que poder
   * enseñar las dos marcas juntas en la gráfica.
   */
  seconds: number;
  /** La sesión se hizo en clúster (la marca sale de un bloque, no de una serie seguida). */
  cluster?: boolean;
}
export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  measure: ExerciseMeasure;
  hasWeight: boolean;
  points: ExerciseProgressPoint[];
}

/**
 * Progresión de un ejercicio a lo largo del tiempo: por cada sesión en que se
 * hizo, la mejor serie (más reps/segundos y más peso). Ideal para ver mejoras.
 */
export function exerciseProgression(
  logs: WorkoutLog[],
  exerciseId: string
): ExerciseProgress | null {
  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const points: ExerciseProgressPoint[] = [];
  let name = '';
  let measure: ExerciseMeasure = 'reps';
  let hasWeight = false;
  for (const log of sorted) {
    const ex = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    name = ex.name;
    if (ex.measure) measure = ex.measure;
    let bestReps = 0;
    let bestWeight = 0;
    let bestSeconds = 0;
    let cluster = false;
    for (const set of ex.sets) {
      if (!set.completed) continue;
      // En clúster, la mejor marca es la del mejor bloque.
      if (set.clusters?.length) cluster = true;
      for (const marca of [set.reps, ...(set.clusters ?? [])]) {
        const r = parseInt(marca, 10);
        if (!Number.isNaN(r)) bestReps = Math.max(bestReps, r);
      }
      const s = parseInt(set.seconds ?? '', 10);
      if (!Number.isNaN(s)) bestSeconds = Math.max(bestSeconds, s);
      // Carga efectiva: con goma va en negativo, así que quitarse asistencia
      // se ve SUBIR en la gráfica, que es lo que de verdad está pasando.
      const kg = effectiveLoadKg(ex, set.weight);
      if (set.weight && kg !== 0) {
        bestWeight = bestWeight === 0 ? kg : Math.max(bestWeight, kg);
        hasWeight = true;
      }
    }
    points.push({
      date: log.date,
      reps: bestReps,
      weight: bestWeight,
      seconds: bestSeconds,
      ...(cluster ? { cluster: true } : {}),
    });
  }
  if (points.length === 0) return null;
  return { exerciseId, name, measure, hasWeight, points };
}

/** Una serie de un ejercicio, tal y como se hizo ese día. */
export interface ExerciseSetMark {
  /** Lo que se hizo, escrito como se lee: "10", "5+4", "45 s", "8 × 20 kg". */
  label: string;
  /** Mejor marca de la serie (repeticiones, o segundos si es isométrico). */
  reps: number;
  /** Aguante de la serie, en segundos. Solo en combos. */
  seconds: number;
  /** Lastre de la serie, en kg. */
  weight: number;
  /** La serie se hizo en clúster (varios bloques con pausa corta). */
  cluster: boolean;
}

/** Un día en que se entrenó un ejercicio, con todas sus series. */
export interface ExerciseSession {
  id: string;
  date: number;
  dayName: string;
  sets: ExerciseSetMark[];
}

/**
 * Historial de un ejercicio: cada día que se hizo, con TODAS sus series.
 *
 * `exerciseProgression` se queda con la mejor serie de cada día, que es lo que
 * necesita una gráfica. Esto es lo contrario: lo que hace falta para mirar
 * atrás y ver qué se hizo exactamente, sin tener que abrir la sesión entera
 * en la pestaña de entrenos.
 *
 * Devuelve lo más reciente primero, que es el orden en que se mira.
 */
export function exerciseSessions(
  logs: WorkoutLog[],
  exerciseId: string,
  measureByExercise?: Record<string, string>
): ExerciseSession[] {
  const salida: ExerciseSession[] = [];
  const ordenados = [...logs].sort((a, b) => b.date - a.date);
  for (const log of ordenados) {
    const ex = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const esSeg = isIsometricExercise(ex, measureByExercise);
    const esCombo = isComboExercise(ex, measureByExercise);
    const sets: ExerciseSetMark[] = [];
    for (const st of ex.sets) {
      if (!st.completed) continue;
      const marcas = setMarks(st);
      if (marcas.length === 0) continue;
      // Se escribe igual que en la sesión: los bloques de un clúster van
      // sumados ("5+4+3") porque eso es lo que se hizo de verdad.
      let label = marcas.join('+') + (esSeg ? ' s' : '');
      const seconds = parseInt(st.seconds ?? '', 10);
      const conAguante = !Number.isNaN(seconds) && seconds > 0;
      if (esCombo && conAguante) label += ` + ${seconds}s`;
      // Con goma se escribe "× 15 kg de goma": leer "× 15 kg" en una serie
      // asistida hace pensar que llevaba lastre, que es lo contrario.
      const weight = effectiveLoadKg(ex, st.weight);
      const conPeso = weight !== 0;
      if (conPeso) label += ` × ${loadLabel(weight)}`;
      let mejor = 0;
      for (const m of marcas) {
        const n = parseInt(m, 10);
        if (!Number.isNaN(n)) mejor = Math.max(mejor, n);
      }
      sets.push({
        label,
        reps: mejor,
        seconds: conAguante ? seconds : 0,
        weight: conPeso ? weight : 0,
        cluster: (st.clusters?.length ?? 0) > 0,
      });
    }
    if (sets.length > 0) {
      salida.push({ id: log.id, date: log.date, dayName: log.dayName, sets });
    }
  }
  return salida;
}
