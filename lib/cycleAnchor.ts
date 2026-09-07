import AsyncStorage from '@react-native-async-storage/async-storage';
import { anclaParaIndice, anclaQueManda, type AnclaDelAlumno } from './ciclo';
import type { PausaPlan } from './pausa';
import type { UserProfile } from './types';

/**
 * Lo que el ALUMNO decide sobre su ciclo, guardado en el dispositivo.
 *
 * Existe para que pueda reiniciar el ciclo en el Día 1 —cuando le toca un
 * descanso opcional— o decir "hoy es el Día 3" si se le desfasó el plan, sin
 * tener que escribir en la rutina, que pertenece al entrenador.
 *
 * SE GUARDA TAMBIÉN CUÁNDO LO DECIDIÓ
 *
 * Y esa es la parte que faltaba. Antes solo se guardaba la fecha del ancla, y
 * para saber qué mandaba —esto, lo del otro dispositivo o lo del coach— se
 * cogía la fecha más grande. Como fijar "hoy es el Día 5" guardaba una fecha
 * futura para ganar esa comparación, una elección vieja podía tumbar a una
 * nueva: el alumno pulsaba "reiniciar" en la tablet y al abrir el móvil seguía
 * el ciclo de antes. Con la fecha de la decisión, gana el último que habló.
 *
 * La clave nueva se guarda APARTE de la vieja, sin tocarla. Así una versión
 * anterior de la app que lea el mismo móvil sigue encontrando lo que espera.
 */
const clave = (routineId: string) => `udeca-cycle-anchor-${routineId}`;
const claveFecha = (routineId: string) => `udeca-cycle-anchor-at-${routineId}`;

/** El ancla guardada en este dispositivo, con la fecha en que se decidió. */
export async function getCycleAnchor(routineId: string): Promise<AnclaDelAlumno | null> {
  try {
    const [v, cuando] = await Promise.all([
      AsyncStorage.getItem(clave(routineId)),
      AsyncStorage.getItem(claveFecha(routineId)),
    ]);
    const ancla = Number(v);
    if (!v || !Number.isFinite(ancla) || ancla <= 0) return null;
    const decididaEn = Number(cuando);
    return { ancla, decididaEn: Number.isFinite(decididaEn) ? decididaEn : 0 };
  } catch {
    return null;
  }
}

/** El ancla que trae la CUENTA (la puso este alumno desde otro dispositivo). */
export function anclaDeLaCuenta(
  profile: Pick<UserProfile, 'cycleAnchors' | 'cycleAnchorsSetAt'> | null | undefined,
  routineId: string
): AnclaDelAlumno | null {
  const ancla = profile?.cycleAnchors?.[routineId];
  if (!ancla) return null;
  return { ancla, decididaEn: profile?.cycleAnchorsSetAt?.[routineId] ?? 0 };
}

/**
 * El ancla del alumno de verdad: lo de este móvil y lo de la cuenta, junto.
 *
 * Lo usan las DOS pantallas que enseñan qué toca hoy. Antes la de entreno
 * juntaba las dos y la de inicio miraba solo la del móvil, así que un alumno
 * que reiniciaba el ciclo en la tablet veía un día en la portada y otro
 * distinto al entrar a entrenar, en el mismo momento y en la misma app.
 */
export async function anclaDelAlumno(
  routineId: string,
  profile: Pick<UserProfile, 'cycleAnchors' | 'cycleAnchorsSetAt'> | null | undefined
): Promise<AnclaDelAlumno | null> {
  return anclaQueManda(await getCycleAnchor(routineId), anclaDeLaCuenta(profile, routineId));
}

/** Guarda el ancla y devuelve la decisión completa, para subirla y pintarla. */
async function guardar(routineId: string, ancla: number): Promise<AnclaDelAlumno> {
  const decision: AnclaDelAlumno = { ancla, decididaEn: Date.now() };
  try {
    await AsyncStorage.multiSet([
      [clave(routineId), String(decision.ancla)],
      [claveFecha(routineId), String(decision.decididaEn)],
    ]);
  } catch {
    // Si falla el guardado, el cambio solo dura esta sesión (estado en memoria)
    // y el respaldo de la cuenta. No se le dice nada al alumno: lo que ha
    // pedido está hecho en la pantalla, que es lo que le importa ahora.
  }
  return decision;
}

/**
 * Reinicia el ciclo: HOY es el Día 1.
 *
 * Las pausas importan hasta para esto. Si hoy es día de baja, el ancla tiene
 * que caer justo aquí para que el Día 1 sea hoy y no el último de la rueda.
 */
export async function setCycleAnchorToday(
  routineId: string,
  pausas?: PausaPlan[]
): Promise<AnclaDelAlumno> {
  return guardar(routineId, anclaParaIndice(0, pausas));
}

/**
 * Fija qué día del ciclo (0-based) es HOY.
 *
 * El ancla se calcula hacia atrás desde hoy, saltándose los días de pausa: son
 * días que no han contado, así que hay que retroceder uno más por cada uno. Sin
 * eso, un alumno recién vuelto de una pausa pedía el Día 4 y le salía el Día 2.
 */
export async function setCycleAnchorForIndex(
  routineId: string,
  index: number,
  pausas?: PausaPlan[]
): Promise<AnclaDelAlumno> {
  return guardar(routineId, anclaParaIndice(index, pausas));
}
