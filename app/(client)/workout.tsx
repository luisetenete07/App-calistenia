import React, { useCallback, useEffect, useRef, useState } from 'react';
import { t, frase  } from '../../lib/idioma';
import { diaLargo, diaSemanaCorto, esMismoDia, inicioDelDia, masDias } from '../../lib/fechas';
import { unido } from '../../lib/texto';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { AppState, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ResumenEntreno, TarjetaTerminado } from '../../components/DespuesDelEntreno';
import { PRBurst } from '../../components/PRBurst';
import { checkLivePR, type LivePR } from '../../lib/livePR';
import { FadeIn } from '../../components/FadeIn';
import { EmptyState } from '../../components/EmptyState';
import { IntervalTimer } from '../../components/IntervalTimer';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { VisorDeVideo } from '../../components/VisorDeVideo';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { getExerciseLibrary } from '../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { applyWeekPlan } from '../../lib/weekPlan';
import { esfuerzoDePct, pctCombinado, textoIntensidad } from '../../lib/intensidad';
import { RirPicker } from '../../components/RirPicker';
import { diasDePausa, pausaActiva } from '../../lib/pausa';
import { PressableScale } from '../../components/PressableScale';
import { RegistrarOtroDia } from '../../components/RegistrarOtroDia';
import { UltimoEntreno } from '../../components/UltimoEntreno';
import { SessionHeader } from '../../components/SessionHeader';
import type { AccionRapida } from '../../components/QuickSheet';
import {
  createWorkoutLog,
  deleteWorkoutLog,
  getWorkoutLogsForClient,
  updateWorkoutLog,
} from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import { flexLabel, resolveTodaySession } from '../../lib/schedule';
import {
  conSerieAnadida,
  entrenoDeHoy,
  esGtg,
  objetivoDelDia,
  sinLaUltimaSerie,
} from '../../lib/gtg';
import { PantallaGtg } from '../../components/PantallaGtg';
import {
  anclaDeLaCuenta,
  getCycleAnchor,
  setCycleAnchorForIndex,
  setCycleAnchorToday,
} from '../../lib/cycleAnchor';
import { anclaQueManda, type AnclaDelAlumno } from '../../lib/ciclo';
import { ultimoEntrenoDe } from '../../lib/ultimoEntreno';
import {
  addFlexRestDay,
  removeFlexRestDay,
  clearActiveSession,
  fetchSyncState,
  saveActiveSession,
  setCycleAnchorRemote,
} from '../../lib/firestore/sync';
import { tabScreenOptions } from '../../lib/navTheme';
import { cancelarAvisosOlvido, notifyUser } from '../../lib/notifications';
import { enqueueWorkout, flushPendingWorkouts } from '../../lib/offlineQueue';
import { shareRecordImage, shareSessionImage } from '../../lib/brandCards';
import { startRest, stopRest, useActiveRest } from '../../lib/restTimerStore';
import {
  computeAchievements,
  currentStreak,
  detectNewPRs,
  lastPerformanceByExercise,
  sessionTotals,
  type Achievement,
  type LastPerformance,
  type PersonalRecord,
} from '../../lib/stats';
import { Sheet } from '../../components/Sheet';
import { Chip, ChipRow } from '../../components/Chip';
import { minutosSegundos } from '../../lib/duracion';
import { idDeEjercicioPropio, nuevoId } from '../../lib/ids';
import { fonts, colors, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  clusterBlocks,
  EXERCISE_MEASURES,
  GRIP_LABEL,
  type ExerciseMeasure,
  isDualMeasure,
  isHoldMeasure,
  resolveLoad,
  todayWeekday,
  WEEKDAY_NAMES,
  type LoggedExercise,
  type Routine,
  type RoutineDay,
  type WorkoutLog,
} from '../../lib/types';

const DEFAULT_REST_SECONDS = 90;
// Series con las que entra un ejercicio añadido a mitad de sesión. Se pueden
// subir y bajar ahí mismo; tres es lo que casi siempre acaba haciéndose.
const SERIES_AL_ANADIR = 3;
// Una sesión a medias se conserva hasta 3 días: dentro del MISMO día se retoma
// sola; si es de un día anterior, se ofrece el botón "Rellenar último entreno".
const DRAFT_TTL_MS = 72 * 60 * 60 * 1000;

interface WorkoutDraft {
  routineId: string;
  dayId: string;
  dayName?: string;
  log: LoggedExercise[];
  startedAt: number | null;
  savedAt: number;
  /** Ejercicio que se estaba viendo, para reanudar justo donde se dejó. */
  viewIndex?: number;
}

const draftKey = (uid: string) => `udeca-workout-draft-${uid}`;
// Entreno de un día anterior que quedó sin finalizar (se guarda aparte para que
// empezar uno nuevo hoy no lo borre).
const pendingKey = (uid: string) => `udeca-workout-pending-${uid}`;
// Un borrador merece restaurarse si contiene CUALQUIER dato del alumno, no solo
// series marcadas: reps o pesos tecleados y notas cuentan igual. Solo se
// escriben borradores que difieren de la plantilla del día (ver pristineRef),
// así que basta con comprobar que hay algo dentro.
const draftHasProgress = (d: WorkoutDraft) =>
  d.log.some(
    (ex) =>
      (ex.notes ?? '').trim() !== '' ||
      ex.sets.some(
        (st) => st.completed || (st.reps ?? '').trim() !== '' || (st.weight ?? '').trim() !== ''
      )
  );

function buildLog(day: RoutineDay): LoggedExercise[] {
  return day.exercises.map((ex) => {
    // Si el coach fijó un número exacto (p. ej. "10"), lo precargamos para
    // ahorrar tecleo. Si puso un RANGO ("8-12") o texto ("AMRAP"), dejamos el
    // campo VACÍO y mostramos ese objetivo como pista: así el alumno escribe
    // las repeticiones que de verdad ha hecho.
    const target = (ex.reps ?? '').trim();
    const prefill = /^\d+$/.test(target) ? target : '';
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      measure: ex.measure ?? 'reps',
      load: resolveLoad(ex),
      sets: Array.from({ length: ex.sets || 1 }, () => ({
        reps: prefill,
        weight: '',
        completed: false,
      })),
    };
  });
}

interface SessionSummary {
  durationMin: number;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number;
  prs: PersonalRecord[];
  streak: number;
  newAchievements: Achievement[];
}

export default function WorkoutScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();

  // Modo inmersivo: oculta la barra de pestañas mientras se entrena para
  // concentrarse; la restaura al salir de la pantalla.
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: tabScreenOptions.tabBarStyle });
    }, [navigation])
  );

  const [routine, setRoutine] = useState<Routine | null>(null);
  // Récord que se está celebrando ahora mismo, y los ya celebrados en esta
  // sesión: el mismo ejercicio no vuelve a saltar aunque siga subiendo serie a
  // serie, o el aviso pasaría de premio a ruido.
  const [prVivo, setPrVivo] = useState<LivePR | null>(null);
  const prCelebrados = useRef<Set<string>>(new Set());
  const [history, setHistory] = useState<import('../../lib/types').WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  /**
   * Si ya se ha pulsado "Empezar entreno" para el día que está en pantalla.
   *
   * Guarda el ID del día y no un sí/no: al cambiar de día hay que volver a
   * empezar, porque lo que se abre es OTRO entreno.
   */
  const [diaEmpezado, setDiaEmpezado] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedExercise[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance>>({});
  const [videoByExercise, setVideoByExercise] = useState<Record<string, string>>({});
  // Medida ACTUAL de cada ejercicio en la biblioteca (reps/segundos). Manda
  // sobre la copia guardada en la rutina por si el coach la cambió después.
  const [measureByExercise, setMeasureByExercise] =
    useState<Record<string, import('../../lib/types').ExerciseMeasure>>({});
  // Grupo muscular de cada ejercicio (para el calentamiento sugerido del día).
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  // Biblioteca de ejercicios, para que el atleta pueda meter uno a mitad de
  // sesión sin escribir el nombre entero.
  const [libreria, setLibreria] = useState<import('../../lib/types').Exercise[]>([]);
  const [anadirEjOpen, setAnadirEjOpen] = useState(false);
  const [buscaEj, setBuscaEj] = useState('');
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [restored, setRestored] = useState(false);
  // Borrador sin finalizar de un DÍA ANTERIOR: se ofrece rellenarlo o dejarlo.
  const [pastDraft, setPastDraft] = useState<WorkoutDraft | null>(null);
  const [pastDismissed, setPastDismissed] = useState(false);
  // Si estamos rellenando un entreno de otro día, se registra con SU fecha.
  const [resumeDate, setResumeDate] = useState<number | null>(null);
  // Id de la sesión que se está corrigiendo, si se reabrió una ya guardada.
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  // Evita que el efecto de recuperación pise una recuperación manual.
  const resumeGuard = useRef(false);
  // Descanso activo: cuando corre, el crono flota abajo; añadimos hueco al
  // final para que no tape los botones Anterior/Siguiente ni el de Terminar.
  const activeRest = useActiveRest();
  // Índice del ejercicio que se muestra en el modo enfocado (1 por pantalla).
  const [viewIndex, setViewIndex] = useState(0);
  // Índice del ejercicio con el vídeo de técnica desplegado (null = ninguno).
  // El vídeo de técnica se abre en el visor, a casi toda la pantalla y con
  // las mismas protecciones que los cursos (ver components/VisorDeVideo). En
  // una tira de 200 px metida entre dos series no se ve dónde va el codo, que
  // es lo único que se viene a mirar.
  const [videoAbierto, setVideoAbierto] = useState<{ url: string; titulo: string } | null>(null);
  // Índice del ejercicio con el campo de nota abierto (null = ninguno).
  const [noteOpenIndex, setNoteOpenIndex] = useState<number | null>(null);
  // Ancla local del ciclo (Método REIN TENA): el alumno puede reiniciar en Día 1.
  const [cycleAnchor, setCycleAnchor] = useState<AnclaDelAlumno | null>(null);
  // Elección del descanso opcional (Día 7 TENA): pendiente hasta que decide.
  const [optionalResolved, setOptionalResolved] = useState(false);
  const [restingToday, setRestingToday] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Modo "Sensaciones": selección múltiple de rutinas (en orden) y descanso.
  const [flexSelection, setFlexSelection] = useState<string[]>([]);
  const [combinedDay, setCombinedDay] = useState<RoutineDay | null>(null);
  // Sensaciones: el alumno pide hacer un SEGUNDO entreno el mismo día. Ignora
  // temporalmente la tarjeta de "ya completado" para volver a elegir rutina.
  const [flexAgain, setFlexAgain] = useState(false);
  // Sensaciones: "hoy descanso" se recuerda entre sesiones (persistido en
  // flexRestDays), así al cerrar y reabrir la app el día sigue como descanso.
  const [flexResting, setFlexResting] = useState<boolean>(() => {
    const today = inicioDelDia(Date.now());
    return (profile?.flexRestDays ?? []).some((d) => inicioDelDia(d) === today);
  });
  const startedAt = useRef<number | null>(null);
  // Log "en blanco" del día tal y como lo genera la plantilla. Sirve para saber
  // si el alumno ha tocado algo: en cuanto el log difiere de esto, hay datos que
  // conservar y el borrador empieza a guardarse.
  const pristineRef = useRef<string>('');
  // Sesión en curso traída de la cuenta (otro dispositivo). Se compara con el
  // borrador local para recuperar siempre la versión más reciente.
  const remoteDraftRef = useRef<WorkoutDraft | null>(null);
  // Temporizador para no escribir en Firestore en cada tecla (debounce).
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        // Sube entrenos que quedaron pendientes por falta de conexión.
        const uploaded = await flushPendingWorkouts().catch(() => 0);
        if (uploaded > 0) showToast(frase`${uploaded} entreno(s) pendiente(s) subido(s) ✓`);
        const [data, logs, ciclos] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
          // Si el entrenador programó ESTA semana (4×8 la primera, 5×8 la
          // tercera), es eso lo que hay que entrenar hoy. Sin ciclos, la
          // rutina se usa tal cual y aquí no cambia nada.
          getCyclesForClientSelf(profile.uid).catch(() => []),
        ]);
        if (cancelled) return;
        setRoutine(applyWeekPlan(data, ciclos));
        prCelebrados.current = new Set();
        setHistory(logs);
        setLastPerf(lastPerformanceByExercise(logs));
        // Vídeos de técnica de la biblioteca del entrenador (no bloquea).
        if (profile.trainerId) {
          getExerciseLibrary(profile.trainerId)
            .then((library) => {
              if (cancelled) return;
              const map: Record<string, string> = {};
              const measures: Record<string, import('../../lib/types').ExerciseMeasure> = {};
              const muscles: Record<string, string> = {};
              for (const ex of library) {
                if (ex.videoUrl) map[ex.id] = ex.videoUrl;
                measures[ex.id] = ex.measure ?? 'reps';
                muscles[ex.id] = ex.muscleGroup;
              }
              setVideoByExercise(map);
              setMeasureByExercise(measures);
              setMuscleByExercise(muscles);
              setLibreria(library);
            })
            .catch(() => {});
        }
        // Estado sincronizado de la cuenta (sesión en curso + ancla del ciclo),
        // para que cualquier dispositivo con la misma cuenta vaya al día.
        const sync = await fetchSyncState(profile.uid);
        if (cancelled) return;
        remoteDraftRef.current = sync.activeSession ?? null;
        /*
         * El ancla del ciclo es la que se DECIDIÓ más tarde, entre la de este
         * dispositivo y la de la cuenta. Antes se cogía la fecha más grande, y
         * como fijar "hoy es el Día 5" guardaba una fecha futura para ganar esa
         * comparación, un reinicio hecho en otro móvil podía perder contra una
         * elección de la semana pasada.
         */
        const anchor = anclaQueManda(
          data ? await getCycleAnchor(data.id) : null,
          data ? anclaDeLaCuenta({ cycleAnchors: sync.cycleAnchors, cycleAnchorsSetAt: sync.cycleAnchorsSetAt }, data.id) : null
        );
        if (cancelled) return;
        setCycleAnchor(anchor);
        if (data && data.days.length > 0) {
          // Preselecciona el día que toca hoy. Prioridad: sesión en curso en
          // otro dispositivo → día ya entrenado hoy → día que toca → primero.
          const session = resolveTodaySession(data, {
            alumno: anchor,
            pausas: profile.planPauses,
          });
          const remoteFresh =
            sync.activeSession &&
            sync.activeSession.routineId === data.id &&
            Date.now() - sync.activeSession.savedAt < DRAFT_TTL_MS &&
            sync.activeSession.log.some((ex) => ex.sets.some((st) => st.completed))
              ? data.days.find((d) => d.id === sync.activeSession!.dayId)
              : undefined;
          const doneToday = logs.find(
            (l) => l.routineId === data.id && esMismoDia(l.date)
          );
          const doneTodayDay = doneToday
            ? data.days.find((d) => d.name === doneToday.dayName)
            : undefined;
          if (data.schedule === 'flex') {
            // Modo a elección ("Sensaciones"): el alumno elige rutina antes de
            // empezar; solo preseleccionamos si hay sesión en curso o ya entrenó.
            setSelectedDayId((prev) => prev ?? remoteFresh?.id ?? doneTodayDay?.id ?? null);
          } else {
            /*
             * SI HOY TOCA DESCANSAR, SE ABRE EL DÍA DE DESCANSO.
             *
             * Antes se saltaba: `days.find((d) => !d.isRest)` buscaba el primer
             * día de ENTRENAR, así que en un día de descanso el alumno abría la
             * pestaña y se encontraba cargado el Día 1 —o el último que hubiera
             * hecho— con sus ejercicios y su botón de empezar. Su portada le
             * decía "Día 6, descanso" y esta pantalla le enseñaba otro día
             * distinto: dos sitios de la misma app contando cosas diferentes
             * sobre el mismo día, que es de las cosas que más hacen dudar de un
             * plan.
             *
             * Abriendo el día que de verdad toca sale la tarjeta de descanso, y
             * quien quiera entrenar igualmente solo tiene que tocar otro día en
             * la tira de arriba, que sigue estando entera.
             */
            const fallback = data.days.find((d) => !d.isRest) ?? data.days[0];
            setSelectedDayId(
              (prev) =>
                prev ??
                remoteFresh?.id ??
                doneTodayDay?.id ??
                session.day?.id ??
                session.diaDeHoy?.id ??
                fallback.id
            );
          }
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  useEffect(() => {
    if (!routine || !selectedDayId || !profile) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (!day) return;
    // Estamos en un día REAL de la rutina: si quedó pegado un "día combinado"
    // de Sensaciones de una sesión anterior, lo limpiamos. Si no, el nombre del
    // entreno (dayName) se guardaría con el del combinado antiguo aunque los
    // ejercicios sean los de este día (p. ej. salía "Core" en un Tirón suave).
    setCombinedDay(null);
    // Una recuperación manual (botón "Rellenar último entreno") ya ha fijado el
    // log; no lo pisamos.
    if (resumeGuard.current) {
      resumeGuard.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const uid = profile.uid;
      const today = inicioDelDia(Date.now());
      // 1) Carry-over: entreno de un día anterior sin finalizar (guardado aparte).
      let pending: WorkoutDraft | null = null;
      try {
        const rawP = await AsyncStorage.getItem(pendingKey(uid));
        if (rawP) pending = JSON.parse(rawP) as WorkoutDraft;
      } catch {
        // ilegible: se ignora
      }
      if (
        !pending ||
        !draftHasProgress(pending) ||
        Date.now() - pending.savedAt >= DRAFT_TTL_MS ||
        inicioDelDia(pending.startedAt ?? pending.savedAt) >= today
      ) {
        if (pending) AsyncStorage.removeItem(pendingKey(uid)).catch(() => {});
        pending = null;
      }

      // 2) Borrador principal: local vs. cuenta (otro dispositivo), gana el más reciente.
      let draft: WorkoutDraft | null = null;
      try {
        const raw = await AsyncStorage.getItem(draftKey(uid));
        if (raw) draft = JSON.parse(raw) as WorkoutDraft;
      } catch {
        // ilegible
      }
      const remote = remoteDraftRef.current;
      if (remote && (!draft || remote.savedAt > draft.savedAt)) draft = remote;

      let restoredHere = false;
      if (draft && draftHasProgress(draft) && Date.now() - draft.savedAt < DRAFT_TTL_MS) {
        const draftDay = inicioDelDia(draft.startedAt ?? draft.savedAt);
        if (draftDay === today && draft.routineId === routine.id && draft.dayId === selectedDayId) {
          // Mismo día: se retoma sin preguntar.
          if (cancelled) return;
          // La referencia sigue siendo la plantilla del día: el borrador difiere
          // de ella, así que los cambios se seguirán guardando.
          pristineRef.current = JSON.stringify(buildLog(day));
          setLog(draft.log);
          startedAt.current = draft.startedAt;
          setRestored(true);
          setResumeDate(null);
          setSummary(null);
          // Vuelve al ejercicio que estaba viendo; si no consta, al primero sin
          // terminar.
          const resume = draft.log.findIndex((ex) => ex.sets.some((st) => !st.completed));
          setViewIndex(draft.viewIndex ?? (resume >= 0 ? resume : 0));
          restoredHere = true;
        } else if (draftDay < today) {
          // El borrador principal es de un día anterior: se guarda como
          // "pendiente" ANTES de olvidarlo, para que empezar hoy no lo borre.
          // El orden importa: al revés se perdería el entreno de ayer.
          AsyncStorage.setItem(pendingKey(uid), JSON.stringify(draft)).catch(() => {});
          olvidarBorrador();
          pending = draft;
        }
      }

      if (cancelled) return;
      setPastDraft(pending);
      if (!restoredHere) {
        const fresh = buildLog(day);
        pristineRef.current = JSON.stringify(fresh);
        setLog(fresh);
        setRestored(false);
        setResumeDate(null);
        setSummary(null);
        setViewIndex(0);
        startedAt.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routine, selectedDayId, profile]);

  // Guarda el borrador con cada cambio: al instante en el dispositivo y, con un
  // pequeño retardo, en la cuenta (Firestore) para sincronizar entre móviles.
  useEffect(() => {
    if (!profile || !routine || !selectedDayId || log.length === 0) return;
    // Hay algo que guardar en cuanto el log deja de ser la plantilla del día:
    // basta con teclear unas repeticiones, un peso o una nota, sin necesidad de
    // marcar ninguna serie como completada.
    if (!pristineRef.current || JSON.stringify(log) === pristineRef.current) return;
    const draft: WorkoutDraft = {
      routineId: routine.id,
      dayId: selectedDayId,
      dayName:
        combinedDay?.name ?? routine.days.find((d) => d.id === selectedDayId)?.name ?? undefined,
      log,
      startedAt: startedAt.current,
      savedAt: Date.now(),
      viewIndex,
    };
    AsyncStorage.setItem(draftKey(profile.uid), JSON.stringify(draft)).catch(() => {});
    remoteDraftRef.current = draft;
    // Debounce: sube a la cuenta como mucho ~1,5 s después del último cambio.
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      saveActiveSession(profile.uid, draft);
    }, 1500);
  }, [log, viewIndex, combinedDay, profile, routine, selectedDayId]);

  // Si la app pasa a segundo plano (bloqueo de pantalla, llamada, cambio de
  // app), no esperamos al debounce: subimos el borrador ya, para que la sesión
  // siga intacta aunque el sistema cierre la app sin previo aviso.
  useEffect(() => {
    if (!profile) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const draft = remoteDraftRef.current;
      if (!draft) return;
      if (remoteSaveTimer.current) {
        clearTimeout(remoteSaveTimer.current);
        remoteSaveTimer.current = null;
      }
      saveActiveSession(profile.uid, draft);
    });
    return () => sub.remove();
  }, [profile]);

  // Al salir de la pantalla, cancela cualquier subida pendiente en cola.
  useEffect(() => {
    return () => {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    };
  }, []);

  /**
   * Olvida el borrador de la sesión, entero.
   *
   * Un borrador vive en TRES sitios —el disco de este móvil, la cuenta (para
   * que otro dispositivo lo recoja) y la subida en cola que aún no ha salido—
   * y olvidarlo mal es peor que no olvidarlo: si se borra el del disco pero no
   * el de la cuenta, vuelve solo al abrir la pantalla y el alumno se encuentra
   * un entreno que creía terminado. Estaba escrito cinco veces, y cada copia
   * era una ocasión de dejarse uno de los tres.
   *
   * `tambienElPendiente` borra además el de arrastre, el de un día anterior
   * que quedó sin terminar. Solo se hace al guardar de verdad: en los demás
   * casos ese entreno sigue esperando y no hay por qué tirarlo.
   */
  const olvidarBorrador = ({ tambienElPendiente = false } = {}) => {
    if (profile) {
      AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
      if (tambienElPendiente) AsyncStorage.removeItem(pendingKey(profile.uid)).catch(() => {});
      clearActiveSession(profile.uid);
    }
    remoteDraftRef.current = null;
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
  };

  /**
   * Devuelve la pantalla al día tal y como está en la rutina, sin nada
   * apuntado. Es lo que hay que hacer después de guardar o de cancelar: si el
   * log se quedara lleno de series marcadas, la pantalla creería que hay un
   * entreno en curso.
   */
  const dejarElDiaLimpio = () => {
    const diaReal = routine?.days.find((d) => d.id === selectedDayId);
    const limpio = diaReal ? buildLog(diaReal) : [];
    setLog(limpio);
    pristineRef.current = JSON.stringify(limpio);
    setViewIndex(0);
  };

  const discardDraft = () => {
    if (!routine || !selectedDayId) return;
    olvidarBorrador();
    dejarElDiaLimpio();
    startedAt.current = null;
    setRestored(false);
  };

  // Rellenar el entreno de un día anterior que quedó sin finalizar. Carga su
  // log y lo deja listo para completar y guardar (se registrará con SU fecha).
  const resumePastDraft = () => {
    if (!routine || !pastDraft) return;
    const d = pastDraft;
    setLog(d.log);
    startedAt.current = d.startedAt;
    setRestored(true);
    setResumeDate(inicioDelDia(d.startedAt ?? d.savedAt));
    setPastDraft(null);
    setSummary(null);
    const realDay = routine.days.find((x) => x.id === d.dayId);
    if (realDay && d.dayId !== selectedDayId) {
      // Cambiar de día re-dispara el efecto de recuperación: lo bloqueamos una vez.
      resumeGuard.current = true;
      setCombinedDay(null);
      setSelectedDayId(d.dayId);
    } else if (!realDay) {
      // Rutina de Sensaciones (día combinado) o día ya inexistente: día sintético.
      setCombinedDay({ id: d.dayId, name: d.dayName || 'Entreno', exercises: [] });
    }
    const resume = d.log.findIndex((ex) => ex.sets.some((st) => !st.completed));
    setViewIndex(resume >= 0 ? resume : 0);
  };

  // Dejar el entreno de ayer para más tarde: se oculta el aviso y se puede
  // empezar uno nuevo hoy (el borrador se conserva para volver a ofrecerlo).
  const dismissPastDraft = () => setPastDismissed(true);

  const isFlex = routine?.schedule === 'flex';
  const day = combinedDay ?? routine?.days.find((d) => d.id === selectedDayId) ?? null;
  /*
   * El día de grease the groove, si toca. Puede venir de dos sitios: de una
   * rutina entera en ese modo (se entrena su primer día) o de Sensaciones, si
   * el coach marcó así una de las rutinas entre las que el alumno elige.
   */
  const diaGtg = esGtg(routine) ? routine?.days[0] ?? null : esGtg(routine, day) ? day : null;
  const esModoGtg = !!diaGtg;
  // El nombre con el que se guarda el entreno del día. Se calcula UNA vez
  // porque sirve también para encontrarlo: con dos expresiones distintas, un
  // día sin nombre se buscaría por '' y se guardaría por otra cosa, y cada
  // serie acabaría creando su propio entreno.
  const nombreGtg = diaGtg ? diaGtg.name || 'Grease the groove' : undefined;
  /*
   * Con el plan en pausa el ciclo está congelado, así que el día que se propone
   * es el que se dejó, no el que tocaría si los días de pausa hubieran contado.
   * La pantalla no se bloquea: una pausa quita obligaciones, no permisos, y si
   * un día de baja apetece entrenar, ese entreno cuenta como cualquier otro.
   */
  const enPausa = pausaActiva(profile?.planPauses);
  const todaySession = resolveTodaySession(routine, {
    alumno: cycleAnchor,
    pausas: profile?.planPauses,
  });

  /*
   * Sensaciones: alterna una rutina en la selección (guarda el orden de
   * elección).
   *
   * Una rutina de grease the groove va sola. No es una sesión que se encadene
   * con otra: es el día entero repartido en series sueltas, así que "Empuje +
   * dominadas todo el día" no significa nada. Elegirla descarta lo demás, y
   * elegir cualquier otra la descarta a ella.
   */
  const toggleFlexRoutine = (id: string) => {
    const esta = routine?.days.find((d) => d.id === id);
    setFlexSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (esta?.gtg) return [id];
      const sinGtg = prev.filter((x) => !routine?.days.find((d) => d.id === x)?.gtg);
      return [...sinGtg, id];
    });
  };

  // Sensaciones: monta el entreno combinando las rutinas elegidas, en orden.
  const startFlexSession = () => {
    if (!routine || flexSelection.length === 0) return;
    const chosen = flexSelection
      .map((id) => routine.days.find((d) => d.id === id))
      .filter((d): d is RoutineDay => !!d);
    // Grease the groove no se monta como sesión: se entra en su pantalla tal
    // cual, con su propio día.
    if (chosen.length === 1 && chosen[0].gtg) {
      setCombinedDay(chosen[0]);
      setLog([]);
      setViewIndex(0);
      startedAt.current = null;
      return;
    }
    const combined: RoutineDay = {
      id: `flex-${Date.now()}`,
      name: chosen.map((d) => d.name || 'Rutina').join(' + '),
      exercises: chosen.flatMap((d) => d.exercises),
      // Encadenando rutinas manda la más dura: un día suave ANTES de uno fuerte
      // no hace la sesión medio fuerte, la hace fuerte y con más fatiga.
      intensityPct: pctCombinado(chosen),
    };
    setCombinedDay(combined);
    setLog(buildLog(combined));
    setViewIndex(0);
    startedAt.current = null;
  };

  // Sensaciones: marca hoy como descanso (no afecta a la racha).
  const chooseFlexRest = async () => {
    setFlexResting(true);
    if (profile) {
      addFlexRestDay(profile.uid, inicioDelDia(Date.now())).catch(() => {});
    }
  };

  // Sensaciones: cancela el entreno en curso y vuelve a la selección de rutinas.
  const cancelFlexSession = () => {
    setCombinedDay(null);
    setFlexSelection([]);
    setFlexResting(false);
    setLog([]);
    setViewIndex(0);
    setRestored(false);
    startedAt.current = null;
    olvidarBorrador();
    stopRest();
  };

  /*
   * El atleta mete un ejercicio a mitad de sesión.
   *
   * Se autoentrena: su plan es una guía suya, no el encargo de nadie, y a
   * mitad de sesión decide que hoy también toca remo porque la barra está
   * libre. Hasta ahora la única salida era salirse, editar el plan y volver a
   * empezar la sesión, así que en la práctica ese ejercicio no se apuntaba.
   *
   * Al alumno de un entrenador no se le ofrece: su plan se lo pone otro, y
   * dejar que lo cambie a mitad de sesión convierte el plan en una sugerencia
   * y deja al entrenador sin saber qué se hizo de lo que mandó.
   */
  const esAtleta = profile?.role === 'athlete';

  const anadirEjercicioSuelto = (nombre: string, id?: string, measure?: ExerciseMeasure) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const base = combinedDay ?? routine?.days.find((d) => d.id === selectedDayId);
    if (!base) return;
    const exerciseId = id ?? idDeEjercicioPropio(limpio);
    // Si ya está en la sesión, no se duplica: se salta a él, que es lo que se
    // venía a hacer.
    const yaEsta = log.findIndex((e) => e.exerciseId === exerciseId);
    if (yaEsta >= 0) {
      setViewIndex(yaEsta);
      setAnadirEjOpen(false);
      setBuscaEj('');
      showToast('Ese ejercicio ya está en la sesión');
      return;
    }
    const medida = measure ?? measureByExercise[exerciseId] ?? 'reps';
    // El día pasa a ser uno propio de esta sesión: así el resto de la pantalla
    // (descansos, objetivos, superseries) encuentra el ejercicio en su sitio.
    setCombinedDay({
      ...base,
      exercises: [
        ...base.exercises,
        {
          id: nuevoId(),
          exerciseId,
          name: limpio,
          sets: SERIES_AL_ANADIR,
          reps: '',
          measure: medida,
          load: 'none',
        },
      ],
    });
    setLog((prev) => [
      ...prev,
      {
        exerciseId,
        name: limpio,
        measure: medida,
        load: 'none',
        sets: Array.from({ length: SERIES_AL_ANADIR }, () => ({
          reps: '',
          weight: '',
          completed: false,
        })),
      },
    ]);
    setViewIndex(log.length);
    setAnadirEjOpen(false);
    setBuscaEj('');
  };

  // Sensaciones: alumno añade/quita una serie a un ejercicio según se sienta.
  const addSet = (exerciseIndex: number) => {
    setLog((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;
        // La casilla de la marca a apuntar arranca siempre vacía (no hereda la
        // marca de la serie anterior).
        return { ...ex, sets: [...ex.sets, { reps: '', weight: '', completed: false }] };
      })
    );
  };
  const removeSet = (exerciseIndex: number) => {
    setLog((prev) => {
      const ex = prev[exerciseIndex];
      if (!ex) return prev;
      // Sensaciones: si se quita la única serie, el ejercicio sale del día.
      if (ex.sets.length <= 1) {
        const next = prev.filter((_, i) => i !== exerciseIndex);
        setViewIndex((v) => Math.max(0, Math.min(v, next.length - 1)));
        return next;
      }
      return prev.map((e, i) => (i === exerciseIndex ? { ...e, sets: e.sets.slice(0, -1) } : e));
    });
  };

  // Historial de los últimos 7 días (para decidir qué toca hoy en Sensaciones).
  const last7FlexDays = (() => {
    const out: { ts: number; label: string; what: string }[] = [];
    const rest = new Set((profile?.flexRestDays ?? []).map((t) => inicioDelDia(t)));
    for (let i = 0; i < 7; i++) {
      const ts = masDias(Date.now(), -i);
      const d = new Date(ts);
      const logsThatDay = history.filter(
        (l) => routine && l.routineId === routine.id && inicioDelDia(l.date) === ts
      );
      // Un día pasado sin nada registrado ES un descanso, lo haya marcado el
      // alumno o no: si no entrenó, descansó. Antes salía un guion, que no
      // dice nada y deja el historial lleno de huecos.
      //
      // HOY se queda sin marcar a propósito: el día no ha terminado y darlo
      // por descanso a media mañana sería contarle un día que aún puede hacer.
      const what = logsThatDay.length
        ? logsThatDay.map((l) => l.dayName).join(', ')
        : rest.has(ts)
          ? 'Descanso'
          : i === 0
            ? '—'
            : 'Descanso';
      out.push({
        ts,
        label:
          i === 0
            ? 'Hoy'
            : i === 1
              ? 'Ayer'
              : diaSemanaCorto(d),
        what,
      });
    }
    return out;
  })();

  // Descanso opcional (Día 7 TENA): reinicia el ciclo entrenando el Día 1 hoy.
  const handleStartCycleToday = async () => {
    if (!routine || routine.days.length === 0) return;
    const decision = await setCycleAnchorToday(routine.id, profile?.planPauses);
    setCycleAnchor(decision);
    // Sincroniza el día del ciclo con el resto de dispositivos de la cuenta.
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, decision.ancla, decision.decididaEn);
    setOptionalResolved(true);
    setRestingToday(false);
    const firstDay = routine.days[0];
    setSelectedDayId(firstDay.id);
    setViewIndex(0);
    startedAt.current = null;
    showToast('Ciclo reiniciado · hoy es el Día 1');
  };

  // Fija qué día del ciclo es HOY (plan desfasado o entreno pospuesto).
  const handleSetTodayIndex = async (index: number) => {
    if (!routine || routine.days.length === 0) return;
    const decision = await setCycleAnchorForIndex(routine.id, index, profile?.planPauses);
    setCycleAnchor(decision);
    if (profile) setCycleAnchorRemote(profile.uid, routine.id, decision.ancla, decision.decididaEn);
    setOptionalResolved(true);
    setRestingToday(false);
    setSelectedDayId(routine.days[index].id);
    setViewIndex(0);
    setDayPickerOpen(false);
    showToast(frase`Hoy es el Día ${index + 1}`);
  };

  const isOptionalRestToday = routine?.schedule === 'cycle' && todaySession.optionalRest;
  const showOptionalChoice = isOptionalRestToday && !optionalResolved;
  const showRestingCard = isOptionalRestToday && optionalResolved && restingToday;

  const handleShareSummary = async () => {
    if (!summary || !routine) return;
    // Imagen de marca (mucho más vistosa que el texto). Si por lo que sea no
    // se puede generar, se comparte el resumen escrito.
    try {
      const result = await shareSessionImage({
        routineName: routine.name,
        dayName: day?.name,
        durationMin: summary.durationMin,
        sets: summary.sets,
        reps: summary.reps,
        seconds: summary.seconds,
        volumeKg: summary.volumeKg,
        streak: summary.streak,
        prCount: summary.prs.length,
        date: Date.now(),
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${day?.name ?? routine.name}`,
      summary.durationMin > 0 ? `${summary.durationMin} min` : null,
      frase`${summary.sets} series`,
      summary.reps > 0 ? `${summary.reps} reps` : null,
      summary.seconds > 0 ? `${summary.seconds}s isométrico` : null,
      summary.volumeKg > 0 ? frase`${summary.volumeKg} kg de volumen` : null,
      summary.prs.length > 0
        ? `${summary.prs.length} récord${summary.prs.length > 1 ? 's' : ''} personal${
            summary.prs.length > 1 ? 'es' : ''
          }`
        : null,
      summary.streak > 1 ? frase`Racha: ${summary.streak} días` : null,
    ].filter(Boolean);
    const message = frase`${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      // El usuario canceló o el navegador no soporta compartir: copiamos.
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  // Comparte una sesión YA guardada hoy (pantalla "entrenamiento terminado"),
  // reconstruyendo las estadísticas desde el registro guardado.
  const handleShareCompleted = async (logToShare: WorkoutLog) => {
    if (!routine) return;
    const t = sessionTotals(logToShare.exercises, measureByExercise);
    try {
      const result = await shareSessionImage({
        routineName: logToShare.routineName ?? routine.name,
        dayName: logToShare.dayName,
        durationMin: logToShare.durationMin ?? 0,
        sets: t.sets,
        reps: t.reps,
        seconds: t.seconds,
        volumeKg: t.volumeKg,
        streak: 0,
        prCount: 0,
        date: logToShare.date,
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${logToShare.dayName ?? routine.name}`,
      logToShare.durationMin ? `${logToShare.durationMin} min` : null,
      frase`${t.sets} series`,
      t.reps > 0 ? `${t.reps} reps` : null,
      t.seconds > 0 ? `${t.seconds}s isométrico` : null,
      t.volumeKg > 0 ? frase`${t.volumeKg} kg de volumen` : null,
    ].filter(Boolean);
    const message = frase`${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  // Comparte el récord como IMAGEN de marca (canvas 1080×1350, para stories).
  // Si la imagen no es posible (nativo antiguo, canvas no disponible), texto.
  const handleShareRecord = async () => {
    if (!summary || summary.prs.length === 0) return;
    try {
      const result = await shareRecordImage({
        prs: summary.prs.map((p) => ({ exerciseName: p.exerciseName, label: p.label })),
        streak: summary.streak,
      });
      if (result === 'downloaded') showToast('Imagen del récord descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const lines = summary.prs.map((pr) => `${pr.exerciseName}: ${pr.label}`);
    const message = `NUEVO RÉCORD PERSONAL\n\n${lines.join('\n')}\n\n${
      summary.streak > 1 ? frase`Racha de ${summary.streak} días\n` : ''
    }Entrenando con UDECA — Universidad de Calistenia\nwww.udeca.app`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Récord copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'seconds' | 'side2' | 'weight' | 'completed',
    value: string | boolean
  ) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );

    // Al completar una serie: arranca el crono de descanso del ejercicio.
    // (En clúster, el descanso CORTO entre bloques se pide aparte: ver
    // `descansoDeBloque`. Este es el descanso largo, el de la serie entera.)
    if (field === 'completed' && value === true) {
      if (!startedAt.current) startedAt.current = Date.now();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // ¿Acaba de batir su marca? Se comprueba con el estado NUEVO, porque el
      // de React todavía no se ha actualizado cuando llega aquí.
      const ejercicio = log[exerciseIndex];
      if (ejercicio && !prCelebrados.current.has(ejercicio.exerciseId)) {
        const conLaSerie = ejercicio.sets.map((s2, j) =>
          j === setIndex ? { ...s2, completed: true } : s2
        );
        const record = checkLivePR(history, ejercicio, conLaSerie);
        if (record) {
          prCelebrados.current.add(record.exerciseId);
          setPrVivo(record);
        }
      }
      // En superserie no hay descanso: se encadena con el siguiente ejercicio.
      const nextIsLinked = day?.exercises[exerciseIndex + 1]?.supersetWithPrevious === true;
      if (!nextIsLinked) {
        const rest = day?.exercises[exerciseIndex]?.restSeconds || DEFAULT_REST_SECONDS;
        // Qué toca al terminar el descanso: otra serie del mismo ejercicio o el siguiente.
        const setsInEx = log[exerciseIndex]?.sets.length ?? 0;
        const exName = log[exerciseIndex]?.name ?? '';
        const nextEx = day?.exercises[exerciseIndex + 1];
        const nextLabel =
          setIndex + 1 < setsInEx
            ? frase`Ahora: Serie ${setIndex + 2} · ${exName}`
            : nextEx
              ? `Ahora: ${nextEx.name}`
              : 'Última serie hecha · guarda la sesión';
        startRest(rest, nextLabel);
      }

      // Autoavance: si al marcar esta serie el ejercicio queda COMPLETO, pasa
      // solo al siguiente (deja ver el ✓ un instante). El último no avanza.
      const exSets = log[exerciseIndex]?.sets ?? [];
      const nowAllDone =
        exSets.length > 0 && exSets.every((s, j) => (j === setIndex ? true : s.completed));
      if (nowAllDone && exerciseIndex < log.length - 1) {
        setTimeout(() => {
          setViewIndex((cur) => (cur === exerciseIndex ? exerciseIndex + 1 : cur));
        }, 900);
      }
    }
  };

  /**
   * Marca de un bloque de una serie en clúster. El bloque 1 es la casilla de
   * siempre (`reps`); estos son los siguientes, y viven en `clusters` para no
   * tocar nada de lo que ya lee la marca principal.
   */
  const updateCluster = (
    exerciseIndex: number,
    setIndex: number,
    blockIndex: number,
    value: string
  ) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => {
                if (j !== setIndex) return s;
                const marcas = [...(s.clusters ?? [])];
                while (marcas.length <= blockIndex) marcas.push('');
                marcas[blockIndex] = value;
                return { ...s, clusters: marcas };
              }),
            }
          : ex
      )
    );
  };

  /** Descanso corto entre bloques de un clúster, el que fija el entrenador. */
  const descansoDeBloque = (segundos: number, exName: string) => {
    if (!startedAt.current) startedAt.current = Date.now();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    startRest(segundos, `Ahora: siguiente bloque · ${exName}`);
  };

  // Nota escrita del alumno sobre un ejercicio (p. ej. "hice la variante X").
  const updateExerciseNote = (exerciseIndex: number, value: string) => {
    setLog((prev) =>
      prev.map((ex, i) => (i === exerciseIndex ? { ...ex, notes: value } : ex))
    );
  };

  /**
   * Esfuerzo del ejercicio (RIR). Se puede desmarcar volviendo a pulsar: si no
   * se puede quitar un dato que se ha metido sin querer, la gente deja de
   * meterlo.
   */
  const updateExerciseRir = (exerciseIndex: number, value: number) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex ? { ...ex, rir: ex.rir === value ? undefined : value } : ex
      )
    );
  };

  // El esfuerzo solo se le pregunta a quien sabe contestarlo: al atleta
  // siempre (se autoentrena) y al alumno que su entrenador haya marcado. A
  // quien empieza, el RIR no le suena y lo rellenaría al azar.
  const pideRir = profile?.role === 'athlete' || profile?.trackRir === true;

  const totalSets = log.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = log.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
  // Índice visible en el modo enfocado (acotado por si la lista cambió).
  const safeIndex = Math.min(viewIndex, Math.max(0, log.length - 1));
  const isLastExercise = safeIndex >= log.length - 1;

  // ¿Ya se ha entrenado HOY (rutina semanal, ciclo o Sensaciones)? Si hay una
  // sesión guardada hoy y no hay otra en curso, mostramos "entrenamiento
  // terminado" con estadísticas y compartir, sin dejar entrenar de nuevo hasta
  // el día siguiente.
  const completedTodayLog = routine
    ? history.find((l) => l.routineId === routine.id && esMismoDia(l.date))
    : undefined;
  const inProgress = doneSets > 0 || restored;
  /**
   * ¿Ha empezado ya de verdad?
   *
   * Más pronto que `inProgress`: cuenta desde que se escribe la primera
   * repetición, no desde que se cierra la primera serie. Se usa para quitar de
   * en medio lo que solo tiene sentido antes de empezar.
   */
  const sesionEmpezada =
    inProgress || (!!pristineRef.current && JSON.stringify(log) !== pristineRef.current);

  /**
   * ¿Está el entreno en marcha en la pantalla?
   *
   * O se ha pulsado "Empezar entreno", o ya hay algo escrito —un borrador
   * recuperado, una corrección, un entreno a medias de antes—. Ese segundo
   * caso importa: quien vuelve a una sesión empezada no tiene que volver a
   * pulsar nada, se encuentra sus series donde las dejó.
   *
   * Antes de eso, la pantalla enseña con qué se llega —el último entreno, la
   * rutina diaria y apuntar otro día— y nada más. Las tres cosas dejan de
   * tener sentido en el momento en que se está entrenando, que es cuando
   * estorban: es entonces cuando la pantalla tiene que ser solo el ejercicio.
   */
  const enMarcha = sesionEmpezada || diaEmpezado === (day?.id ?? null);

  /**
   * Por dónde ibas: el último entreno de ESTA rutina.
   *
   * Es lo que permite retomar un ciclo en vez de reiniciarlo. Se calcula aquí,
   * con el historial ya cargado, y se le pasa a la tarjeta de arriba.
   */
  const ultimoEntreno = ultimoEntrenoDe(history, routine);
  // En Sensaciones, "flexAgain" permite ignorar la tarjeta de completado para
  // encadenar un segundo entreno el mismo día.
  const showCompleted = !!completedTodayLog && !inProgress && !corrigiendo && !(isFlex && flexAgain);

  /**
   * Vuelve a abrir el entreno ya guardado para corregirlo.
   *
   * "Terminar entreno" es un botón grande al final de una lista de series: se
   * pulsa sin querer, y se pulsa faltando la última serie por apuntar. Hasta
   * ahora la única salida era borrar la sesión y rehacerla entera —perdiendo la
   * hora, la duración y todo lo demás—, así que en la práctica el alumno se
   * quedaba con el dato mal. Esto lo reabre tal cual estaba: al guardar se
   * ACTUALIZA la misma sesión, no se crea otra.
   */
  const corregirEntreno = () => {
    if (!completedTodayLog) return;
    // Se monta un día a partir de la propia sesión guardada, y no se confía en
    // el día seleccionado: en Sensaciones el entreno pudo ser una combinación
    // que ya no existe como día de la rutina, y sin día `handleSave` se rinde
    // en la primera línea y el botón de guardar no haría nada.
    setCombinedDay({
      id: `corregir-${completedTodayLog.id}`,
      name: completedTodayLog.dayName || 'Entreno',
      exercises: completedTodayLog.exercises.map((ex, i) => ({
        id: `${completedTodayLog.id}-${i}`,
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets.length,
        reps: '',
        measure: ex.measure,
        load: ex.load,
      })),
    });
    setCorrigiendo(completedTodayLog.id);
    setLog(completedTodayLog.exercises);
    // La referencia pasa a ser lo ya guardado: así no se escribe un borrador
    // por el simple hecho de abrir la corrección, solo si se cambia algo.
    pristineRef.current = JSON.stringify(completedTodayLog.exercises);
    setViewIndex(0);
    setSummary(null);
    // La duración ya está calculada y guardada: corregir series no significa
    // que la sesión haya durado desde ahora hasta que se pulse guardar.
    startedAt.current = null;
    showToast('Corrigiendo el entreno. Al guardar se actualiza el mismo.');
  };

  /** Sale de la corrección sin escribir nada: la sesión se queda como estaba. */
  const cancelarCorreccion = () => {
    if (!routine) return;
    setCorrigiendo(null);
    setCombinedDay(null);
    dejarElDiaLimpio();
    olvidarBorrador();
  };

  // Lo que se toca una vez al mes vive detrás del punto de la cabecera, no
  // ocupando dos filas encima de la primera serie.
  const accionesSesion: AccionRapida[] = [
    // El atleta se autoentrena: si hoy también hace remo, lo mete y ya.
    ...(esAtleta && !showCompleted && !esModoGtg && day && !day.isRest
      ? ([
          {
            icono: 'add-circle-outline' as const,
            texto: 'Añadir un ejercicio a esta sesión',
            onPress: () => setAnadirEjOpen(true),
          },
        ] satisfies AccionRapida[])
      : []),
    ...(routine?.schedule === 'cycle'
      ? ([
          {
            icono: 'refresh' as const,
            texto: todaySession.cycleLabel
              ? `Reiniciar ciclo (hoy: ${todaySession.cycleLabel})`
              : 'Reiniciar ciclo',
            onPress: () => {
              handleStartCycleToday();
            },
          },
          {
            icono: 'calendar-outline' as const,
            texto: 'Fijar el día de hoy',
            onPress: () => setDayPickerOpen(true),
          },
        ] satisfies AccionRapida[])
      : []),
    ...(isFlex && combinedDay && !corrigiendo
      ? ([
          {
            icono: 'close-circle-outline' as const,
            texto: 'Cancelar este entreno',
            onPress: cancelFlexSession,
            peligro: true,
          },
        ] satisfies AccionRapida[])
      : []),
    // Salir de la corrección sin tocar nada. Quien entra por error a arreglar
    // algo tiene que poder salir por donde entró, con su sesión intacta.
    ...(corrigiendo
      ? ([
          {
            icono: 'arrow-undo-outline' as const,
            texto: 'Dejar el entreno como estaba',
            onPress: cancelarCorreccion,
          },
        ] satisfies AccionRapida[])
      : []),
  ];

  /*
   * ---------- Grease the groove ----------
   *
   * Aquí no se abre una sesión: se entra, se apunta una serie y se sale, seis u
   * ocho veces al día. Por eso no pasa por el borrador ni por "Terminar
   * entreno": cada serie se escribe directamente en el registro del día, que es
   * UNO solo. Si cada serie creara su entreno, la racha contaría ocho días en
   * uno y el histórico tendría ocho filas por jornada.
   */
  const gtgLog =
    routine && esModoGtg ? entrenoDeHoy(history, routine.id, Date.now(), nombreGtg) : null;

  const anadirSerieGtg = async (exerciseId: string, nombre: string, marca: string) => {
    if (!profile || !routine) return;
    const enPlan = diaGtg?.exercises.find((e) => e.exerciseId === exerciseId);
    const measure = enPlan?.measure ?? measureByExercise[exerciseId] ?? 'reps';
    setSaving(true);
    try {
      const exercises = conSerieAnadida(
        gtgLog?.exercises ?? [],
        { exerciseId, name: nombre, measure },
        marca
      );
      if (gtgLog) {
        await updateWorkoutLog(gtgLog.id, { exercises });
      } else {
        await createWorkoutLog({
          trainerId: routine.trainerId,
          clientId: profile.uid,
          routineId: routine.id,
          routineName: routine.name,
          dayName: nombreGtg ?? 'Grease the groove',
          date: Date.now(),
          exercises,
        });
        // Con la primera serie el día ya está empezado: sobra el aviso de las
        // ocho de la tarde diciendo que no ha entrenado.
        cancelarAvisosOlvido().catch(() => {});
      }
      const freshLogs = await getWorkoutLogsForClient(profile.uid);
      setHistory(freshLogs);
      if (!gtgLog) syncMySocialStats(profile, freshLogs).catch(() => {});
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } catch {
      // Sin la cola de offline a propósito: la cola solo sabe CREAR entrenos, y
      // aquí casi todas las series son una actualización del registro del día.
      // Encolarlas crearía un entreno suelto por serie, que es justo lo que
      // este modo evita.
      showToast('No se pudo apuntar la serie. Inténtalo en un momento.');
    } finally {
      setSaving(false);
    }
  };

  const quitarSerieGtg = async () => {
    if (!profile || !gtgLog) return;
    setSaving(true);
    try {
      const exercises = sinLaUltimaSerie(gtgLog.exercises);
      // Si era la única serie del día, el entreno entero se va: un registro sin
      // series contaría como día entrenado en la racha sin haber hecho nada.
      if (exercises.length === 0) await deleteWorkoutLog(gtgLog.id);
      else await updateWorkoutLog(gtgLog.id, { exercises });
      setHistory(await getWorkoutLogsForClient(profile.uid));
    } catch {
      showToast('No se pudo quitar la serie');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !routine || !day) return;
    setSaving(true);
    setSaveError(null);
    try {
      const durationMin = startedAt.current
        ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
        : 0;
      // Si no marcó ninguna serie, damos la sesión por hecha igualmente (para
      // que cuente): marcamos todas las series como completadas.
      const baseLog =
        doneSets > 0
          ? log
          : log.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, completed: true })) }));
      // Sella la medida ACTUAL de cada ejercicio para que el histórico y las
      // estadísticas la interpreten bien años después, aunque el entrenador
      // cambie la ficha del ejercicio. Manda la del plan; si no la trae, la de
      // la biblioteca; y si tampoco, reps.
      const finalLog: LoggedExercise[] = baseLog.map((ex) => {
        const candidata = ex.measure ?? measureByExercise[ex.exerciseId];
        const measure: ExerciseMeasure = EXERCISE_MEASURES.includes(
          candidata as ExerciseMeasure
        )
          ? (candidata as ExerciseMeasure)
          : 'reps';
        return { ...ex, measure };
      });
      // Corrigiendo, la sesión que se edita NO cuenta como historial contra el
      // que compararse: si contara, cada marca se compararía consigo misma y no
      // habría récord posible ni aunque el alumno acabe de apuntar su mejor
      // serie, que es justo lo que se estaba corrigiendo.
      const historyBase = corrigiendo ? history.filter((l) => l.id !== corrigiendo) : history;
      const prs = detectNewPRs(historyBase, finalLog);
      const totals = sessionTotals(finalLog);
      // Logros que estaban desbloqueados antes de esta sesión (base entrenos).
      const beforeUnlocked = new Set(
        computeAchievements(historyBase, []).filter((a) => a.unlocked).map((a) => a.id)
      );

      const payload = {
        trainerId: routine.trainerId,
        clientId: profile.uid,
        routineId: routine.id,
        routineName: routine.name,
        dayName: day.name,
        // Si estamos rellenando el entreno de otro día, se registra con SU fecha.
        date: resumeDate ?? Date.now(),
        exercises: finalLog,
        ...(durationMin > 0 ? { durationMin } : {}),
      };

      /*
       * Corrigiendo se ACTUALIZA la sesión, no se crea otra. Es la diferencia
       * entre arreglar un dedo y acabar con dos entrenos el mismo día.
       *
       * Y sin la red de la cola de offline: encolar una corrección crearía un
       * duplicado al subirse (la cola solo sabe crear), así que si no hay
       * conexión es mejor decirlo y que el alumno lo intente luego, con su
       * sesión original intacta.
       */
      if (corrigiendo) {
        await updateWorkoutLog(corrigiendo, {
          exercises: finalLog,
          // La duración no se recalcula: la sesión duró lo que duró, y el rato
          // que se tarde en corregirla no es tiempo entrenando.
          ...(completedTodayLog?.durationMin ? { durationMin: completedTodayLog.durationMin } : {}),
        });
        const freshLogs = await getWorkoutLogsForClient(profile.uid);
        setHistory(freshLogs);
        setCorrigiendo(null);
        setCombinedDay(null);
        // Se vuelve a dejar el día como está: si el log siguiera lleno de
        // series marcadas, la pantalla creería que hay un entreno en curso y
        // no volvería a enseñar la tarjeta de terminado. Y el borrador que se
        // haya ido escribiendo mientras se corregía ya no vale: si se quedara,
        // mañana se ofrecería como "entreno sin terminar".
        dejarElDiaLimpio();
        olvidarBorrador();
        showToast('Entreno corregido');
        return;
      }

      let freshLogs: WorkoutLog[];
      let savedOffline = false;
      try {
        await createWorkoutLog(payload);
        freshLogs = await getWorkoutLogsForClient(profile.uid);
        syncMySocialStats(
          profile,
          freshLogs,
          prs.length > 0
            ? { exerciseName: prs[0].exerciseName, label: prs[0].label, date: Date.now() }
            : undefined
        ).catch(() => {});
        // Aviso al coach en tiempo real (nunca bloquea el guardado).
        notifyUser(
          routine.trainerId,
          'Sesión completada',
          `${profile.name.split(' ')[0]} ha terminado ${day.name} (${totals.sets} series${
            prs.length > 0 ? `, ${prs.length} récord${prs.length > 1 ? 's' : ''}` : ''
          }).`
        ).catch(() => {});
      } catch {
        // Sin conexión (o Firestore caído): el entreno se encola en el
        // dispositivo y se subirá solo. La sesión NUNCA se pierde.
        await enqueueWorkout(payload);
        savedOffline = true;
        freshLogs = [
          { id: `pending-${Date.now()}`, ...payload, createdAt: Date.now() } as WorkoutLog,
          ...history,
        ];
      }
      const newAchievements = computeAchievements(freshLogs, []).filter(
        (a) => a.unlocked && !beforeUnlocked.has(a.id)
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Sesión registrada: fuera los avisos de "se te ha olvidado subirlo".
      // Va aquí y no solo en el guardado en línea porque un entreno encolado
      // sin conexión también está hecho: el aviso de las 20:00 no puede saltar
      // si a las 19:40 el alumno ya lo ha dado por terminado.
      cancelarAvisosOlvido().catch(() => {});
      stopRest();
      // También el de arrastre: la sesión ya está registrada, así que ese
      // entreno de un día anterior deja de estar esperando.
      olvidarBorrador({ tambienElPendiente: true });
      setRestored(false);
      setResumeDate(null);
      setPastDraft(null);
      setPastDismissed(false);
      setFlexAgain(false); // consumido: tras guardar vuelve la tarjeta de completado
      // Limpia el "día combinado" de Sensaciones para que no contamine la
      // próxima sesión (evita que un entreno futuro herede este nombre).
      setCombinedDay(null);
      // Deja el estado detrás del resumen "limpio": el día queda como completado
      // (doneSets 0), de modo que nunca se vuelven a mostrar sus ejercicios.
      if (day) setLog(buildLog(day));
      setViewIndex(0);
      startedAt.current = null;
      setSummary({
        durationMin,
        ...totals,
        prs,
        streak: currentStreak(freshLogs, {
          routine,
          cycleAnchor,
          pausas: profile?.planPauses,
          // Los días de pausa entran igual que en la pantalla de inicio. Sin
          // ellos, la racha del resumen del entreno salía más corta que la de
          // la portada, en la misma app y en el mismo minuto.
          restDays: [...(profile?.flexRestDays ?? []), ...diasDePausa(profile?.planPauses)],
        }),
        newAchievements,
      });
      if (savedOffline) {
        showToast('Sin conexión: la sesión se subirá sola al recuperarla');
      } else if (newAchievements.length > 0) {
        showToast(`¡Logro desbloqueado: ${newAchievements[0].title}!`);
      }
      setHistory(freshLogs);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la sesión.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!routine || routine.days.length === 0) {
    return (
      <ScreenContainer>
        <Pressable
          onPress={() => router.push('/(client)/dashboard')}
          style={styles.exitBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
          <Text style={styles.exitText}>Volver a inicio</Text>
        </Pressable>
        <Text style={styles.title}>Mi entrenamiento</Text>
        <EmptyState
          icon="barbell-outline"
          title="Sin rutina asignada"
          subtitle="Tu entrenador todavía no te ha asignado una rutina. Vuelve a comprobarlo pronto."
        />
      </ScreenContainer>
    );
  }

  // ---------- Resumen post-entreno ----------
  if (summary) {
    return (
      <ResumenEntreno
        cifras={summary}
        titulo="¡Entrenamiento completado!"
        subtitulo={unido(routine.name, day?.name)}
        prs={summary.prs}
        logros={summary.newAchievements}
        racha={summary.streak}
        onCompartir={handleShareSummary}
        onCompartirRecord={handleShareRecord}
        onIrAInicio={() => router.push('/(client)/dashboard')}
        onCorregir={() => {
          setSummary(null);
          corregirEntreno();
        }}
      />
    );
  }

  // ---------- Modo entreno ----------
  return (
    <ScreenContainer contentStyle={activeRest ? styles.restSpacer : undefined}>
      {prVivo ? (
        <PRBurst
          key={`${prVivo.exerciseId}-${prVivo.label}`}
          exerciseName={prVivo.exerciseName}
          label={prVivo.label}
          previous={prVivo.previous}
          onDone={() => setPrVivo(null)}
        />
      ) : null}

      <SessionHeader
        titulo={routine.name}
        dia={day && !showCompleted && !esModoGtg ? day.name : null}
        intensidad={showCompleted || esModoGtg ? null : textoIntensidad(day, routine.schedule)}
        hechas={doneSets}
        // En grease the groove el anillo del día lo lleva su propia pantalla,
        // con las series repartidas; dos anillos distintos en la misma pantalla
        // se leen mal.
        totales={showCompleted || esModoGtg ? 0 : totalSets}
        acciones={accionesSesion}
        onSalir={() => {
          // Con la sesión en marcha no se sale a la ligera: confirmación.
          if (inProgress) setExitConfirmOpen(true);
          else router.push('/(client)/dashboard');
        }}
      />

      {/* Plan en pausa. Se avisa, pero no se cierra la pantalla: si hoy apetece
          entrenar, este entreno cuenta igual que cualquier otro. */}
      {enPausa && !showCompleted ? (
        <View style={styles.pausaAviso}>
          <Ionicons name="pause-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.pausaAvisoTexto}>
            Tu plan está en pausa hasta el {diaLargo(enPausa.hasta)}. Hoy no se
            espera nada, pero si entrenas cuenta igual.
          </Text>
        </View>
      ) : null}

      {/* Entreno de un día anterior sin finalizar: rellenarlo o dejarlo para luego. */}
      {pastDraft && !pastDismissed && !restored ? (
        <FadeIn>
          <View style={styles.pastDraftCard}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pastDraftTitle}>Tienes un entreno sin terminar</Text>
              <Text style={styles.pastDraftSub}>
                {`${pastDraft.dayName ? `${pastDraft.dayName} · ` : ''}${diaSemanaCorto(
                  pastDraft.startedAt ?? pastDraft.savedAt
                )}`}
              </Text>
            </View>
            <View style={styles.pastDraftActions}>
              <Pressable onPress={resumePastDraft} style={styles.pastDraftFill} hitSlop={6}>
                <Text style={styles.pastDraftFillText}>Rellenar datos</Text>
              </Pressable>
              <Pressable onPress={dismissPastDraft} hitSlop={6}>
                <Text style={styles.pastDraftLater}>Más tarde</Text>
              </Pressable>
            </View>
          </View>
        </FadeIn>
      ) : null}

      {/* Apuntar un entreno de otro día, a la vista y no en el menú de los tres
          puntos: es aquí donde uno se da cuenta de que ayer no lo apuntó.

          Solo AL PRINCIPIO. En cuanto se toca algo desaparece, porque lo que
          toca entonces es entrenar y no ponerse a rellenar el martes pasado.

          Antes bastaba con `inProgress`, y `inProgress` solo es verdad cuando
          ya se ha COMPLETADO una serie. Entre "he escrito 8 repeticiones" y
          "he cerrado la primera serie" hay un rato entero en el que la persona
          ya está entrenando y le seguía saliendo. Ahora se compara el entreno
          con el que salió en blanco: si difiere en algo, es que está en
          marcha. */}


      {/* La técnica del ejercicio, a casi toda la pantalla y dentro de la app.
          Sin blindar, a diferencia de las clases de un curso: esto es un enlace
          público que el entrenador ha pegado, no material de pago, y el
          blindaje es la parte más frágil del reproductor (ver
          components/VisorDeVideo). Sigue con marca de agua y sin poder navegar
          fuera de la app. */}
      <VisorDeVideo
        visible={videoAbierto !== null}
        url={videoAbierto?.url}
        titulo={videoAbierto?.titulo}
        profile={profile}
        onCerrar={() => setVideoAbierto(null)}
        protegido={false}
      />

      <Modal
        visible={exitConfirmOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setExitConfirmOpen(false)}
      >
        <View style={styles.exitBackdrop}>
          <Card accent style={styles.exitCard}>
            <Ionicons name="barbell" size={26} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.exitTitle}>Estás entrenando</Text>
            <Text style={styles.exitMsg}>
              Termina tu sesión antes de salir: tu progreso lo merece. Si sales, la sesión queda
              guardada y podrás retomarla.
            </Text>
            <Button
              title="Seguir entrenando"
              onPress={() => setExitConfirmOpen(false)}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Salir (emergencia)"
              variant="ghost"
              onPress={() => {
                setExitConfirmOpen(false);
                router.push('/(client)/dashboard');
              }}
              style={{ marginTop: spacing.xs }}
            />
          </Card>
        </View>
      </Modal>

      {/* Elegir el día: en la portada. En directo la pantalla es el ejercicio y
          nada más; cambiar de día a mitad de una serie no es una función, es
          una forma de perder lo apuntado. */}
      {enMarcha || isFlex || esModoGtg ? null : (
        <ChipRow scroll>
          {routine.days.map((d, i) => {
            const isCycle = routine.schedule === 'cycle';
            const isToday = isCycle
              ? todaySession.cycleIndex === i
              : d.weekday === todayWeekday();
            return (
              <Chip
                key={d.id}
                texto={
                  (isCycle
                    ? frase`Día ${i + 1}`
                    : `${d.weekday !== undefined ? `${WEEKDAY_NAMES[d.weekday].slice(0, 3)} · ` : ''}${d.name}`) +
                  (d.optionalRest ? ' · descanso opcional' : d.isRest ? ' · descanso' : '') +
                  (isToday ? '  ·  HOY' : '')
                }
                activo={selectedDayId === d.id}
                onPress={() => {
                  setSelectedDayId(d.id);
                  // Tocar un día resuelve el descanso opcional: se entrena ese día.
                  setOptionalResolved(true);
                  setRestingToday(false);
                }}
              />
            );
          })}
        </ChipRow>
      )}

      {!showCompleted && isFlex && flexResting ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Hoy descansas. No cuenta contra tu racha. Vuelve mañana con todo.
            </Text>
            <Button
              title="Mejor entrenar"
              variant="secondary"
              onPress={() => {
                setFlexResting(false);
                // Deshace el descanso persistido para que no reaparezca al volver.
                if (profile) removeFlexRestDay(profile.uid, inicioDelDia(Date.now())).catch(() => {});
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : !showCompleted && isFlex && !combinedDay ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>{flexLabel(routine.scheduleLabel)}</Text>
            </View>
            <Text style={styles.optionalText}>
              ¿Cómo te sientes hoy? Marca una o varias rutinas (en el orden que quieras hacerlas):
            </Text>
            {routine.days.map((d) => {
              const pos = flexSelection.indexOf(d.id);
              const on = pos >= 0;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => toggleFlexRoutine(d.id)}
                  style={[styles.flexPick, on && styles.flexPickOn]}
                >
                  <View style={[styles.flexCheck, on && styles.flexCheckOn]}>
                    {on ? <Text style={styles.flexCheckNum}>{pos + 1}</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.flexPickText, on && styles.flexPickTextOn]}>
                      {d.name || 'Rutina'}
                      {d.exercises.length
                        ? ` · ${d.exercises.length} ${d.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`
                        : ''}
                    </Text>
                    {/* Lo que va a pedir esa rutina, ANTES de elegirla: es
                        justo el dato sobre el que se decide "cómo me siento
                        hoy", y hasta ahora no estaba en ninguna parte. */}
                    {d.gtg ? (
                      <Text style={styles.flexPickPct}>
                        Todo el día · {objetivoDelDia(routine, d)} series sueltas, ninguna al fallo
                      </Text>
                    ) : d.intensityPct ? (
                      <Text style={styles.flexPickPct}>
                        {esfuerzoDePct(d.intensityPct)} · {d.intensityPct} %
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Button
              title={
                flexSelection.length > 1
                  ? `Empezar (${flexSelection.length} rutinas)`
                  : 'Empezar'
              }
              onPress={startFlexSession}
              disabled={flexSelection.length === 0}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Hoy descanso"
              variant="ghost"
              onPress={chooseFlexRest}
              style={{ marginTop: spacing.xs }}
            />

            {/* Últimos 7 días para saber qué te toca hoy. */}
            <View style={styles.flexHistory}>
              <Text style={styles.flexHistoryLabel}>Tus últimos 7 días</Text>
              {last7FlexDays.map((h) => (
                <View key={h.ts} style={styles.flexHistoryRow}>
                  <Text style={styles.flexHistoryDate}>{h.label}</Text>
                  <Text style={styles.flexHistoryWhat}>{h.what}</Text>
                </View>
              ))}
            </View>
          </Card>
        </FadeIn>
      ) : null}

      {/* El atleta mete un ejercicio a mitad de sesión: de su biblioteca si lo
          tiene, o escribiendo el nombre si es la primera vez que lo hace. */}
      <Sheet
        visible={anadirEjOpen}
        onClose={() => {
          setAnadirEjOpen(false);
          setBuscaEj('');
        }}
        titulo="Añadir un ejercicio"
        descripcion="Se añade solo a la sesión de hoy. Tu plan se queda como está."
      >
        <TextField
          value={buscaEj}
          onChangeText={setBuscaEj}
          placeholder="Busca o escribe el nombre"
          autoFocus
          onSubmitEditing={() => anadirEjercicioSuelto(buscaEj)}
          returnKeyType="done"
        />
        {libreria
          .filter((e) =>
            buscaEj.trim()
              ? e.name.toLowerCase().includes(buscaEj.trim().toLowerCase())
              : true
          )
          .slice(0, 8)
          .map((e) => (
            <Pressable
              key={e.id}
              onPress={() => anadirEjercicioSuelto(e.name, e.id, e.measure)}
              style={styles.filaBiblioteca}
            >
              <Ionicons name="barbell-outline" size={16} color={colors.textMuted} />
              <Text style={styles.filaBibliotecaTexto} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={styles.filaBibliotecaGrupo} numberOfLines={1}>
                {e.muscleGroup}
              </Text>
            </Pressable>
          ))}
        {/* Lo que se escribe vale aunque no esté en la biblioteca: la sesión no
            es el sitio para dar de alta ejercicios con su ficha entera. */}
        {buscaEj.trim() &&
        !libreria.some((e) => e.name.toLowerCase() === buscaEj.trim().toLowerCase()) ? (
          <Button
            title={`Añadir "${buscaEj.trim()}"`}
            onPress={() => anadirEjercicioSuelto(buscaEj)}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </Sheet>

      {/* Fijar qué día del ciclo es HOY (plan desactualizado o día pospuesto). */}
      <Sheet
        visible={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        titulo="¿Qué día del plan es hoy?"
        descripcion="Si pospusiste un entreno o el plan va desfasado, elige el día que te toca hoy y toda la programación se recoloca desde ahí."
      >
        {routine.days.map((d, i) => (
          <Button
            key={d.id}
            title={frase`Día ${i + 1}${d.name ? ` · ${d.name}` : ''}${d.isRest ? t(' (descanso)') : ''}`}
            variant={todaySession.cycleIndex === i ? 'primary' : 'secondary'}
            onPress={() => handleSetTodayIndex(i)}
            style={{ marginTop: spacing.sm }}
          />
        ))}
      </Sheet>

      {esModoGtg ? (
        <PantallaGtg
          routine={routine}
          dia={diaGtg}
          entrenoDeHoy={gtgLog}
          guardando={saving}
          onAnadirSerie={anadirSerieGtg}
          onDeshacer={quitarSerieGtg}
        />
      ) : showOptionalChoice ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="shuffle" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Hoy: descanso opcional</Text>
            </View>
            <Text style={styles.optionalText}>
              {todaySession.cycleLabel ? `${todaySession.cycleLabel}. ` : ''}Puedes descansar hoy, o
              reiniciar el ciclo y entrenar el Día 1 ahora. Tú decides.
            </Text>
            <Button
              title="Entrenar Día 1 ahora"
              onPress={handleStartCycleToday}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              title="Descansar hoy"
              variant="secondary"
              onPress={() => {
                setOptionalResolved(true);
                setRestingToday(true);
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : showRestingCard ? (
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Disfruta tu descanso. El ciclo continuará solo con el Día 1.
            </Text>
            <Button
              title="He cambiado de idea: entrenar Día 1"
              variant="secondary"
              onPress={handleStartCycleToday}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </FadeIn>
      ) : day?.isRest ? (
        // Día de descanso normal: solo informa. No hay nada que completar y
        // no afecta a la racha (la racha cuenta días entrenados).
        <FadeIn>
          <Card accent style={styles.optionalCard}>
            <View style={styles.optionalHeader}>
              <Ionicons name="bed" size={18} color={colors.primary} />
              <Text style={styles.optionalTitle}>Día de descanso</Text>
            </View>
            <Text style={styles.optionalText}>
              Hoy toca recuperar: el descanso también es parte del entrenamiento. No tienes que
              marcar nada.
            </Text>
          </Card>
        </FadeIn>
      ) : showCompleted && completedTodayLog ? (
        <TarjetaTerminado
          cifras={{
            ...sessionTotals(completedTodayLog.exercises, measureByExercise),
            durationMin: completedTodayLog.durationMin,
          }}
          titulo={`${completedTodayLog.routineName || routine.name}${
            completedTodayLog.dayName ? ` · ${completedTodayLog.dayName}` : ''
          }`}
          onCompartir={() => handleShareCompleted(completedTodayLog)}
          onVerProgreso={() => router.push('/(client)/progress')}
          onIrAInicio={() => router.push('/(client)/dashboard')}
          onCorregir={corregirEntreno}
          onOtroEntreno={
            isFlex
              ? () => {
                  setCombinedDay(null);
                  setFlexSelection([]);
                  setFlexResting(false);
                  setFlexAgain(true);
                }
              : undefined
          }
        />
      ) : isFlex && (!combinedDay || flexResting) ? null : (
      <>
      {/* El cuánto llevas lo dice el anillo de la cabecera; aquí solo queda el
          salto entre ejercicios, que es navegación y no información. */}
      {enMarcha && totalSets > 0 && log.length > 1 ? (
        <View style={styles.exDotsRow}>
          {log.map((ex, i) => {
            const exDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
            const current = i === safeIndex;
            return (
              <Pressable
                key={i}
                onPress={() => setViewIndex(i)}
                hitSlop={8}
                style={[styles.exDot, exDone && styles.exDotDone, current && styles.exDotCurrent]}
              />
            );
          })}
        </View>
      ) : null}

      {restored ? (
        <View style={styles.restoredBanner}>
          <Ionicons name="refresh-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.restoredText}>Sesión anterior recuperada</Text>
          <Pressable onPress={discardDraft} hitSlop={6}>
            <Text style={styles.restoredAction}>Empezar de cero</Text>
          </Pressable>
        </View>
      ) : null}

      {/* El calentamiento va en la portada: es lo que se hace ANTES. Dentro del
          entreno estorbaba, y es de las cosas que se leen una vez. */}
      {!enMarcha && day && !day.isRest ? (
        <View style={styles.warmupCard}>
          <Pressable onPress={() => setWarmupOpen((o) => !o)} style={styles.warmupHead} hitSlop={6}>
            <Ionicons name="flame-outline" size={15} color={colors.primary} />
            <Text style={styles.warmupTitle}>Calentamiento</Text>
            <Ionicons
              name={warmupOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {warmupOpen ? (
            <View style={styles.warmupList}>
              {[
                'Cardio suave · 5 min',
                'Movilidad con gomas y activación',
                day.approachesNote?.trim()
                  ? `Aproximaciones · ${day.approachesNote.trim()}`
                  : 'Aproximaciones (series progresivas hacia tu peso de trabajo)',
              ].map((item, i) => (
                <View key={i} style={styles.warmupStep}>
                  <View style={styles.warmupNum}>
                    <Text style={styles.warmupNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.warmupText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {enMarcha && day && !day.isRest && day.showIntervalTimer ? (
        <View style={styles.warmupCard}>
          <Pressable
            onPress={() => setIntervalOpen((o) => !o)}
            style={styles.warmupHead}
            hitSlop={6}
          >
            <Ionicons name="timer-outline" size={15} color={colors.primary} />
            <Text style={styles.warmupTitle}>Temporizador de intervalos</Text>
            <Ionicons
              name={intervalOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {intervalOpen ? (
            <View style={{ marginTop: spacing.sm }}>
              <IntervalTimer />
            </View>
          ) : null}
        </View>
      ) : null}


      {/* Y AL FINAL, lo de mirar hacia atrás.

          Por dónde ibas y apuntar un entreno de otro día son cosas que se
          hacen ANTES de entrenar, pero no son lo de hoy: van después del día y
          del calentamiento, justo encima del botón, para que lo primero que se
          lee al abrir sea qué toca. */}
      {!enMarcha && routine ? (
        <UltimoEntreno
          ultimo={ultimoEntreno}
          routine={routine}
          onSeguirPor={handleSetTodayIndex}
          onElegirDia={() => setDayPickerOpen(true)}
        />
      ) : null}

      {!enMarcha ? <RegistrarOtroDia /> : null}

      {/* EMPEZAR ENTRENO, lo último de la portada.

          Antes de él va todo lo que uno quiere mirar sin haber empezado: por
          dónde iba, qué día toca, el calentamiento y apuntar otro día. Al
          pulsarlo, todo eso desaparece y la pantalla pasa a ser el ejercicio y
          nada más: ni tarjetas al lado, ni botones que no sean los de la serie
          que se está haciendo.

          No sale en un día de descanso ni con el entreno ya terminado: ahí no
          hay nada que empezar. Y no vuelve a salir al recuperar un borrador,
          porque quien vuelve a una sesión a medias ya la empezó. */}
      {!enMarcha && day && !day.isRest && !showCompleted && log.length > 0 ? (
        <Button
          title="Empezar entreno"
          onPress={() => setDiaEmpezado(day.id)}
          style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
        />
      ) : null}

      {(() => {
        // Los ejercicios, solo con el entreno en marcha. Es lo que hace que la
        // pantalla de antes de empezar sea corta y diga una sola cosa.
        if (!enMarcha) return null;
        const exerciseIndex = safeIndex;
        const exercise = log[exerciseIndex];
        if (!exercise) return null;
        const prev = lastPerf[exercise.exerciseId];
        const planned = day?.exercises[exerciseIndex];
        const isDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
        // Carga del ejercicio: define si hay casilla extra (peso/goma) o ninguna.
        const load = planned ? resolveLoad(planned) : 'none';
        // Medida real: isométrico (segundos) si CUALQUIER fuente lo indica —la
        // biblioteca actual del coach, la copia de la rutina o el registro—. Así
        // una plancha marcada como segundos nunca se muestra como reps.
        // La medida que manda: la del plan si la trae, si no la del registro y,
        // en último caso, la de la biblioteca del entrenador.
        const medida =
          planned?.measure ?? exercise.measure ?? measureByExercise[exercise.exerciseId];
        const isSeconds = isHoldMeasure(medida);
        // Combo: la serie combina repeticiones Y aguante, así que lleva una
        // casilla extra de segundos junto a la de reps.
        const isCombo = medida === 'combo';
        // Por lados: la segunda casilla es el otro brazo, no otra cosa.
        const isDual = isDualMeasure(medida);
        // Clúster: la serie se hace en bloques con una pausa mínima, así que
        // lleva una casilla por bloque y un botón para ese descanso corto.
        const cluster = planned?.cluster;
        const bloques = cluster ? clusterBlocks(cluster) : 1;
        const categoriaEjercicio = unido(
          planned?.muscleGroup ?? muscleByExercise[exercise.exerciseId],
          planned?.subgroup
        );
        return (
          <FadeIn key={exercise.exerciseId + exerciseIndex}>
          <Card accent style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}>
            {planned?.supersetWithPrevious ? (
              <View style={styles.supersetRow}>
                <Ionicons name="link" size={12} color={colors.primaryBright} />
                <Text style={styles.supersetText}>SUPERSERIE con el anterior — sin descanso</Text>
              </View>
            ) : null}
            <View style={styles.exerciseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exerciseName, styles.exerciseNameCurrent]}>
                  {exercise.name}
                </Text>
                {/* Categoría y subgrupo bajo el nombre: entrenando, dos
                    ejercicios que se llaman parecido solo se distinguen así
                    ("Dominadas · Tirón · Aguantes"). Viene del plan, y si es
                    de antes de que se guardara ahí, de la biblioteca. */}
                {categoriaEjercicio ? (
                  <Text style={styles.exerciseCategory}>{categoriaEjercicio}</Text>
                ) : null}
              </View>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : null}
            </View>
            {planned ? (
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {planned.sets} × {planned.reps}
                    {isSeconds ? 's' : ''}
                  </Text>
                </View>
                {planned.rir !== undefined && planned.rir !== null ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>RIR {planned.rir}</Text>
                  </View>
                ) : null}
                {planned.restSeconds ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Descanso {minutosSegundos(planned.restSeconds, false)}
                    </Text>
                  </View>
                ) : null}
                {load === 'assisted' ? (
                  <View style={[styles.metaChip, styles.metaChipBand]}>
                    <Text style={styles.metaChipText}>Con goma</Text>
                  </View>
                ) : load === 'weighted' ? (
                  <View style={[styles.metaChip, styles.metaChipWeighted]}>
                    <Text style={[styles.metaChipText, styles.metaChipWeightedText]}>
                      Lastrado
                    </Text>
                  </View>
                ) : null}
                {planned?.grip ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Agarre {GRIP_LABEL[planned.grip].toLowerCase()}
                    </Text>
                  </View>
                ) : null}
                {planned?.goal ? (
                  <View style={[styles.metaChip, styles.metaChipBand]}>
                    <Text style={styles.metaChipText}>Objetivo: {planned.goal}</Text>
                  </View>
                ) : null}
                {cluster ? (
                  <View style={[styles.metaChip, styles.metaChipCluster]}>
                    <Text style={styles.metaChipText}>
                      Clúster {bloques} bloques · {cluster.restSeconds}s
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {planned?.notes ? <Text style={styles.coachNotes}>{planned.notes}</Text> : null}
            {videoByExercise[exercise.exerciseId] ? (
              <>
                <Pressable
                  onPress={() =>
                    setVideoAbierto({
                      url: videoByExercise[exercise.exerciseId],
                      titulo: exercise.name,
                    })
                  }
                  style={styles.videoLink}
                  hitSlop={4}
                >
                  <Ionicons name="play-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.videoLinkText}>Ver técnica</Text>
                </Pressable>
              </>
            ) : null}
            {prev ? (
              <View style={styles.prevRow}>
                <Ionicons name="time-outline" size={13} color={colors.primary} />
                <Text style={styles.prevText}>
                  Última vez: {load !== 'none' && prev.weight ? `${prev.weight} kg × ` : ''}
                  {prev.reps ?? '—'} {isSeconds ? 's' : 'reps'}
                </Text>
              </View>
            ) : null}
            <View style={styles.setHead}>
              <Text style={styles.setHeadCap}>
                {cluster
                  ? 'BLOQUE 1'
                  : isDual
                    ? isSeconds
                      ? 'IZQ. S'
                      : 'IZQ.'
                    : isSeconds
                      ? 'SEGUNDOS'
                      : 'REPS'}
              </Text>
              {cluster
                ? Array.from({ length: bloques - 1 }, (_, b) => (
                    <Text key={b} style={styles.setHeadCap}>
                      BLOQUE {b + 2}
                    </Text>
                  ))
                : null}
              {isCombo ? <Text style={styles.setHeadCap}>AGUANTE S</Text> : null}
              {isDual ? (
                <Text style={styles.setHeadCap}>{isSeconds ? 'DER. S' : 'DER.'}</Text>
              ) : null}
              {load === 'weighted' ? (
                <Text style={styles.setHeadCap}>PESO KG</Text>
              ) : load === 'assisted' ? (
                <Text style={styles.setHeadCap}>GOMA KG</Text>
              ) : null}
            </View>
            {exercise.sets.map((set, setIndex) => (
              <View key={setIndex} style={styles.setRow}>
                {/* El nombre de la serie también marca: es hueco muerto al lado
                    del círculo, y con las manos cansadas se falla menos cuanto
                    más grande es lo que hay que tocar. */}
                  <PressableScale
                    haptic
                    onPress={() => updateSet(exerciseIndex, setIndex, 'completed', !set.completed)}
                    style={styles.setToggle}
                    hitSlop={6}
                  >
                    <View style={[styles.checkButton, set.completed && styles.checkButtonDone]}>
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={set.completed ? colors.onPrimary : colors.textFaint}
                      />
                    </View>
                    <Text style={[styles.setLabel, set.completed && styles.setLabelDone]}>
                      Serie {setIndex + 1}
                    </Text>
                  </PressableScale>
                <TextField
                  value={set.reps}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'reps', v)}
                  placeholder={planned?.reps || (isSeconds ? 'seg' : 'reps')}
                  keyboardType="numeric"
                  style={styles.setFieldInput}
                />
                {/* Un bloque más de la misma serie: se apunta lo que salió en
                    cada uno, que es justo lo que un clúster quiere medir. */}
                {cluster
                  ? Array.from({ length: bloques - 1 }, (_, b) => (
                      <TextField
                        key={b}
                        value={set.clusters?.[b] ?? ''}
                        onChangeText={(v) => updateCluster(exerciseIndex, setIndex, b, v)}
                        placeholder={planned?.reps || (isSeconds ? 'seg' : 'reps')}
                        keyboardType="numeric"
                        style={styles.setFieldInput}
                      />
                    ))
                  : null}
                {isCombo ? (
                  <TextField
                    value={set.seconds ?? ''}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'seconds', v)}
                    placeholder={planned?.seconds ? String(planned.seconds) : 'seg'}
                    keyboardType="numeric"
                    style={styles.setFieldInput}
                  />
                ) : isDual ? (
                  <TextField
                    value={set.side2 ?? ''}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'side2', v)}
                    placeholder={planned?.side2 || planned?.reps || (isSeconds ? 'seg' : 'reps')}
                    keyboardType="numeric"
                    style={styles.setFieldInput}
                  />
                ) : null}
                {load !== 'none' ? (
                  <TextField
                    value={set.weight}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'weight', v)}
                    // Precarga visual con el peso de la última vez: cero tecleo
                    // si repites carga (solo escribes si cambias de peso).
                    placeholder={prev?.weight || '—'}
                    keyboardType="decimal-pad"
                    style={styles.setFieldInput}
                  />
                ) : null}
              </View>
            ))}
            {cluster ? (
              <Pressable
                onPress={() => descansoDeBloque(cluster.restSeconds, exercise.name)}
                style={styles.clusterRestBtn}
                hitSlop={6}
              >
                <Ionicons name="timer-outline" size={15} color={colors.primary} />
                <Text style={styles.clusterRestText}>
                  Descanso entre bloques · {cluster.restSeconds}s
                </Text>
              </Pressable>
            ) : null}
            {isFlex || esAtleta ? (
              <View style={styles.setEditRow}>
                <Pressable onPress={() => removeSet(exerciseIndex)} style={styles.setEditBtn} hitSlop={6}>
                  <Ionicons name="remove" size={16} color={colors.textMuted} />
                  <Text style={styles.setEditText}>Quitar serie</Text>
                </Pressable>
                <Pressable onPress={() => addSet(exerciseIndex)} style={styles.setEditBtn} hitSlop={6}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[styles.setEditText, { color: colors.primary }]}>Añadir serie</Text>
                </Pressable>
              </View>
            ) : null}
            {pideRir ? (
              <RirPicker
                value={exercise.rir}
                onChange={(v) => updateExerciseRir(exerciseIndex, v)}
              />
            ) : null}
            {noteOpenIndex === exerciseIndex || exercise.notes ? (
              <TextField
                value={exercise.notes ?? ''}
                onChangeText={(v) => updateExerciseNote(exerciseIndex, v)}
                placeholder="Ej. Hice la variante con goma, molestia en hombro..."
                style={styles.noteField}
              />
            ) : null}
            <Pressable
              onPress={() =>
                setNoteOpenIndex(noteOpenIndex === exerciseIndex ? null : exerciseIndex)
              }
              style={styles.noteBtn}
              hitSlop={6}
            >
              <Ionicons
                name={exercise.notes ? 'create' : 'create-outline'}
                size={13}
                color={colors.textMuted}
              />
              <Text style={styles.noteBtnText}>
                {exercise.notes ? 'Editar nota' : 'Añadir nota'}
              </Text>
            </Pressable>
          </Card>
          </FadeIn>
        );
      })()}

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

      {enMarcha && isLastExercise && doneSets === 0 ? (
        <Text style={styles.saveHint}>
          Marca cada serie con ✓, o pulsa “Terminar” para dar la sesión por hecha
          sin apuntar nada.
        </Text>
      ) : null}

      {enMarcha ? (
      <View style={styles.navRow}>
        <Pressable
          onPress={() => setViewIndex((i) => Math.max(0, i - 1))}
          disabled={safeIndex === 0}
          style={[styles.navBtn, safeIndex === 0 && styles.navBtnDisabled]}
          hitSlop={6}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={safeIndex === 0 ? colors.textFaint : colors.text}
          />
          <Text style={[styles.navBtnText, safeIndex === 0 && styles.navBtnTextDisabled]}>
            Anterior
          </Text>
        </Pressable>

        {isLastExercise ? (
          <Button
            title={
              // Corrigiendo, el botón dice lo que hace: guardar los cambios en
              // la sesión que ya existe. "Terminar sesión" ahí daría a entender
              // que se está registrando otro entreno.
              corrigiendo
                ? 'Guardar corrección'
                : doneSets === 0
                  ? 'Terminar (sin apuntar)'
                  : doneSets < totalSets
                    ? `Terminar (${doneSets}/${totalSets})`
                    : 'Terminar sesión'
            }
            onPress={handleSave}
            loading={saving}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        ) : (
          <Pressable
            onPress={() => setViewIndex((i) => Math.min(log.length - 1, i + 1))}
            style={[styles.navBtn, styles.navNext]}
            hitSlop={6}
          >
            <Text style={[styles.navBtnText, styles.navNextText]}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={22} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>
      ) : null}
      </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  // Hueco al pie para que el crono flotante de descanso no tape la navegación.
  restSpacer: { paddingBottom: 210 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  exitText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  exitBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.scrim,
  },
  exitCard: { paddingVertical: spacing.lg },
  flexPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  flexPickOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  flexCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexCheckOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  flexCheckNum: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.heading, fontSize: 12 },
  flexPickText: { ...typography.body, color: colors.textMuted, flex: 1 },
  flexPickPct: { ...typography.small, color: colors.primary, fontSize: 11, marginTop: 2 },
  flexPickTextOn: { color: colors.text, fontFamily: fonts.semiBold },
  flexHistory: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flexHistoryLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  flexHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 3 },
  flexHistoryDate: { ...typography.small, color: colors.textFaint, width: 74 },
  flexHistoryWhat: { ...typography.small, color: colors.textMuted, flex: 1, textAlign: 'right' },
  filaBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filaBibliotecaTexto: { ...typography.body, color: colors.text, flex: 1 },
  filaBibliotecaGrupo: { ...typography.small, color: colors.textFaint, flexShrink: 0 },
  setEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clusterRestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  clusterRestText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  setEditText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  exitTitle: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
  exitMsg: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  // Tira de puntos: un ejercicio por punto (dorado = hecho, aro = actual).
  exDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  exDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  exDotCurrent: {
    width: 20,
    borderRadius: 4,
    borderColor: colors.primaryBright,
    backgroundColor: colors.primaryMuted,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  navBtnTextDisabled: { color: colors.textFaint },
  navNext: { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary },
  navNextText: { color: colors.onPrimary },
  exerciseCard: { marginBottom: spacing.md },
  exerciseCardDone: { opacity: 0.55 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  exerciseCategory: {
    ...typography.small,
    color: colors.primary,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  exerciseName: { ...typography.h3, color: colors.text, flex: 1 },
  exerciseNameCurrent: { color: colors.primaryBright },
  prevRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  prevText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  supersetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  restoredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  restoredText: { ...typography.small, color: colors.primaryBright, flex: 1 },
  pausaAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pausaAvisoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  pastDraftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pastDraftTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  pastDraftSub: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 1 },
  pastDraftActions: { alignItems: 'flex-end', gap: 4 },
  pastDraftFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pastDraftFillText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold, fontSize: 12 },
  pastDraftLater: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  warmupCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  warmupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  warmupTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  warmupList: { marginTop: spacing.sm, gap: spacing.sm },
  warmupStep: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  warmupNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupNumText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 12 },
  warmupText: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  restoredAction: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  saveHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  coachNotes: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipBand: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  metaChipCluster: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  // Lastre en azul (distinto de la goma dorada), sin emojis.
  metaChipWeighted: { borderColor: 'rgba(91,155,213,0.5)', backgroundColor: 'rgba(91,155,213,0.14)' },
  metaChipWeightedText: { color: '#7FB3E0' },
  metaChipText: { ...typography.small, color: colors.primaryBright, fontSize: 11, fontFamily: fonts.semiBold },
  videoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  videoLinkText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
  setHead: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginBottom: 4,
  },
  setHeadCap: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.8,
    width: 66,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  /*
   * El `flex` va aquí, en el propio pulsable.
   *
   * Antes hacía falta envolverlo en otra vista, porque `PressableScale` ponía
   * el estilo en una capa interna y el flex no llegaba al pulsable. Eso ya no
   * pasa: el pulsable ES la capa animada. La envoltura se ha quitado, y con
   * ella el comentario que la explicaba — que había pasado a decir lo
   * contrario de lo que hace el código.
   */
  setToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  setLabel: { ...typography.small, color: colors.text, flex: 1, fontFamily: fonts.semiBold },
  setLabelDone: { color: colors.textMuted },
  setFieldInput: {
    width: 66,
    marginBottom: 0,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  noteField: { marginTop: spacing.sm, marginBottom: 0 },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  noteBtnText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  checkButtonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // ----- Descanso opcional (Día 7 TENA) -----
  optionalCard: { marginBottom: spacing.md },
  optionalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  optionalTitle: { ...typography.h3, color: colors.primaryBright },
  optionalText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  // ----- Día ya completado hoy -----
  // ----- Resumen -----
});
