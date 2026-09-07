import React, { useCallback, useEffect, useState } from 'react';
import { t, frase  } from '../../lib/idioma';
import { diaLargo, diaMes, diaYMes, esHoy, inicioDelDia } from '../../lib/fechas';
import { unido } from '../../lib/texto';
import { useFocusEffect, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/Avatar';
import { UpgradePopup } from '../../components/UpgradeCard';
import { Card } from '../../components/Card';
import { DashboardSkeleton } from '../../components/Skeleton';
import { ProgressBar } from '../../components/ProgressBar';
import { CountUp } from '../../components/CountUp';
import { FadeIn } from '../../components/FadeIn';
import { ProgressRing } from '../../components/ProgressRing';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { WeekStrip } from '../../components/WeekStrip';
import { RutinaDiariaDelDia } from '../../components/RutinaDiariaDelDia';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import {
  getHabitLogsForClient,
  getHabitsForClient,
  logHabitToday,
  todayStart,
  unlogHabit,
} from '../../lib/firestore/habits';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { hayObjetivos, objetivosDe, objetivosVisibles } from '../../lib/objetivos';
import { flushPendingWorkouts } from '../../lib/offlineQueue';
import { getCached, setCached } from '../../lib/screenCache';
import { currentStreak, sessionsThisWeek as weekSessions, trainingDays } from '../../lib/stats';
import { flexLabel, resolveTodaySession } from '../../lib/schedule';
import { entrenoDeHoy, esGtg, progresoGtg, textoDelDia } from '../../lib/gtg';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { getUserProfile, reportClientPayment } from '../../lib/firestore/users';
import { enlaceDePagoDe, urlDePago } from '../../lib/enlaceDePago';
import { kgCorto } from '../../lib/peso';
import { clientDaysUntilLock } from '../../lib/subscription';
import { notifyUser } from '../../lib/notifications';
import { showToast } from '../../components/Toast';
import { activeCycle, computeCycleStats, cycleWeekInfo } from '../../lib/cycleStats';
import { nombreDeCiclo, planCalendar, planSummary } from '../../lib/cyclePlan';
import { anclaDelAlumno } from '../../lib/cycleAnchor';
import type { AnclaDelAlumno } from '../../lib/ciclo';
import { diasDePausa, diasQueQuedan, pausaActiva } from '../../lib/pausa';
import { cancelarAvisosOlvido, programarAvisosOlvido } from '../../lib/notifications';
import { fonts, colors, gradients, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  todayWeekday,
  WEEKDAY_NAMES,
  type Habit,
  type HabitLog,
  type Routine,
  type TrainingCycle,
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

const WEIGHT_REMINDER_DAYS = 7;

interface ClientDashData {
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  cycleAnchor: AnclaDelAlumno | null;
}

export default function ClientDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `client-dash-${profile?.uid ?? ''}`;
  const cached = getCached<ClientDashData>(cacheKey);
  const [routine, setRoutine] = useState<Routine | null>(cached?.routine ?? null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.weightLogs ?? []);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(cached?.workoutLogs ?? []);
  const [habits, setHabits] = useState<Habit[]>(cached?.habits ?? []);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(cached?.habitLogs ?? []);
  const [cycleAnchor, setCycleAnchor] = useState<AnclaDelAlumno | null>(cached?.cycleAnchor ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);
  // Ciclo en curso (si el coach usa planificación). Best-effort: si las reglas
  // de ciclos aún no están publicadas, la consulta falla en silencio y no se
  // muestra la tarjeta — nunca rompe el resto del inicio.
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [activeCyc, setActiveCyc] = useState<TrainingCycle | null>(null);

  const load = useCallback(
    async (isActive?: () => boolean) => {
      if (!profile) return;
      // Sube entrenos que quedaron pendientes por falta de conexión.
      await flushPendingWorkouts().catch(() => {});
      const [routineData, weightData, workoutData, habitData, habitLogData] =
        await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWeightLogsForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
          getHabitsForClient(profile.uid),
          getHabitLogsForClient(profile.uid),
        ]);
      const anchor = routineData ? await anclaDelAlumno(routineData.id, profile) : null;
      if (isActive && !isActive()) return;
      setCycleAnchor(anchor);
      setRoutine(routineData);
      setWeightLogs(weightData);
      setWorkoutLogs(workoutData);
      setHabits(habitData);
      setHabitLogs(habitLogData);
      setCached(cacheKey, {
        routine: routineData,
        weightLogs: weightData,
        workoutLogs: workoutData,
        habits: habitData,
        habitLogs: habitLogData,
        cycleAnchor: anchor,
      } satisfies ClientDashData);
      setLoading(false);
      setRefreshing(false);

      /*
       * Reprograma los avisos de "se te ha olvidado subir el entreno".
       *
       * Va aquí y no en una pantalla de ajustes porque un aviso local solo se
       * puede programar con la app abierta, y el día que hace falta avisar es
       * justo aquel en que el alumno NO la abre. Cada vez que entra se dejan
       * puestos los de los próximos días de entreno; al registrar una sesión se
       * cancelan los de ese día.
       *
       * Es idempotente: borra los anteriores y los vuelve a poner enteros.
       */
      if (profile.missedWorkoutRemindersEnabled) {
        const entrenoHoy = workoutData.some((l) => esHoy(l.date));
        programarAvisosOlvido(routineData, entrenoHoy, profile.reminderHour ?? 18, {
          alumno: anchor,
          pausas: profile.planPauses,
        }).catch(() => {});
      } else {
        cancelarAvisosOlvido().catch(() => {});
      }
    },
    [profile, cacheKey]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active).catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  // Ciclo en curso (best-effort). Si las reglas de ciclos aún no están
  // publicadas, la consulta falla en silencio y no se muestra la tarjeta.
  useEffect(() => {
    if (!profile) return;
    getCyclesForClientSelf(profile.uid)
      .then((cs) => {
        setCycles(cs);
        setActiveCyc(activeCycle(cs));
      })
      .catch(() => {});
  }, [profile]);

  if (loading)
    return (
      <ScreenContainer>
        <DashboardSkeleton />
      </ScreenContainer>
    );

  // Atleta individual: se autoentrena (sin coach). Cambia el tono de varias
  // tarjetas para que todo hable de "tú" en lugar de "tu entrenador".
  const isAthlete = profile?.role === 'athlete';
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const sessions = weekSessions(workoutLogs);
  /*
   * Pausa del plan (lesión, viaje, una semana imposible). Toca tres cosas:
   *
   *  - La racha: los días de pausa entran como descanso, así que ni cuentan ni
   *    rompen. Es la misma puerta que ya usaba el modo Sensaciones.
   *  - El ciclo: el ancla se desplaza tantos días como se lleve en pausa, que
   *    es la forma de decirle "esos días no han pasado". Al volver se retoma el
   *    día que se dejó.
   *  - Lo que se propone hoy: durante la pausa, nada.
   */
  const enPausa = pausaActiva(profile?.planPauses);
  const ciclo = { alumno: cycleAnchor, pausas: profile?.planPauses };
  const streak = currentStreak(workoutLogs, {
    routine,
    cycleAnchor,
    pausas: profile?.planPauses,
    restDays: [...(profile?.flexRestDays ?? []), ...diasDePausa(profile?.planPauses)],
  });
  // Qué toca hoy según el modo (semanal o Método REIN TENA por ciclo).
  const sesionDelPlan = resolveTodaySession(routine, ciclo);
  const todaySession = enPausa
    ? { day: null, isRest: false, optionalRest: false }
    : sesionDelPlan;
  const todaysDay = todaySession.day;
  const restDay = todaySession.isRest;
  const optionalRest = todaySession.optionalRest;
  const nextDay = todaySession.day;
  const isCycle = routine?.schedule === 'cycle';
  // Grease the groove: la tarjeta de hoy no es "empezar sesión" sino "cuántas
  // series llevas", porque a esta pantalla se vuelve seis veces al día.
  const esModoGtg = esGtg(routine);
  const progresoDelDia = esModoGtg
    ? progresoGtg(routine, entrenoDeHoy(workoutLogs, routine!.id))
    : null;

  /*
   * El aviso de peso solo se le pone a quien YA se pesa.
   *
   * Antes salía también a quien no lo había registrado nunca, y a ese no había
   * forma de quitárselo: un recordatorio ámbar en su pantalla de inicio, todos
   * los días, para siempre, por no usar algo que es opcional. Eso no es un
   * recordatorio, es una piedra en el zapato.
   *
   * A quien empieza ya se lo ofrece "Primeros pasos" —una vez, con su casilla
   * y su forma de darlo por hecho—, así que el aviso no aportaba nada nuevo:
   * repetía la misma invitación sin la salida.
   */
  const lastWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const showWeightReminder =
    !!lastWeightLog &&
    (Date.now() - lastWeightLog.date) / (1000 * 60 * 60 * 24) > WEIGHT_REMINDER_DAYS;

  const today = todayStart();
  const todayLogByHabit = new Map(
    habitLogs.filter((l) => l.day === today).map((l) => [l.habitId, l])
  );

  const toggleHabit = async (habit: Habit) => {
    const existing = todayLogByHabit.get(habit.id);
    if (existing) {
      setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
      await unlogHabit(existing.id);
    } else {
      const optimistic: HabitLog = {
        id: `tmp-${habit.id}`,
        trainerId: habit.trainerId,
        clientId: habit.clientId,
        habitId: habit.id,
        day: today,
        createdAt: Date.now(),
      };
      setHabitLogs((prev) => [...prev, optimistic]);
      const newId = await logHabitToday({
        trainerId: habit.trainerId,
        clientId: habit.clientId,
        habitId: habit.id,
      });
      setHabitLogs((prev) =>
        prev.map((l) => (l.id === optimistic.id ? { ...l, id: newId } : l))
      );
    }
  };

  const objetivos = objetivosDe(profile);
  const targetSessions = routine?.days.length ?? 0;
  const weekProgress = targetSessions > 0 ? Math.min(sessions / targetSessions, 1) : 0;

  // Checklist de bienvenida: se oculta cuando está todo completado.
  const firstSteps = [
    { key: 'photo', label: 'Sube tu foto de perfil', done: Boolean(profile?.photoURL), go: '/(client)/profile' as const },
    { key: 'weight', label: 'Registra tu peso inicial', done: weightLogs.length > 0, go: '/(client)/progress?tab=nutricion' as const },
    ...(isAthlete
      ? [{ key: 'plan', label: 'Crea tu plan de entreno', done: Boolean(routine), go: '/(client)/my-plan' as const }]
      : []),
    { key: 'workout', label: 'Completa tu primer entrenamiento', done: workoutLogs.length > 0, go: '/(client)/workout' as const },
  ] as const;
  const showFirstSteps = firstSteps.some((s) => !s.done);

  // Su enlace de cobro: el de SU ficha, con SU precio. Sale del propio perfil,
  // que ya viene cargado, así que no hace falta ir a buscar el del entrenador
  // cada vez que se abre el inicio.
  const enlaceDelPago = enlaceDePagoDe(profile);
  const stepsDone = firstSteps.filter((s) => s.done).length;

  // El alumno declara que ya ha pagado: lo registra y avisa al entrenador.
  const handleReportPayment = async () => {
    if (!profile) return;
    setReporting(true);
    try {
      await reportClientPayment(profile.uid);
      if (profile.trainerId) {
        notifyUser(
          profile.trainerId,
          'Pago declarado',
          frase`${profile.name?.split(' ')[0] ?? t('Un alumno')} dice que ya ha pagado su cuota. Revísalo y confírmalo.`
        ).catch(() => {});
      }
      await refreshProfile();
      showToast('Tu entrenador recibirá el aviso');
    } catch {
      showToast('No se pudo enviar el aviso');
    } finally {
      setReporting(false);
    }
  };

  // Aviso de pago para el alumno (dato en su propio perfil, lo fija el coach):
  // cobro próximo (ámbar) o cobro pendiente/vencido (rojo). Ayuda a que el
  // alumno renueve pronto y le facilita el trabajo al entrenador.
  const paymentAlert = (() => {
    const fee = profile?.monthlyFeeEur ? `${profile.monthlyFeeEur} €` : 'tu cuota';
    const fmt = (ts: number) => diaYMes(ts);
    const due = profile?.nextPaymentDate;
    const status = profile?.paymentStatus;
    if (due) {
      const days = Math.round((inicioDelDia(due) - inicioDelDia(Date.now())) / (24 * 60 * 60 * 1000));
      if (days < 0) {
        // Se avisa de cuántos días quedan antes de que se pause el acceso.
        // Bloquear sin haber dicho antes que iba a pasar es lo que convierte un
        // recordatorio en un castigo.
        const restan = clientDaysUntilLock(profile);
        const cola =
          restan === null
            ? ''
            : restan === 0
              ? ' Tu acceso queda en pausa hasta que se resuelva.'
              : restan === 1
                ? t(' Te queda 1 día antes de que el acceso se pause.')
                : frase` Te quedan ${restan} días antes de que el acceso se pause.`;
        return {
          bad: true,
          title: 'Cobro pendiente',
          text: frase`Tu cuota de ${fee} venció el ${fmt(due)}.${cola}`,
        };
      }
      if (days <= 5)
        return {
          bad: false,
          title: 'Cobro próximo',
          text:
            days === 0
              ? frase`Hoy vence tu cuota de ${fee}. Ponte al día con tu entrenador.`
              : days === 1
                ? frase`Tu cuota de ${fee} vence mañana (${fmt(due)}).`
                : frase`Tu cuota de ${fee} vence en ${days} días (${fmt(due)}).`,
        };
      return null;
    }
    // Sin fecha, pero el coach marcó el estado a mano.
    if (status === 'overdue')
      return {
        bad: true,
        title: 'Cobro pendiente',
        text: frase`Tienes un pago pendiente de ${fee}. Renueva con tu entrenador.`,
      };
    if (status === 'pending')
      return {
        bad: false,
        title: 'Cobro próximo',
        text: frase`Tu entrenador espera el pago de ${fee}. Ponte al día cuando puedas.`,
      };
    return null;
  })();

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {/* Solo aparece en cuentas de atleta durante su prueba gratuita. */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingLabel}>Bienvenido de nuevo</Text>
          <Text style={styles.greeting}>{profile?.name?.split(' ')[0]}</Text>
        </View>
        <Pressable onPress={() => router.push('/(client)/profile')}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={52} />
        </Pressable>
      </View>

      {/* Solo al atleta que aún no paga, y solo el ÚLTIMO día de su prueba
          (ver UpgradePopup): el día que se crea la cuenta acaba de pagar y no
          hay nada que decidir todavía. Durante todo el mes la tarjeta está en
          su perfil para quien la busque. */}
      <UpgradePopup />

      {paymentAlert ? (
        <View style={[styles.payCard, paymentAlert.bad ? styles.payCardBad : styles.payCardWarn]}>
          <Ionicons
            name={paymentAlert.bad ? 'alert-circle' : 'card-outline'}
            size={20}
            color={paymentAlert.bad ? colors.danger : colors.primaryBright}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.payTitle, { color: paymentAlert.bad ? colors.danger : colors.primaryBright }]}
            >
              {paymentAlert.title}
            </Text>
            <Text style={styles.payText}>{paymentAlert.text}</Text>
            {profile?.paymentReportedAt ? (
              <View style={styles.payReported}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryBright} />
                <Text style={styles.payReportedText}>Pago informado · pendiente de confirmar</Text>
              </View>
            ) : (
              <View style={styles.payActions}>
                {/* El enlace es SUYO, no del grupo: lo pone su entrenador en su
                    ficha, con su precio. Sin enlace no hay botón, y se paga
                    por donde se pagaba: no se ofrece uno común que cobraría
                    otra cantidad. */}
                {enlaceDelPago ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(urlDePago(enlaceDelPago, profile?.uid ?? '')).catch(() =>
                        showToast('No se pudo abrir el pago')
                      )
                    }
                    style={styles.payBtn}
                  >
                    <Ionicons name="card" size={15} color={colors.onPrimary} />
                    <Text style={styles.payBtnText}>
                      {profile?.monthlyFeeEur ? `Pagar ${profile.monthlyFeeEur} €` : 'Pagar ahora'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleReportPayment}
                  disabled={reporting}
                  style={styles.payReportBtn}
                >
                  <Text style={styles.payReportBtnText}>Ya he pagado</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* La pausa va por delante de todo lo demás, incluso de la acción del
          día. Un alumno de baja que abre la app necesita ver en el primer
          vistazo que la app lo sabe: si no, cada tarjeta de "hoy tocaba" se lee
          como un reproche, que es justo lo que la pausa venía a evitar. */}
      {enPausa ? (
        <FadeIn>
          <Card accent style={styles.section}>
            <View style={styles.pausaFila}>
              <Ionicons name="pause-circle" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pausaTitulo}>Plan en pausa</Text>
                <Text style={styles.pausaTexto}>
                  {diasQueQuedan(enPausa) === 1
                    ? 'Último día. Mañana vuelves al plan.'
                    : `Quedan ${diasQueQuedan(enPausa)} días. Vuelves el ${diaLargo(
                        enPausa.hasta + 24 * 60 * 60 * 1000
                      )}.`}
                </Text>
                {enPausa.motivo ? (
                  <Text style={styles.pausaMotivo}>{enPausa.motivo}</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.pausaPie}>
              Tu racha está a salvo y no te voy a dar la lata. Si un día te
              apetece entrenar, adelante: cuenta igual.
            </Text>
          </Card>
        </FadeIn>
      ) : null}

      {/* La acción del día va PRIMERO: es a lo que se entra. Todo lo
          demás —avisos, plan, frase— se lee después de saber si hoy toca
          entrenar y qué toca. */}
      <FadeIn>
      <Pressable
        onPress={() =>
          router.push(isAthlete && !routine ? '/(client)/my-plan' : '/(client)/workout')
        }
      >
        <LinearGradient
          colors={gradients.goldSubtle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.todayCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.todayLabel}>
              {esModoGtg
                ? 'Grease the groove'
                : routine?.schedule === 'flex'
                ? `${flexLabel(routine.scheduleLabel)} · eliges tú`
                : isCycle
                  ? unido(
                      'Días sueltos',
                      todaySession.cycleLabel,
                      todaySession.day?.intensity && `Int. ${todaySession.day.intensity}/10`
                    )
                  : todaysDay
                    ? `Hoy · ${WEEKDAY_NAMES[todayWeekday()]}`
                    : 'Tu entrenamiento'}
            </Text>
            {routine && progresoDelDia ? (
              <>
                <Text style={styles.todayTitle}>
                  {progresoDelDia.hechas} de {progresoDelDia.objetivo} series
                </Text>
                <Text style={styles.todaySub}>{textoDelDia(progresoDelDia)}</Text>
              </>
            ) : routine && optionalRest ? (
              <>
                <Text style={styles.todayTitle}>Descanso opcional</Text>
                <Text style={styles.todaySub}>
                  Tú eliges: descansar o reiniciar el ciclo en el Día 1. Entra para decidir.
                </Text>
              </>
            ) : routine && restDay ? (
              <>
                <Text style={styles.todayTitle}>Día de descanso</Text>
                <Text style={styles.todaySub}>Hoy no toca sesión. Recupera y vuelve con todo.</Text>
              </>
            ) : routine && routine.schedule === 'flex' ? (
              <>
                <Text style={styles.todayTitle}>
                  {flexLabel(routine.scheduleLabel, 'Rutina personalizada')}
                </Text>
                <Text style={styles.todaySub}>Tú eliges qué hacer hoy. Entra y empieza.</Text>
              </>
            ) : routine && nextDay ? (
              <>
                <Text style={styles.todayTitle}>{nextDay.name}</Text>
                <Text style={styles.todaySub}>
                  {nextDay.exercises.length} ejercicios · Empezar sesión
                </Text>
              </>
            ) : isAthlete ? (
              <>
                <Text style={styles.todayTitle}>Crea tu plan</Text>
                <Text style={styles.todaySub}>Diseña tus días y empieza hoy. Toca para crearlo.</Text>
              </>
            ) : (
              <>
                <Text style={styles.todayTitle}>Sin rutina aún</Text>
                <Text style={styles.todaySub}>Tu entrenador te la asignará pronto.</Text>
              </>
            )}
          </View>
          {(() => {
            const canTrain = !!routine && !restDay && (!!nextDay || routine.schedule === 'flex');
            const createPlan = isAthlete && !routine;
            const icon = canTrain ? 'play' : createPlan ? 'construct' : 'bed-outline';
            return (
              <View style={canTrain || createPlan ? styles.todayPlay : styles.todayRest}>
                <Ionicons
                  name={icon}
                  size={canTrain ? 26 : 24}
                  color={canTrain || createPlan ? colors.onPrimary : colors.primaryBright}
                />
              </View>
            );
          })()}
        </LinearGradient>
      </Pressable>
      </FadeIn>

      {/* Atleta: acceso a gestionar su propio plan de entreno. */}
      {profile?.role === 'athlete' ? (
        <Pressable
          onPress={() => router.push('/(client)/my-plan')}
          style={styles.myPlanEntry}
        >
          <View style={styles.myPlanIcon}>
            <Ionicons name="construct-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.myPlanTitle}>Mi plan de entreno</Text>
            <Text style={styles.myPlanSub}>Crea y edita tus días y ejercicios.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      {/* La temporada. El atleta no tiene a nadie que le diga cuándo apretar y
          cuándo soltar: si no se lo reparte él, no se lo reparte nadie. */}
      {profile?.role === 'athlete' ? (
        <Pressable
          onPress={() => router.push('/(client)/planning')}
          style={styles.myPlanEntry}
        >
          <View style={styles.myPlanIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.myPlanTitle}>Mi temporada</Text>
            <Text style={styles.myPlanSub}>Bloques, semanas y descargas.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      {showWeightReminder ? (
        <Pressable onPress={() => router.push('/(client)/progress')}>
          <View style={styles.reminderBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.reminderText}>
              Llevas más de una semana sin registrar tu peso.
            </Text>
          </View>
        </Pressable>
      ) : null}


      {/* Ciclo en curso (solo si el coach usa planificación) */}
      {activeCyc
        ? (() => {
            const cs = computeCycleStats(activeCyc, workoutLogs);
            // Si el ciclo forma parte de un plan, la semana se cuenta sobre el
            // plan entero: al alumno le dice más "semana 6 de 12" que "semana 2".
            const bloque = activeCyc.parentId
              ? (cycles.find((c) => c.id === activeCyc.parentId) ?? null)
              : null;
            const raiz = bloque?.parentId
              ? (cycles.find((c) => c.id === bloque.parentId) ?? bloque)
              : bloque;
            const plan = raiz ? planSummary(planCalendar(raiz, cycles, workoutLogs)) : null;
            const wk =
              plan && plan.totalWeeks > 0 && plan.week > 0
                ? { week: plan.week, totalWeeks: plan.totalWeeks }
                : cycleWeekInfo(activeCyc);
            return (
              <View style={styles.cycleCard}>
                <View style={styles.cycleTop}>
                  <Text style={styles.cycleLevel} numberOfLines={1}>
                    {bloque ? nombreDeCiclo(bloque.name) : CYCLE_LEVEL_LABEL[activeCyc.level]}
                  </Text>
                  <View style={styles.cycleWeekBadge}>
                    <Ionicons name="calendar-outline" size={12} color={colors.primaryBright} />
                    <Text style={styles.cycleWeekText}>
                      Semana {wk.week}
                      {wk.totalWeeks ? frase` de ${wk.totalWeeks}` : ''}
                    </Text>
                  </View>
                  {activeCyc.isDeload ? (
                    <Text style={styles.cycleDeload}>Semana de descarga</Text>
                  ) : null}
                </View>
                <Text style={styles.cycleName}>
                  {raiz && raiz !== bloque ? `${nombreDeCiclo(raiz.name)} · ` : ''}
                  {nombreDeCiclo(activeCyc.name)}
                </Text>
                {cs.pctComplete != null ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <ProgressBar progress={cs.pctComplete} height={7} />
                  </View>
                ) : null}
                <Text style={styles.cycleMeta}>
                  {cs.sessionsDone}
                  {activeCyc.targetSessions ? `/${activeCyc.targetSessions}` : ''} sesiones
                  {cs.pctComplete != null ? ` · ${Math.round(cs.pctComplete * 100)}%` : ''}
                  {activeCyc.endDate
                    ? frase` · hasta ${diaMes(activeCyc.endDate)}`
                    : ''}
                </Text>
                {activeCyc.goal || bloque?.goal || raiz?.goal ? (
                  <Text style={styles.cycleGoal}>
                    {activeCyc.goal || bloque?.goal || raiz?.goal}
                  </Text>
                ) : null}
              </View>
            );
          })()
        : null}

      {/* Plan semanal: el anillo manda, y debajo la tira de días. */}
      <FadeIn delay={140}>
      <Card style={styles.section}>
        {targetSessions > 0 ? (
          <View style={styles.weekTop}>
            {/* Pasada la meta, "2/1" se lee como un error, no como un logro:
                el anillo ya está cerrado y lo que queda por decir es cuántas
                llevas. */}
            <ProgressRing
              progress={weekProgress}
              value={
                sessions > targetSessions ? String(sessions) : `${sessions}/${targetSessions}`
              }
              label="semana"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Tu semana</Text>
              <Text style={styles.weekBig}>
                {sessions >= targetSessions
                  ? 'Semana cerrada'
                  : frase`${targetSessions - sessions} para cerrarla`}
              </Text>
              {streak > 0 ? (
                <View style={styles.streakInline}>
                  <Ionicons name="flame" size={14} color={colors.primaryBright} />
                  <CountUp
                    value={streak}
                    suffix={frase` día${streak === 1 ? '' : 's'} de racha`}
                    style={styles.streakInlineText}
                  />
                </View>
              ) : (
                <Text style={styles.weekHint}>
                  {sessions >= targetSessions
                    ? 'Objetivo cumplido. Lo que venga es de propina.'
                    : frase`Llevas ${sessions} de ${targetSessions} sesiones.`}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.weekHeader}>
            <Text style={styles.sectionLabel}>Tu semana</Text>
          </View>
        )}

        <WeekStrip routine={routine} trainedDays={trainingDays(workoutLogs)} />

        {targetSessions > 0 ? null : (
          <Text style={styles.weekHint}>
            {isAthlete
              ? 'Crea tu plan para ver aquí tu semana y tu objetivo de sesiones.'
              : 'Cuando tengas rutina asignada verás aquí tu plan y objetivo semanal.'}
          </Text>
        )}

        <View style={styles.weekLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDone]} />
            <Text style={styles.legendText}>Hecho</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendPlanned]} />
            <Text style={styles.legendText}>Planificado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendTodayDot]} />
            <Text style={styles.legendText}>Hoy</Text>
          </View>
        </View>
      </Card>
      </FadeIn>

      {/* LO QUE TOCA A DIARIO, aparte del plan: el pino, la movilidad.
          Vivía en Entreno y ahí no era su sitio: se hace TODOS los días, no
          los de entrenar, y allí competía con la sesión en marcha. Aquí, en la
          pantalla que se abre cada mañana, es lo primero que se ve y se marca
          de camino. Se pinta sola solo si su entrenador le ha puesto una. */}
      <FadeIn delay={205}>
        <RutinaDiariaDelDia profile={profile} />
      </FadeIn>

      {/* La racha y las sesiones ya están en el anillo de arriba: repetirlas
          aquí en tres cuadros iguales le quitaba peso a las dos. Queda el peso,
          que no está en ningún otro sitio de esta pantalla. Lleva a la pestaña
          de Nutrición de Progreso, que es donde se apunta. */}
      <FadeIn delay={210}>
      <Pressable
        onPress={() => router.push('/(client)/progress?tab=nutricion')}
        style={styles.weightRow}
      >
        <Ionicons name="body-outline" size={17} color={colors.textMuted} />
        <Text style={styles.weightLabel}>Peso</Text>
        <Text style={styles.weightValue}>
          {currentWeight != null ? `${kgCorto(currentWeight)} kg` : 'Sin registrar'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
      </FadeIn>

      {showFirstSteps ? (
        <Card accent style={styles.section}>
          <View style={styles.firstStepsHeader}>
            <Text style={styles.sectionLabel}>Primeros pasos</Text>
            <Text style={styles.firstStepsCount}>
              {stepsDone}/{firstSteps.length}
            </Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <ProgressBar progress={stepsDone / firstSteps.length} height={5} />
          </View>
          {firstSteps.map((step) => (
            <Pressable
              key={step.key}
              onPress={() => {
                if (!step.done && step.go) router.push(step.go);
              }}
              style={styles.firstStepRow}
            >
              <View style={[styles.stepCheck, step.done && styles.stepCheckDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
                {step.label}
              </Text>
              {!step.done && step.go ? (
                <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
              ) : null}
            </Pressable>
          ))}
        </Card>
      ) : null}

      {habits.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Hábitos de hoy</Text>
          {habits.map((h) => {
            const done = todayLogByHabit.has(h.id);
            return (
              <Pressable key={h.id} onPress={() => toggleHabit(h)} style={styles.habitRow}>
                <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  ) : null}
                </View>
                <Text style={[styles.habitName, done && styles.habitNameDone]}>{h.name}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* Los tres objetivos, uno por línea y en el orden en que se viven:
          esta semana, este trimestre, algún día. Pequeño a propósito —cierra
          la pantalla, no la abre— pero de un vistazo se ve si lo de hoy lleva
          a lo de dentro de tres años. */}
      {hayObjetivos(objetivos) ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Mis objetivos</Text>
          {objetivosVisibles(objetivos).map((o) => (
            <View key={o.etiqueta} style={styles.objetivoFila}>
              <Text style={styles.objetivoPlazo}>{o.etiqueta}</Text>
              <Text style={styles.objetivoTexto} numberOfLines={2}>
                {o.texto}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greetingLabel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  greeting: { ...typography.h1, color: colors.text, marginTop: 2 },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  payCardWarn: { backgroundColor: colors.primaryMuted, borderColor: colors.hairline },
  payCardBad: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  payTitle: { ...typography.body, fontFamily: fonts.semiBold },
  payText: { ...typography.small, color: colors.textMuted, marginTop: 1, lineHeight: 18 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  payBtnText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.heading },
  payActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  payReportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  payReportBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  payReported: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  payReportedText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  reminderText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold, flex: 1 },
  myPlanEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  myPlanIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlanTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  myPlanSub: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  streakInline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  streakInlineText: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  weightLabel: { ...typography.body, color: colors.textMuted, flex: 1 },
  weightValue: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  cycleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cycleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // "INTENSIFICACIÓN" y "Semana 6 de 8" juntas piden 248 y hay 222: la
    // segunda baja de línea en lugar de cortar el nombre de la fase.
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cycleLevel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  cycleDeload: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  cycleName: { ...typography.h3, color: colors.text, marginTop: 4 },
  cycleMeta: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  cycleGoal: { ...typography.small, color: colors.textFaint, marginTop: 4, fontStyle: 'italic' },
  cycleWeekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  cycleWeekText: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  sectionLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  pausaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pausaTitulo: { ...typography.h3, color: colors.text },
  pausaTexto: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  pausaMotivo: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    marginTop: 2,
  },
  pausaPie: { ...typography.small, color: colors.textFaint, lineHeight: 18, marginTop: spacing.sm },
  section: { marginBottom: spacing.md },
  // ----- Hero "Hoy toca" -----
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  todayLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  todayTitle: { ...typography.h1, color: colors.text, fontSize: 24 },
  todaySub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  todayPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowGold,
  },
  todayRest: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ----- Tarjeta "Tu semana" -----
  weekTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  weekBig: { ...typography.h2, color: colors.text, marginTop: 2 },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekHint: { ...typography.small, color: colors.textMuted },
  weekLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  legendDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  legendPlanned: { backgroundColor: colors.surfaceAlt, borderColor: colors.hairline },
  legendTodayDot: { backgroundColor: colors.surfaceAlt, borderColor: colors.primaryBright, borderWidth: 2 },
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  objetivoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // El plazo, a un ancho fijo: así las tres líneas quedan alineadas y se leen
  // como una tabla de tres filas y no como tres frases sueltas.
  objetivoPlazo: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    width: 78,
    paddingTop: 2,
  },
  objetivoTexto: { ...typography.small, color: colors.text, flex: 1, lineHeight: 18 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  habitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  habitName: { ...typography.body, color: colors.text },
  habitNameDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  firstStepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  firstStepsCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  firstStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stepCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepLabel: { ...typography.body, color: colors.text, flex: 1 },
  stepLabelDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
