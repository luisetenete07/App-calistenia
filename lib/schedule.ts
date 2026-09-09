import { anclaEfectiva, indiceDelCiclo, type AnclaDelAlumno } from './ciclo';
import { frase } from './idioma';
import type { PausaPlan } from './pausa';
import { weekdayOf, type Routine, type RoutineDay } from './types';

/** Nombres heredados del modo "Sensaciones" que ya no queremos mostrar. */
const LEGACY_FLEX_LABELS = ['rein tena', 'reintena', 'rein-tena', 'método rein tena', 'metodo rein tena'];

/**
 * Etiqueta visible de una programación "a sensaciones". Si no hay nombre, o si
 * es uno de los nombres antiguos (p. ej. "Rein Tena"), devuelve el fallback
 * ("Sensaciones" por defecto). Así ninguna pantalla muestra ya "Rein Tena".
 */
export function flexLabel(label?: string, fallback = 'Sensaciones'): string {
  const t = (label ?? '').trim();
  if (!t) return fallback;
  if (LEGACY_FLEX_LABELS.includes(t.toLowerCase())) return 'Sensaciones';
  return t;
}

/**
 * El nombre visible de un día del plan.
 *
 * Los días se crean con el nombre "Día 3" GUARDADO en los datos, y eso está
 * bien: es lo que el entrenador puede renombrar a "Empuje" cuando quiera. Lo
 * que no vale es enseñarlo tal cual en inglés —un alumno inglés vería "Día 3"
 * dentro de su propio plan—, así que el nombre por defecto se reconoce y se
 * traduce, y cualquier nombre que haya escrito una persona se respeta.
 */
export function nombreDelDia(nombre: string | undefined, indice: number): string {
  const n = (nombre ?? '').trim();
  const puesto = /^d[ií]a\s+(\d+)$/i.exec(n);
  if (puesto) return frase`Día ${Number(puesto[1])}`;
  return n || frase`Día ${indice + 1}`;
}

export interface TodaySession {
  /** Día de rutina que toca hoy, o null si no hay ninguno programado. */
  day: RoutineDay | null;
  /**
   * El día del plan que le corresponde a hoy, SEA O NO de entrenar.
   *
   * `day` se pone a null cuando toca descansar, y eso está bien: es lo que
   * pregunta casi todo el mundo —"¿qué entreno hoy?"— y así nadie confunde un
   * descanso con una sesión. Pero deja fuera una pregunta distinta: "¿en qué
   * día del plan estoy?", que en un día de descanso sigue teniendo respuesta.
   *
   * Sin ella, la pantalla de entreno no tenía forma de abrir el día que de
   * verdad tocaba: se caía al primer día de entrenar, así que en un día de
   * descanso el alumno veía cargado el Día 1 —o el último que hubiera hecho—
   * mientras su portada le decía que hoy tocaba descansar. Dos pantallas
   * diciendo cosas distintas sobre el mismo día.
   */
  diaDeHoy?: RoutineDay | null;
  /** true si hoy es un día de descanso (solo relevante si day es null o isRest). */
  isRest: boolean;
  /** true si hoy es un día de descanso OPCIONAL (el alumno decide, Día 7 TENA). */
  optionalRest: boolean;
  /** Etiqueta para el Método REIN TENA: "Día 2 de 4". Vacío en modo semanal. */
  cycleLabel?: string;
  /** Posición del día del ciclo (0-based), útil para preseleccionar la pestaña. */
  cycleIndex?: number;
}

/**
 * Lo que hace falta saber del alumno para situar su ciclo.
 *
 * Va junto a propósito: el ancla y las pausas SIEMPRE se usan a la vez, y
 * cuando eran dos parámetros sueltos hubo pantallas que pasaban una y se
 * olvidaban de la otra. El día que sale de olvidarse es un día del plan que no
 * toca, y eso el alumno lo ve y no lo entiende.
 */
export interface ContextoDelCiclo {
  /** Lo que el alumno decidió (reinicio, o "hoy es el Día N"), con su fecha. */
  alumno?: AnclaDelAlumno | null;
  /** Pausas del plan: sus días congelan el ciclo. */
  pausas?: PausaPlan[];
}

/**
 * Resuelve qué sesión toca HOY según el modo de programación de la rutina:
 *  - Método REIN TENA (cycle): rota por los días del ciclo desde su fecha de
 *    inicio, contando también los días de descanso.
 *  - Semanal (weekly): busca el día asignado al día de la semana de hoy.
 */
export function resolveTodaySession(
  routine: Routine | null,
  ciclo?: ContextoDelCiclo
): TodaySession {
  return resolveSessionFor(routine, Date.now(), ciclo);
}

/**
 * La misma resolución, pero para CUALQUIER día.
 *
 * Hace falta para mirar hacia delante: los avisos de "se te ha olvidado subir
 * el entreno" se programan con días de antelación, porque el móvil solo puede
 * programarlos mientras la app está abierta, y justo los días que hacen falta
 * son aquellos en los que el alumno no la abre.
 *
 * `resolveTodaySession` es esta misma con `Date.now()`.
 */
export function resolveSessionFor(
  routine: Routine | null,
  when: number,
  ciclo?: ContextoDelCiclo
): TodaySession {
  if (!routine || routine.days.length === 0) {
    return { day: null, diaDeHoy: null, isRest: false, optionalRest: false };
  }

  // Modo flexible ("Sensaciones"): no hay día programado; el alumno elige la
  // rutina cada día según cómo se encuentre.
  if (routine.schedule === 'flex') {
    return { day: null, diaDeHoy: null, isRest: false, optionalRest: false };
  }

  // Grease the groove: todos los días son el mismo día, y no se "empieza" una
  // sesión: se van sumando series sueltas (ver lib/gtg.ts). Se devuelve el
  // primer día para que la pantalla sepa qué ejercicios tocan, y nunca es
  // descanso: el método vive de la repetición diaria.
  if (routine.schedule === 'gtg') {
    const suyo = routine.days[0] ?? null;
    return { day: suyo, diaDeHoy: suyo, isRest: false, optionalRest: false };
  }

  if (routine.schedule === 'cycle') {
    /*
     * QUIÉN MANDA: EL ÚLTIMO QUE LO DECIDIÓ
     *
     * El alumno puede reiniciar su ciclo o fijar qué día es hoy sin tocar la
     * rutina, que es del coach; el coach puede reprogramar la fecha de inicio.
     * Gana quien lo haya hecho más tarde. El porqué —y los cuatro fallos que
     * salían de decidirlo por "la fecha más grande"— está en lib/ciclo.ts.
     *
     * OJO CON EL CICLO SIN FECHA DE INICIO
     *
     * Antes esta rama exigía que `cycleStartDate` tuviera valor, y un plan por
     * ciclos guardado sin ella —que es lo que queda cuando nadie toca la fecha
     * al crearlo— se caía al modo semanal sin avisar. El efecto era que el
     * ciclo NO rotaba: salía siempre el primer día, y ni "reiniciar el ciclo"
     * ni "fijar el día de hoy" servían de nada. Funcionaban en pantalla —la
     * app cambiaba el día seleccionado— y al volver a entrar estaba otra vez
     * el Día 1, que es la peor forma de fallar: parece que va.
     *
     * Ahora basta con que haya UN ancla, venga de quien venga. Y si no hay
     * ninguna, el ciclo empieza hoy por el Día 1, que es lo que uno espera de
     * un plan recién puesto.
     */
    const anchor = anclaEfectiva(routine, ciclo?.alumno);
    const idx =
      anchor > 0 ? indiceDelCiclo(anchor, routine.days.length, when, ciclo?.pausas) : 0;
    const day = routine.days[idx] ?? null;
    return {
      day: day && !day.isRest ? day : null,
      diaDeHoy: day,
      isRest: Boolean(day?.isRest),
      optionalRest: Boolean(day?.optionalRest),
      cycleLabel: frase`Día ${idx + 1} de ${routine.days.length}`,
      cycleIndex: idx,
    };
  }

  // Modo semanal (por defecto).
  const todays = routine.days.find((d) => d.weekday === weekdayOf(when));
  const usesWeekdays = routine.days.some((d) => d.weekday !== undefined);
  // Día de la semana marcado como descanso por el coach: el alumno descansa,
  // no registra nada y su racha no se ve afectada.
  if (todays?.isRest) {
    return { day: null, diaDeHoy: todays, isRest: true, optionalRest: false };
  }
  const elDeHoy = todays ?? (usesWeekdays ? null : routine.days[0]);
  return {
    day: elDeHoy,
    diaDeHoy: elDeHoy,
    isRest: usesWeekdays && !todays,
    optionalRest: false,
  };
}
