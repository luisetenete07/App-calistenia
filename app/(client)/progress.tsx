import { unido } from '../../lib/texto';
import { inicioDeLaSemana, inicioDelDia, mayusculaInicial, mesCorto } from '../../lib/fechas';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/Texto';
import { t, frase } from '../../lib/idioma';
import { esLaPalabra } from '../../lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ExerciseHistory } from '../../components/ExerciseHistory';
import { LineChart } from '../../components/LineChart';
import { CardsSkeleton } from '../../components/Skeleton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { PanelDeNutricion } from '../../components/PanelDeNutricion';
import { MuscleMap } from '../../components/MuscleMap';
import { shareSessionImage } from '../../lib/brandCards';
import { buildClientReportHtml } from '../../lib/report';
import { printReportHtml } from '../../lib/printReport';
import { muscleLoad, weightsOfExercise } from '../../lib/muscles';
import { useAuth } from '../../lib/auth-context';
import { showToast } from '../../components/Toast';
import { ProgressMatrix } from '../../components/ProgressMatrix';
import { BlockOverview } from '../../components/BlockOverview';
import { ObjetivosDeCiclo } from '../../components/ObjetivosDeCiclo';
import { resumenDeConstancia, ventanaDeConstancia } from '../../lib/constancia';
import { buildBlockView } from '../../lib/blockView';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { updateUserProfile } from '../../lib/firestore/users';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getCached, setCached } from '../../lib/screenCache';
import { deleteWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { getExerciseLibrary } from '../../lib/firestore/exercises';
import { isComboExercise, isIsometricExercise, toNum, listExercisesInLogs, monthKeyOf, sessionTotals, setsByMuscleGroup, topExercises, trainingDays, weeklyActivity, weeklySetsForGroups, thenVsNow, workoutsByMonth } from '../../lib/stats';
import { ConsistencyMap } from '../../components/ConsistencyMap';
import { FadeIn } from '../../components/FadeIn';
import { Dialogo } from '../../components/Dialogo';
import { Segmented } from '../../components/Segmented';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { Chip, ChipRow } from '../../components/Chip';
import { fonts, colors, radius, spacing, tabularNums, typography } from '../../lib/theme';
import {
  setMarks,
  type Routine,
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

/*
 * Las tres vistas del progreso.
 *
 * La de en medio era "Peso" y ahora es "Nutrición": el peso no sube ni baja
 * por lo que levantas, sube y baja por lo que comes, así que se fue con las
 * calorías, los macros y los pasos. Aquí se sigue mirando su evolución —que es
 * a lo que se viene a esta pantalla— y se apunta desde el mismo bloque, que es
 * el mismo componente que se usa allí.
 */
type Tab = 'workouts' | 'nutrition' | 'exercises';

/** Pone en mayúscula la primera letra (para "julio 2026" → "Julio 2026"). */

interface ProgressData {
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
}

export default function ProgressScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  // Se puede llegar pidiendo una pestaña concreta: el peso del inicio abre
  // directamente la de Nutrición, que si no habría que buscarla a mano.
  const { tab: tabPedida } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(tabPedida === 'nutricion' ? 'nutrition' : 'workouts');
  useEffect(() => {
    if (tabPedida === 'nutricion') setTab('nutrition');
  }, [tabPedida]);
  const [muscleMode, setMuscleMode] = useState<'session' | 'week'>('week');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  // Meses replegados a mano. Sin entrada = vale el criterio por defecto (solo
  // abierto el mes en curso).
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `progress-${profile?.uid ?? ''}`;
  const cached = getCached<ProgressData>(cacheKey);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.weightLogs ?? []);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(cached?.workoutLogs ?? []);
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [musclesByExercise, setMusclesByExercise] = useState<
    Record<string, import('../../lib/muscles').Weights>
  >({});
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);

  // Borrado de entrenamiento con confirmación por palabra (evita borrados sin querer).
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [generatingReport, setGeneratingReport] = useState(false);
  // El atleta es su propio entrenador: puede elegir qué ejercicios sigue. El
  // alumno de un coach solo mira: su tabla la decide quien le entrena.
  const isAthlete = profile?.role === 'athlete';
  const [planExercises, setPlanExercises] = useState<{ id: string; name: string }[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [cycles, setCycles] = useState<import('../../lib/types').TrainingCycle[]>([]);
  const [fullOpen, setFullOpen] = useState(false);
  // Lo que la tabla está enseñando ahora mismo, para que el PDF salga igual.
  const [matrixView, setMatrixView] = useState<{ weeks: number; exerciseIds: string[] }>({
    weeks: 8,
    exerciseIds: [],
  });


  /**
   * Categoría de cada ejercicio. Manda la biblioteca del entrenador, y el plan
   * rellena los huecos: el atleta escribe los nombres de sus ejercicios a mano,
   * así que la única categoría que existe para ellos es la que él eligió al
   * montar el plan. Sin esta mezcla, sus gráficas por grupo salían vacías.
   */
  const gruposDeEjercicio = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const day of activeRoutine?.days ?? []) {
      for (const ex of day.exercises) {
        if (ex.muscleGroup) mapa[ex.exerciseId] = ex.muscleGroup;
      }
    }
    return { ...mapa, ...muscleByExercise };
  }, [activeRoutine, muscleByExercise]);

  /*
   * Igual que en el panel de nutrición: esto dependía del objeto `profile`
   * entero, que es nuevo cada vez que se relee la cuenta. Como `load` va dentro
   * de `useFocusEffect`, guardar cualquier cosa que releyera el perfil recargaba
   * también toda esta pantalla —entrenos, plan, ciclos y biblioteca— por debajo.
   * De quién se carga es lo único que hace falta.
   */
  const uid = profile?.uid;
  const trainerId = profile?.trainerId;

  const load = useCallback(async () => {
    if (!uid) return;
    const [weightData, workoutData] = await Promise.all([
      getWeightLogsForClient(uid),
      getWorkoutLogsForClient(uid),
    ]);
    setWeightLogs(weightData);
    setWorkoutLogs(workoutData);
    // Ejercicios del plan activo: solo se usan si esta cuenta puede elegir qué
    // sigue en su tabla (el atleta), pero se cargan siempre porque el plan ya
    // se consulta aquí y no cuesta nada.
    getActiveRoutineForClient(uid, trainerId ?? uid)
      .then((rutina) => {
        setActiveRoutine(rutina ?? null);
        const vistos = new Map<string, string>();
        for (const day of rutina?.days ?? []) {
          for (const ex of day.exercises) {
            if (!vistos.has(ex.exerciseId)) vistos.set(ex.exerciseId, ex.name);
          }
        }
        setPlanExercises([...vistos.entries()].map(([exId, name]) => ({ id: exId, name })));
      })
      .catch(() => {});
    // Ciclos: si el entrenador planifica por bloques, el reparto se mide sobre
    // el bloque en curso y no sobre las últimas cuatro semanas sueltas.
    getCyclesForClientSelf(uid)
      .then(setCycles)
      .catch(() => {});
    setCached(cacheKey, {
      weightLogs: weightData,
      workoutLogs: workoutData,
    } satisfies ProgressData);
    // Medida actual de cada ejercicio (reps/segundos) desde la biblioteca del
    // coach, para mostrar bien los isométricos aunque el registro sea antiguo.
    // El atleta es su propio entrenador, así que su biblioteca es la suya: sin
    // este respaldo se quedaba sin mapa muscular ni marcas en el informe.
    getExerciseLibrary(trainerId ?? uid)
      .then((library) => {
        const mmap: Record<string, string> = {};
        const gmap: Record<string, string> = {};
        const musMap: Record<string, import('../../lib/muscles').Weights> = {};
        for (const ex of library) {
          mmap[ex.id] = ex.measure ?? 'reps';
          gmap[ex.id] = ex.muscleGroup;
          const w = weightsOfExercise(ex);
          if (w) musMap[ex.id] = w;
        }
        setMeasureByExercise(mmap);
        setMuscleByExercise(gmap);
        setMusclesByExercise(musMap);
      })
      .catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }, [uid, trainerId, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Exportar a PDF es OPCIONAL: la tabla se consulta dentro de la app. El
  // informe sale con lo que se está viendo: mismas semanas, mismos ejercicios.
  const handleExportPdf = async () => {
    if (!profile || workoutLogs.length === 0) return;
    setGeneratingReport(true);
    try {
      await printReportHtml(
        buildClientReportHtml({
          client: profile,
          routine: activeRoutine,
          weightLogs,
          workoutLogs,
          muscleByExercise: gruposDeEjercicio,
          measureByExercise,
          exerciseIds: matrixView.exerciseIds,
          weeks: matrixView.weeks,
        }),
        `informe-${profile.name}`
      );
    } catch {
      showToast('No se pudo exportar el PDF');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Comparte una sesión concreta del registro mensual como imagen de marca
  // UDECA; si no se puede generar, cae a texto compartible.
  const handleShareSession = async (log: WorkoutLog) => {
    const t = sessionTotals(log.exercises, measureByExercise);
    try {
      const result = await shareSessionImage({
        routineName: log.routineName ?? 'UDECA',
        dayName: log.dayName,
        durationMin: log.durationMin ?? 0,
        sets: t.sets,
        reps: t.reps,
        seconds: t.seconds,
        volumeKg: t.volumeKg,
        streak: 0,
        prCount: 0,
        date: log.date,
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${log.dayName ?? log.routineName ?? ''}`.trim(),
      log.durationMin ? `${log.durationMin} min` : null,
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

  // Abre el diálogo que pide escribir CONFIRMAR para borrar el entrenamiento.
  const requestDeleteWorkout = (id: string) => {
    setConfirmWord('');
    setDeleteId(id);
  };

  const doDeleteWorkout = async () => {
    if (!deleteId || !esLaPalabra(confirmWord, 'CONFIRMAR')) return;
    const id = deleteId;
    setDeleting(true);
    try {
      setWorkoutLogs((prev) => prev.filter((l) => l.id !== id));
      await deleteWorkoutLog(id);
      showToast('Entrenamiento borrado');
      setDeleteId(null);
    } catch (e) {
      await load(); // si falla, recargamos para no perder el registro de la vista
      showToast(e instanceof Error ? e.message : 'No se pudo borrar');
    } finally {
      setDeleting(false);
    }
  };

  // Agregaciones pesadas del historial. Van memorizadas y ANTES del retorno
  // de carga (el orden de hooks debe ser constante): esta pantalla tiene
  // campos de texto, así que sin esto cada tecla recorrería otra vez todos los
  // entrenamientos.
  const months = useMemo(
    () => workoutsByMonth(workoutLogs, measureByExercise),
    [workoutLogs, measureByExercise]
  );
  const comparison = useMemo(() => thenVsNow(workoutLogs, weightLogs), [workoutLogs, weightLogs]);

  // Mapa corporal: intensidad por músculo según lo trabajado en la última
  // sesión o en la semana. `muscleByExercise` (grupo del ejercicio) refina la
  // clasificación por nombre.
  const muscleIntensity = useMemo(() => {
    if (muscleMode === 'session') {
      const lastSessionDay = workoutLogs.length > 0 ? inicioDelDia(workoutLogs[0].date) : 0;
      const sessionLogs = workoutLogs.filter((l) => inicioDelDia(l.date) === lastSessionDay);
      return muscleLoad(sessionLogs, undefined, gruposDeEjercicio, musclesByExercise);
    }
    // Semana NATURAL (lunes 00:00 → domingo 23:59), no los últimos 7 días: al
    // pasar el domingo el mapa arranca limpio.
    return muscleLoad(workoutLogs, inicioDeLaSemana(Date.now()), gruposDeEjercicio, musclesByExercise);
  }, [workoutLogs, muscleMode, gruposDeEjercicio, musclesByExercise]);

  const muscleMap = useMemo(
    () => setsByMuscleGroup(workoutLogs, gruposDeEjercicio),
    [workoutLogs, gruposDeEjercicio]
  );
  /**
   * Categorías de las gráficas de series semanales: las que haya elegido el
   * alumno y, si no ha elegido, las DOS que más trabaja. Antes eran siempre
   * Empuje y Tirón, aunque entrenase otra cosa.
   */
  const gruposDisponibles = useMemo(
    () => muscleMap.filter((m) => m.group !== 'Otros').map((m) => m.group),
    [muscleMap]
  );
  const gruposMostrados = useMemo(() => {
    const elegidos = (profile?.progressGroups ?? []).filter((g) => g);
    if (elegidos.length > 0) return elegidos;
    return gruposDisponibles.slice(0, 2);
  }, [profile?.progressGroups, gruposDisponibles]);
  const weeklySets = useMemo(
    () => weeklySetsForGroups(workoutLogs, gruposDeEjercicio, gruposMostrados),
    [workoutLogs, gruposDeEjercicio, gruposMostrados]
  );

  // Añade o quita una categoría de las que se grafican (mínimo una).
  const alternarGrupo = async (grupo: string) => {
    if (!profile) return;
    const actuales = gruposMostrados;
    const next = actuales.includes(grupo)
      ? actuales.filter((g) => g !== grupo)
      : [...actuales, grupo];
    if (next.length === 0) return;
    try {
      await updateUserProfile(profile.uid, { progressGroups: next });
      await refreshProfile();
    } catch {
      showToast('No se pudo guardar tu selección');
    }
  };
  const exercisesInLogs = useMemo(() => listExercisesInLogs(workoutLogs), [workoutLogs]);
  const selExerciseId = selectedExerciseId ?? exercisesInLogs[0]?.exerciseId ?? null;

  // El bloque en curso, si el entrenador planifica. Se prefiere el mesociclo
  // al macro: el macro son meses, y su reparto no dice nada que se pueda
  // corregir esta semana.
  const bloqueActual = useMemo(() => {
    const ahora = Date.now();
    const enCurso = cycles.filter(
      (c) => (c.startDate ?? 0) <= ahora && (c.endDate ?? Number.MAX_SAFE_INTEGER) >= ahora
    );
    return enCurso.find((c) => c.level === 'meso') ?? enCurso.find((c) => c.level === 'macro') ?? null;
  }, [cycles]);

  // El periodo del que hablan las DOS mitades de la tarjeta: el bloque en
  // curso, o las últimas cuatro semanas si no hay (ver lib/constancia.ts).
  const ventana = useMemo(() => ventanaDeConstancia(bloqueActual), [bloqueActual]);
  const diasEntrenados = useMemo(() => trainingDays(workoutLogs), [workoutLogs]);
  const constancia = useMemo(
    () => resumenDeConstancia(diasEntrenados, ventana),
    [diasEntrenados, ventana]
  );

  if (loading) {
    return (
      <ScreenContainer>
        <CardsSkeleton tarjetas={3} />
      </ScreenContainer>
    );
  }

  const toggleSession = (id: string) =>
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));

  /**
   * Meses cerrados salvo el que está en curso.
   *
   * Con medio año de historial, la pestaña era un rollo interminable de
   * entrenamientos por el que había que hacer scroll para llegar a cualquier
   * otra cosa. Cada mes cerrado sigue enseñando su resumen —sesiones, series,
   * reps—, que es lo que se mira de un mes terminado; el detalle está a un
   * toque para quien lo quiera.
   */
  // Se guarda si queda RECOGIDO, así que el nuevo valor es "estaba abierto".
  const toggleMonth = (key: string) =>
    setCollapsedMonths((prev) => ({ ...prev, [key]: isMonthOpen(key) }));
  const isMonthOpen = (key: string) => {
    const guardado = collapsedMonths[key];
    return guardado === undefined ? key === monthKeyOf() : !guardado;
  };

  const muscleHasData = Object.values(muscleIntensity).some((v) => v > 0);
  const muscleMax = muscleMap.length > 0 ? muscleMap[0].sets : 0;

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.title}>Mi progreso</Text>

      {/* Tres vistas de lo mismo: esto es exactamente lo que hace Segmented en
          el resto de la app, con su pastilla deslizándose de una a otra. Antes
          eran tres botones a mano que se encendían y apagaban. */}
      <Segmented
        opciones={[
          { valor: 'workouts' as const, texto: 'Entrenos', icono: 'barbell-outline' },
          { valor: 'nutrition' as const, texto: 'Nutrición', icono: 'nutrition-outline' },
          { valor: 'exercises' as const, texto: 'Ejercicios', icono: 'trending-up-outline' },
        ]}
        valor={tab}
        onChange={setTab}
      />

      {tab === 'workouts' ? (
        months.length === 0 ? (
          <Card style={styles.section}>
            <EmptyState
              icon="barbell-outline"
              title="Aún no hay entrenamientos"
              subtitle="Cuando termines una sesión se guardará aquí, en tu registro mensual."
            />
          </Card>
        ) : (
          <>
            {/* LO QUE SE PERSIGUE, lo primero.
                Es lo único de esta pantalla que mira hacia delante: el resto
                cuenta lo que ya pasó. Y aquí es donde se viene a ver si uno se
                está acercando, así que va antes que nada.

                Solo de lectura: los pone el entrenador (o el atleta en su
                propio plan). Un objetivo que el alumno puede cambiarse a sí
                mismo cuando se le hace cuesta arriba deja de ser un objetivo. */}
            {bloqueActual?.objetivos?.length ? (
              <Card style={styles.section}>
                <ObjetivosDeCiclo objetivos={bloqueActual.objetivos} logs={workoutLogs} paraMi />
              </Card>
            ) : null}

            {/* El reparto del bloque se fue a "Tu progreso completo".
                Aquí quedaba una tabla de números encima de todo lo demás, y lo
                primero que se viene a mirar es si se ha entrenado, no cuántas
                series de tirón llevas en la semana 3. Dentro está al lado de la
                tabla de marcas, que es con lo que de verdad se compara. */}
            <Card style={styles.section}>
              <View style={styles.constancia}>
                <View style={styles.constanciaFila}>
                  <Text style={styles.constanciaTitulo}>Días que has entrenado</Text>
                  <Text style={styles.constanciaCifra}>
                    {Math.round(constancia.ratio * 100)} %
                  </Text>
                </View>
                <Text style={styles.photoHint}>{constancia.texto}</Text>
                <ConsistencyMap
                  days={diasEntrenados}
                  weeks={ventana.semanas}
                  desde={ventana.desde}
                />
              </View>
            </Card>

            {/* Una tarjeta entera con un botón grande partía en dos lo que se
                lee de corrido: el reparto del bloque, la constancia y el mes a
                mes. Como fila cabe en su sitio sin cortar nada. */}
            <Pressable style={styles.navRow} onPress={() => setFullOpen(true)}>
              <Ionicons name="grid-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navTitle}>Tu progreso completo</Text>
                <Text style={styles.navHint}>
                  {isAthlete
                    ? 'La mejor serie de cada ejercicio, semana a semana.'
                    : 'La misma tabla que ve tu entrenador.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>

            {comparison ? (
              <CollapsibleCard
                id="progreso-comparativa"
                icon="git-compare-outline"
                title="Hace 3 meses → hoy"
                hint={`${comparison.now.sessions} vs ${comparison.then.sessions} sesiones`}
                defaultOpen={false}
              >
                <Text style={styles.photoHint}>
                  Tus últimos 28 días frente a los mismos días de hace 3 meses.
                </Text>
                <CompareRow
                  label="Sesiones"
                  then={comparison.then.sessions}
                  now={comparison.now.sessions}
                />
                <CompareRow
                  label="Series"
                  then={comparison.then.sets}
                  now={comparison.now.sets}
                />
                {comparison.then.volumeKg > 0 || comparison.now.volumeKg > 0 ? (
                  <CompareRow
                    label="Volumen (kg)"
                    then={comparison.then.volumeKg}
                    now={comparison.now.volumeKg}
                  />
                ) : null}
                {comparison.then.weightKg != null && comparison.now.weightKg != null ? (
                  <CompareRow
                    label="Peso corporal"
                    then={comparison.then.weightKg}
                    now={comparison.now.weightKg}
                    neutral
                  />
                ) : null}
              </CollapsibleCard>
            ) : null}

            {months.map((m, mi) => (
              <FadeIn key={m.key} delay={Math.min(mi * 60, 240)}>
              <Card style={styles.section}>
                <Pressable style={styles.monthHeader} onPress={() => toggleMonth(m.key)}>
                  <Text style={styles.monthTitle}>{mayusculaInicial(m.label)}</Text>
                  <Text style={styles.monthCount}>
                    {m.sessions.length} {m.sessions.length === 1 ? 'sesión' : 'sesiones'}
                  </Text>
                  <Ionicons
                    name={isMonthOpen(m.key) ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textFaint}
                  />
                </Pressable>
                <View style={styles.monthStats}>
                  <MonthStat value={String(m.totalSets)} label="series" />
                  {m.totalReps > 0 ? <MonthStat value={String(m.totalReps)} label="reps" /> : null}
                  {m.totalSeconds > 0 ? (
                    <MonthStat value={`${m.totalSeconds}s`} label="isom." />
                  ) : null}
                  {m.volumeKg > 0 ? (
                    <MonthStat value={m.volumeKg.toLocaleString('es-ES')} label="kg vol." />
                  ) : null}
                </View>

                {!isMonthOpen(m.key) ? (
                  <Pressable onPress={() => toggleMonth(m.key)} style={styles.monthExpand}>
                    <Ionicons name="list-outline" size={14} color={colors.primary} />
                    <Text style={styles.monthExpandText}>
                      Ver los {m.sessions.length} entrenamientos
                    </Text>
                  </Pressable>
                ) : null}

                {isMonthOpen(m.key) && m.sessions.map((s) => {
                  const t = sessionTotals(s.exercises, measureByExercise);
                  const open = expandedSessions[s.id];
                  const d = new Date(s.date);
                  const meta = unido(
                    frase`${t.sets} series`,
                    t.reps > 0 && `${t.reps} reps`,
                    t.seconds > 0 && `${t.seconds}s`,
                    t.volumeKg > 0 && `${t.volumeKg.toLocaleString('es-ES')} kg`
                  );
                  return (
                    <View key={s.id}>
                      <View style={styles.sessionRow}>
                        <Pressable style={styles.sessionMain} onPress={() => toggleSession(s.id)}>
                          <View style={styles.sessionDateBox}>
                            <Text style={styles.sessionDay}>{d.getDate()}</Text>
                            <Text style={styles.sessionMon}>
                              {mesCorto(d)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sessionName} numberOfLines={1}>
                              {s.dayName}
                            </Text>
                            <Text style={styles.sessionMeta}>{meta}</Text>
                          </View>
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textFaint}
                          />
                        </Pressable>
                        {t.sets > 0 || t.seconds > 0 ? (
                          <Pressable
                            onPress={() => handleShareSession(s)}
                            hitSlop={8}
                            style={styles.sessionShare}
                          >
                            <Ionicons name="share-outline" size={16} color={colors.primary} />
                          </Pressable>
                        ) : null}
                      </View>
                      {open ? (
                        <View style={styles.sessionDetail}>
                          {s.exercises.map((ex, i) => {
                            const isSec = isIsometricExercise(ex, measureByExercise);
                            const isCombo = isComboExercise(ex, measureByExercise);
                            // Cada serie va en su propia marca en vez de en una
                            // lista separada por comas: "12, 10, 8" obliga a
                            // leer, y tres marcas seguidas se ven de un golpe.
                            const marcas = ex.sets
                              .filter((st) => st.completed && st.reps)
                              .map((st) => {
                                // Un lastre de 0 kg no es lastre: escribirlo
                                // ("7 × 0 kg") es ruido en cada serie de peso
                                // corporal, que son casi todas.
                                const kg = toNum(st.weight);
                                return {
                                  // En clúster, la serie fueron varios bloques:
                                  // se enseñan todos ("3+3+3"), que es lo que de
                                  // verdad se hizo.
                                  texto:
                                    `${setMarks(st).join('+')}${isSec ? ' s' : ''}` +
                                    `${isCombo && st.seconds ? ` + ${st.seconds}s` : ''}` +
                                    `${kg > 0 ? ` × ${kg} kg` : ''}`,
                                  cluster: (st.clusters?.length ?? 0) > 0,
                                };
                              });
                            return (
                              <View key={i} style={styles.detailBlock}>
                                <Text style={styles.detailName} numberOfLines={1}>
                                  {ex.name}
                                </Text>
                                {marcas.length > 0 ? (
                                  <View style={styles.detailMarks}>
                                    {marcas.map((m, j) => (
                                      <View key={j} style={styles.detailMark}>
                                        {m.cluster ? (
                                          <Ionicons
                                            name="layers-outline"
                                            size={11}
                                            color={colors.textMuted}
                                          />
                                        ) : null}
                                        <Text style={styles.detailMarkText}>{m.texto}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : (
                                  <Text style={styles.detailDone}>Completado</Text>
                                )}
                              </View>
                            );
                          })}

                          {/* Borrar vive DENTRO de la sesión abierta, no en la
                              fila. Una papelera en cada línea de una lista es
                              un accidente esperando su turno: así solo se
                              puede borrar lo que se está mirando. */}
                          <Pressable
                            onPress={() => requestDeleteWorkout(s.id)}
                            hitSlop={8}
                            style={styles.borrarSesion}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.textFaint} />
                            <Text style={styles.borrarSesionTexto}>
                              Eliminar este entrenamiento
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
              </FadeIn>
            ))}

            <CollapsibleCard
              id="progreso-series"
              icon="stats-chart-outline"
              title="Series semanales"
              defaultOpen={false}
            >
              <Text style={styles.photoHint}>
                Series completadas cada semana en lo que más entrenas. Toca una categoría
                para seguirla o dejar de seguirla.
              </Text>
              {gruposDisponibles.length > 0 ? (
                <ChipRow>
                  {gruposDisponibles.map((g) => (
                    <Chip
                      key={g}
                      texto={g}
                      activo={gruposMostrados.includes(g)}
                      onPress={() => alternarGrupo(g)}
                    />
                  ))}
                </ChipRow>
              ) : null}
              {gruposMostrados.length === 0 ? (
                <Text style={styles.photoHint}>
                  Registra entrenamientos para ver aquí tus series por categoría.
                </Text>
              ) : (
                gruposMostrados.map((g, i) => (
                  <View key={g}>
                    <Text style={[styles.sectionTitle, i > 0 && { marginTop: spacing.lg }]}>
                      {g}
                    </Text>
                    <LineChart
                      points={weeklySets.map((w) => ({
                        date: w.weekStart,
                        value: w.byGroup[g] ?? 0,
                      }))}
                      unit="series"
                      lowerIsBetter={false}
                      emptyMessage={frase`Aún no hay series de ${g} registradas.`}
                    />
                  </View>
                ))
              )}
            </CollapsibleCard>

            {muscleMap.length > 0 ? (
              <CollapsibleCard
                id="progreso-mapa"
                icon="body-outline"
                title="Mapa muscular"
                hint={`${muscleMap.length} patrones`}
                defaultOpen={false}
              >
                <Text style={styles.photoHint}>
                  Series completadas por patrón de movimiento, en los últimos 28 días.
                </Text>
                {muscleMap.map((m) => (
                  <View key={m.group} style={styles.muscleRow}>
                    <Text style={styles.muscleLabel} numberOfLines={1}>
                      {m.group}
                    </Text>
                    <View style={styles.muscleTrack}>
                      <View
                        style={[
                          styles.muscleFill,
                          { width: `${Math.max(6, (m.sets / muscleMax) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.muscleValue}>{m.sets}</Text>
                  </View>
                ))}
              </CollapsibleCard>
            ) : null}

            <CollapsibleCard
              id="progreso-top"
              icon="podium-outline"
              title="Más entrenados"
              hint={topExercises(workoutLogs)[0]?.name}
              defaultOpen={false}
            >
              {topExercises(workoutLogs).map((ex, i) => (
                <View key={ex.name} style={styles.logRow}>
                  <Text style={styles.logValue}>
                    {i + 1}. {ex.name}
                  </Text>
                  <Text style={styles.logDate}>{ex.count} sesiones</Text>
                </View>
              ))}
            </CollapsibleCard>
          </>
        )
      ) : null}

      {/* La nutrición ENTERA: el peso, los pasos, los macros, las comidas, las
          libretas del coach y las fotos. Era una pestaña propia de la app y
          ahora vive aquí, porque es aquí donde se lee junto a los entrenos:
          lo que come y lo que pesa alguien explica la mitad de lo que le pasa
          entrenando. */}
      {tab === 'nutrition' ? (
        <PanelDeNutricion />
      ) : tab === 'exercises' ? (
        <>
          <Card style={styles.section}>
            <View style={styles.muscleHeader}>
              <Text style={styles.sectionTitle}>Músculos trabajados</Text>
              <View style={styles.muscleToggle}>
                <Pressable
                  onPress={() => setMuscleMode('session')}
                  style={[styles.muscleTab, muscleMode === 'session' && styles.muscleTabOn]}
                >
                  <Text
                    style={[
                      styles.muscleTabText,
                      muscleMode === 'session' && styles.muscleTabTextOn,
                    ]}
                  >
                    Última sesión
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMuscleMode('week')}
                  style={[styles.muscleTab, muscleMode === 'week' && styles.muscleTabOn]}
                >
                  <Text
                    style={[
                      styles.muscleTabText,
                      muscleMode === 'week' && styles.muscleTabTextOn,
                    ]}
                  >
                    Semana
                  </Text>
                </Pressable>
              </View>
            </View>
            <MuscleMap intensity={muscleIntensity} hasData={muscleHasData} />
          </Card>
          {exercisesInLogs.length === 0 ? (
            <Card style={styles.section}>
              <EmptyState
                icon="stats-chart-outline"
                title="Aún no hay datos por ejercicio"
                subtitle="Cuando completes entrenamientos verás aquí cómo mejoras en cada ejercicio."
              />
            </Card>
          ) : (
          <>
            <ChipRow scroll>
              {exercisesInLogs.map((ex) => (
                <Chip
                  key={ex.exerciseId}
                  texto={ex.name}
                  activo={selExerciseId === ex.exerciseId}
                  onPress={() => setSelectedExerciseId(ex.exerciseId)}
                />
              ))}
            </ChipRow>

            {selExerciseId ? (
              <ExerciseHistory
                logs={workoutLogs}
                exerciseId={selExerciseId}
                measureByExercise={measureByExercise}
              />
            ) : null}
          </>
          )}
        </>
      ) : null}

      {/* Borrar entrenamiento: hay que escribir CONFIRMAR (evita borrados por error) */}
      <Dialogo
        visible={!!deleteId}
        onClose={() => setDeleteId(null)}
        icono="trash-outline"
        titulo="Borrar entrenamiento"
        texto={
          <Text style={styles.confirmText}>
            Esta acción no se puede deshacer. Para confirmar, escribe{' '}
            <Text style={styles.confirmWordHint}>CONFIRMAR</Text> abajo.
          </Text>
        }
        accion="Borrar entrenamiento"
        onAccion={doDeleteWorkout}
        cargando={deleting}
        desactivado={!esLaPalabra(confirmWord, 'CONFIRMAR')}
      >
        <TextInput
          value={confirmWord}
          onChangeText={setConfirmWord}
          placeholder={t('CONFIRMAR')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.confirmInput}
        />
      </Dialogo>

      {/* Progreso completo: la tabla se CONSULTA aquí dentro. El PDF queda
          como exportación opcional, no como única forma de verlo. */}
      <Modal
        visible={fullOpen}
        animationType="slide"
        onRequestClose={() => setFullOpen(false)}
      >
        <View style={styles.fullSheet}>
          <View style={styles.fullHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullTitle}>Progreso completo</Text>
              <Text style={styles.fullSubtitle}>{profile?.name}</Text>
            </View>
            <Pressable onPress={() => setFullOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.fullBody}>
            {profile ? (
              <ProgressMatrix
                logs={workoutLogs}
                clientId={profile.uid}
                // El atleta es su propio entrenador y manda sobre su tabla. El
                // alumno de un coach no: la suya la decide quien le entrena, y
                // las reglas de Firestore lo imponen igualmente.
                ownerId={isAthlete ? profile.uid : undefined}
                editable={isAthlete}
                planExercises={planExercises}
                onViewChange={setMatrixView}
              />
            ) : null}

            {/* El reparto del bloque, DEBAJO de la tabla de marcas.
                Aquí es donde tiene sentido: arriba se ve qué se ha levantado
                en cada ejercicio, y justo debajo, en qué se ha repartido el
                trabajo esas mismas semanas. Separados —uno en cada pantalla—
                eran dos tablas que nadie cruzaba. */}
            <View style={styles.bloqueEnCompleto}>
              <BlockOverview
                view={buildBlockView({
                  cycle: bloqueActual,
                  cycles,
                  logs: workoutLogs,
                  routine: activeRoutine,
                  muscleByExercise,
                  measureByExercise,
                })}
                title={ventana.titulo}
                subtitle={ventana.hayBloque ? 'Tu bloque en curso' : 'Cómo se te reparte el trabajo'}
              />
            </View>

            <Button
              title="Exportar a PDF"
              variant="secondary"
              onPress={handleExportPdf}
              loading={generatingReport}
              style={{ marginTop: spacing.xl }}
            />
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

/** Fila del comparador 3 meses → hoy, con delta coloreado. */
function CompareRow({
  label,
  then,
  now,
  neutral,
}: {
  label: string;
  then: number;
  now: number;
  neutral?: boolean;
}) {
  const delta = now - then;
  const flat = Math.abs(delta) < 0.05;
  const color = neutral || flat ? colors.textMuted : delta > 0 ? colors.success : colors.danger;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareThen}>{fmt(then)}</Text>
      <Ionicons name="arrow-forward" size={13} color={colors.textFaint} />
      <Text style={styles.compareNow}>{fmt(now)}</Text>
      <Text style={[styles.compareDelta, { color }]}>
        {flat ? '=' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}
      </Text>
    </View>
  );
}

function MonthStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.monthStat}>
      <Text style={styles.monthStatValue}>{value}</Text>
      <Text style={styles.monthStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  navTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  navHint: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  fullSheet: { flex: 1, backgroundColor: colors.background },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 1.6,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fullTitle: { ...typography.h2, color: colors.text },
  fullSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  fullBody: { padding: spacing.lg, paddingBottom: spacing.xl * 2, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  // Separado de la tabla de marcas con una raya: son dos cosas distintas que
  // se leen seguidas, y pegadas parecerían la misma tabla con más filas.
  bloqueEnCompleto: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  /*
   * Sin separación arriba: ahora es lo PRIMERO de su tarjeta.
   *
   * El margen y la raya estaban para despegarla del reparto del bloque, que
   * vivía encima. Al mudarse ese, quedaba un hueco vacío con una raya en medio
   * de la nada, que es de esas cosas que parecen un fallo de carga.
   */
  constancia: {},
  constanciaFila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  constanciaTitulo: { ...typography.h3, color: colors.text },
  constanciaCifra: { ...typography.h3, color: colors.primaryBright, ...tabularNums },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logValue: { ...typography.body, color: colors.text, fontFamily: fonts.heading, flex: 1, marginRight: spacing.sm },
  logDate: { ...typography.small, color: colors.textMuted },
  // ----- Mapa muscular -----
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  muscleToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleTab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm - 2 },
  muscleTabOn: { backgroundColor: colors.primary },
  muscleTabText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  muscleTabTextOn: { color: colors.onPrimary },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  muscleLabel: { ...typography.small, color: colors.text, width: 104, fontFamily: fonts.medium },
  muscleTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  muscleFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  muscleValue: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    width: 30,
    textAlign: 'right',
  },
  // ----- Comparador 3 meses → hoy -----
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compareLabel: { ...typography.small, color: colors.textMuted, flex: 1 },
  compareThen: { ...typography.body, color: colors.textFaint, fontFamily: fonts.medium },
  compareNow: { ...typography.body, color: colors.text, fontFamily: fonts.heading },
  compareDelta: { ...typography.small, fontFamily: fonts.semiBold, width: 52, textAlign: 'right' },
  // ----- Registro de entrenamiento mensual -----
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  monthTitle: { ...typography.h3, color: colors.text, flex: 1 },
  monthExpand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  monthExpandText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  monthCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  monthStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  monthStat: {
    flex: 1,
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthStatValue: { ...typography.h3, color: colors.primaryBright, fontSize: 18 },
  monthStatLabel: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.medium, marginTop: 2 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sessionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sessionShare: { padding: spacing.xs },
  borrarSesion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  borrarSesionTexto: { ...typography.small, color: colors.textFaint },
  confirmText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  confirmWordHint: { color: colors.danger, fontFamily: fonts.heading },
  confirmInput: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    minHeight: 48,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  sessionDateBox: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sessionDay: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.heading, fontSize: 16 },
  sessionMon: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' },
  sessionName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  sessionMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sessionDetail: {
    paddingLeft: 52,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  detailBlock: { gap: 5 },
  detailName: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  detailMarks: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  detailMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailMarkText: { ...typography.small, color: colors.text, fontSize: 12 },
  detailDone: { ...typography.small, color: colors.textFaint },
  photoHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
