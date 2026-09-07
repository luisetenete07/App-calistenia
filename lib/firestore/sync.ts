import { arrayRemove, arrayUnion, deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { stripUndefined } from './clean';
import type { ActiveSession } from '../types';

/**
 * Sincronización entre dispositivos de la misma cuenta. Guardamos la sesión de
 * entrenamiento en curso, el ancla del ciclo y el flag de onboarding DENTRO del
 * propio documento de perfil (users/{uid}). El usuario ya puede leer y escribir
 * su perfil (sin tocar la suscripción), así que no hacen falta reglas nuevas ni
 * una colección aparte: cualquier dispositivo con la misma cuenta lee lo último.
 */

export interface SyncState {
  activeSession: ActiveSession | null;
  cycleAnchors: Record<string, number>;
  /**
   * Cuándo se decidió cada ancla. Va en un mapa aparte y no dentro del ancla
   * para no cambiarle el tipo a `cycleAnchors`: una versión anterior de la app
   * en otro móvil de la misma cuenta sigue leyendo ahí un número, como espera.
   */
  cycleAnchorsSetAt: Record<string, number>;
  onboardingCompleted: boolean;
}

/** Lee de una vez el estado sincronizable de la cuenta. */
export async function fetchSyncState(uid: string): Promise<SyncState> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.data() ?? {};
    return {
      activeSession: (data.activeSession as ActiveSession) ?? null,
      cycleAnchors: (data.cycleAnchors as Record<string, number>) ?? {},
      cycleAnchorsSetAt: (data.cycleAnchorsSetAt as Record<string, number>) ?? {},
      onboardingCompleted: Boolean(data.onboardingCompleted),
    };
  } catch {
    return { activeSession: null, cycleAnchors: {}, cycleAnchorsSetAt: {}, onboardingCompleted: false };
  }
}

/** Guarda la sesión en curso (series/reps/marcas) para el resto de dispositivos. */
export async function saveActiveSession(uid: string, session: ActiveSession): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { activeSession: stripUndefined(session) });
  } catch {
    // Sin conexión: el borrador local sigue vigente; se subirá al reintentar.
  }
}

/** Limpia la sesión en curso (al terminar o descartar el entreno). */
export async function clearActiveSession(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { activeSession: deleteField() });
  } catch {
    // Ignorado: si falla, la siguiente sesión la sobrescribe.
  }
}

/**
 * Fija el ancla del ciclo de una rutina (sincroniza el día del ciclo).
 *
 * Las dos cosas se escriben JUNTAS, en la misma operación. Si la fecha de la
 * decisión pudiera quedarse atrás, el otro dispositivo vería un ancla nueva con
 * una fecha vieja y podría descartarla por antigua.
 */
export async function setCycleAnchorRemote(
  uid: string,
  routineId: string,
  ts: number,
  decididaEn: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`cycleAnchors.${routineId}`]: ts,
      [`cycleAnchorsSetAt.${routineId}`]: decididaEn,
    });
  } catch {
    // Ignorado: queda el ancla local del dispositivo como respaldo.
  }
}

/** Marca el onboarding como completado para toda la cuenta. */
export async function markOnboardingComplete(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { onboardingCompleted: true });
  } catch {
    // Ignorado: el flag local evita repetirlo en este dispositivo igualmente.
  }
}

/** Modo Sensaciones: registra un día como descanso elegido por el alumno. */
export async function addFlexRestDay(uid: string, dayTs: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { flexRestDays: arrayUnion(dayTs) });
  } catch {
    // Ignorado: la racha tolera 1 hueco igualmente en modo flexible.
  }
}

/** Modo Sensaciones: deshace el descanso de un día (el alumno decide entrenar). */
export async function removeFlexRestDay(uid: string, dayTs: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { flexRestDays: arrayRemove(dayTs) });
  } catch {
    // Ignorado.
  }
}
