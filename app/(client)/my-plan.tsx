import { t, frase } from '../../lib/idioma';
import { diaMes, inicioDelDia } from '../../lib/fechas';
import React, { useCallback, useRef, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { DragList } from '../../components/DragList';
import { moveItem } from '../../lib/useDragReorder';
import { ajustaPct } from '../../lib/intensidad';
import { Chip } from '../../components/Chip';
import { DiasSemana } from '../../components/DiasSemana';
import { Opciones } from '../../components/Opciones';
import { Segmented } from '../../components/Segmented';
import { RutinaDiariaEditor } from '../../components/RutinaDiariaEditor';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../lib/firestore/routines';
import { flexLabel, nombreDelDia } from '../../lib/schedule';
import { SERIES_POR_DEFECTO } from '../../lib/gtg';
import { minutosSegundos, segundosDeTexto } from '../../lib/duracion';
import { idDeEjercicioPropio as slug, nuevoId } from '../../lib/ids';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import {
  CLUSTER_DEFAULT,
  clusterBlocks,
  EXERCISE_MEASURES,
  type ExerciseLoad,
  type ExerciseMeasure,
  GRIP_LABEL,
  GRIP_TYPES,
  isDualMeasure,
  isHoldMeasure,
  LOAD_LABEL,
  LOAD_TYPES,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  resolveLoad,
  type Routine,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
  WEEKDAY_LABELS,
} from '../../lib/types';


/** Variantes de carga (calistenia): normal / lastrado / con goma. */
function newExercise(name = '', measure: ExerciseMeasure = 'reps', reps = '10'): RoutineExercise {
  return { id: nuevoId(), exerciseId: slug(name), name, sets: 4, reps, measure, load: 'none' };
}
function newDay(n: number): RoutineDay {
  return { id: nuevoId(), name: `Día ${n}`, exercises: [newExercise()] };
}

/** Plantillas de arranque para no empezar desde una hoja en blanco. */
interface Starter {
  key: string;
  label: string;
  schedule: RoutineSchedule;
  scheduleLabel?: string;
  gtgSetsPerDay?: number;
  build: () => RoutineDay[];
}
const ex = (name: string, sets: number, reps: string, measure: ExerciseMeasure = 'reps') => ({
  ...newExercise(name, measure, reps),
  sets,
});
const STARTERS: Starter[] = [
  {
    key: 'fullbody',
    label: 'Cuerpo completo · 3 días',
    schedule: 'weekly',
    build: () => [
      { id: nuevoId(), name: 'Día A', weekday: 0, exercises: [ex('Dominadas', 4, '6-10'), ex('Fondos en paralelas', 4, '8-12'), ex('Sentadilla', 4, '12'), ex('Plancha abdominal', 3, '40', 'seconds')] },
      { id: nuevoId(), name: 'Día B', weekday: 2, exercises: [ex('Flexiones', 4, '12-15'), ex('Remo australiano', 4, '10-12'), ex('Zancadas', 3, '12'), ex('Hollow hold', 3, '30', 'seconds')] },
      { id: nuevoId(), name: 'Día C', weekday: 4, exercises: [ex('Dominadas supinas', 4, '6-10'), ex('Fondos en banco', 4, '12'), ex('Puente de glúteo', 3, '15'), ex('L-sit', 3, '20', 'seconds')] },
    ],
  },
  {
    key: 'ppl',
    label: 'Empuje / Tirón / Pierna',
    schedule: 'weekly',
    build: () => [
      { id: nuevoId(), name: 'Empuje', weekday: 0, exercises: [ex('Flexiones', 4, '12-15'), ex('Fondos en paralelas', 4, '8-12'), ex('Pike push-up', 3, '8-10'), ex('Plancha abdominal', 3, '40', 'seconds')] },
      { id: nuevoId(), name: 'Tirón', weekday: 2, exercises: [ex('Dominadas', 4, '6-10'), ex('Remo australiano', 4, '10-12'), ex('Curl con goma', 3, '12'), ex('Hollow hold', 3, '30', 'seconds')] },
      { id: nuevoId(), name: 'Pierna', weekday: 4, exercises: [ex('Sentadilla', 4, '15'), ex('Zancadas', 3, '12'), ex('Puente de glúteo', 4, '15'), ex('Gemelos de pie', 4, '20')] },
    ],
  },
  {
    key: 'sensaciones',
    label: 'A sensaciones',
    schedule: 'flex',
    scheduleLabel: 'Sensaciones',
    build: () => [
      { id: nuevoId(), name: 'Fuerza (día fuerte)', exercises: [ex('Dominadas lastradas', 5, '3-5'), ex('Fondos lastrados', 5, '3-5'), ex('Sentadilla búlgara', 4, '8')] },
      { id: nuevoId(), name: 'Volumen (día medio)', exercises: [ex('Dominadas', 4, '8-10'), ex('Flexiones', 4, '15'), ex('Zancadas', 3, '12')] },
      { id: nuevoId(), name: 'Suave (poca energía)', exercises: [ex('Remo australiano', 3, '12'), ex('Flexiones rodillas', 3, '12'), ex('Plancha abdominal', 3, '30', 'seconds')] },
    ],
  },
  {
    key: 'gtg',
    label: 'Grease the groove · dominadas',
    schedule: 'gtg',
    gtgSetsPerDay: 6,
    // Las repeticiones son el objetivo de CADA serie suelta, no del día: tres
    // dominadas fáciles, seis veces repartidas. Y "series" queda en 1 porque en
    // este modo la serie se apunta de una en una, según sale.
    build: () => [
      { id: nuevoId(), name: 'Dominadas todo el día', exercises: [ex('Dominadas', 1, '3')] },
    ],
  },
];

export default function MyPlanScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Mi plan');
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
  const [scheduleLabel, setScheduleLabel] = useState('Sensaciones');
  const [cycleStartDate, setCycleStartDate] = useState<number>(() => inicioDelDia(Date.now()));
  /*
   * La fecha con la que se abrió el plan. Solo si CAMBIA se anota que el ciclo
   * se ha reprogramado: guardar el plan para tocar una serie no puede tumbar el
   * día que el propio atleta hubiera fijado desde la pantalla de entreno.
   */
  const fechaAlAbrir = useRef<number | null>(null);
  // Series al día del modo grease the groove, como texto mientras se teclea.
  const [gtgSets, setGtgSets] = useState('');
  /** Las series al día en número; vacío o disparatado deja las de por defecto. */
  const seriesAlDia = (): number | undefined => {
    if (schedule !== 'gtg') return undefined;
    const n = Number.parseInt(gtgSets, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  // Qué días están desplegados. Todos cerrados al entrar, igual que en el
  // editor del coach: son el mismo editor con el mismo gesto, y abrir el
  // primero llenaba la pantalla de campos antes de saber qué se venía a tocar.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [restText, setRestText] = useState<Record<string, string>>({});
  // Ejercicio cuyo selector de categoría está abierto. Los demás la enseñan
  // recogida en una etiqueta.
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const r = await getActiveRoutineForClient(profile.uid, profile.uid);
      if (r) {
        setRoutineId(r.id);
        setName(r.name);
        setDays(r.days.length ? r.days : [newDay(1)]);
        setSchedule(r.schedule ?? 'weekly');
        if (r.scheduleLabel) setScheduleLabel(flexLabel(r.scheduleLabel));
        if (r.cycleStartDate) setCycleStartDate(r.cycleStartDate);
        fechaAlAbrir.current = r.cycleStartDate ?? null;
        if (r.gtgSetsPerDay) setGtgSets(String(r.gtgSetsPerDay));
      } else {
        setRoutineId(null);
        setName('Mi plan');
        setDays([]);
      }
    } catch {
      setDays([]);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleDay = (dayId: string, fallback: boolean) =>
    setExpanded((p) => ({ ...p, [dayId]: !(p[dayId] ?? fallback) }));
  const patchDay = (di: number, patch: Partial<RoutineDay>) =>
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  const patchEx = (di: number, ei: number, patch: Partial<RoutineExercise>) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === di
          ? { ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : d
      )
    );

  // Duplica un día (con ids nuevos) justo debajo, para no rehacerlo entero.
  const duplicateDay = (di: number) =>
    setDays((prev) => {
      const src = prev[di];
      const clone: RoutineDay = {
        ...src,
        id: nuevoId(),
        name: `${src.name} (copia)`,
        exercises: src.exercises.map((e) => ({ ...e, id: nuevoId() })),
      };
      const next = [...prev];
      next.splice(di + 1, 0, clone);
      return next;
    });

  const applyStarter = (s: Starter) => {
    setSchedule(s.schedule);
    if (s.scheduleLabel) setScheduleLabel(s.scheduleLabel);
    if (s.gtgSetsPerDay) setGtgSets(String(s.gtgSetsPerDay));
    const built = s.build();
    setDays(built);
    setExpanded(built.length ? { [built[0].id]: true } : {});
    showToast('Plantilla aplicada · ajústala a tu gusto');
  };

  const handleSave = async () => {
    if (!profile) return;
    const clean = days
      .map((d) => ({
        ...d,
        exercises: d.isRest
          ? []
          : d.exercises
              .filter((e) => e.name.trim())
              .map((e) => ({ ...e, exerciseId: slug(e.name) })),
      }))
      .filter((d) => d.name.trim() && (d.isRest || d.exercises.length > 0));
    if (clean.length === 0) {
      showToast('Añade al menos un día con ejercicios');
      return;
    }
    const cambioLaFecha = schedule === 'cycle' && cycleStartDate !== fechaAlAbrir.current;
    const scheduleFields = {
      schedule,
      cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
      cycleStartDateSetAt: cambioLaFecha ? Date.now() : undefined,
      scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
      gtgSetsPerDay: seriesAlDia(),
    };
    if (cambioLaFecha) fechaAlAbrir.current = cycleStartDate;
    setSaving(true);
    try {
      if (routineId) {
        await updateRoutine(routineId, { name: name.trim() || 'Mi plan', days: clean, ...scheduleFields });
        showToast('Plan guardado');
      } else {
        const id = await createRoutine({
          trainerId: profile.uid,
          clientId: profile.uid,
          name: name.trim() || 'Mi plan',
          active: true,
          days: clean,
          ...scheduleFields,
        } as Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>);
        await setActiveRoutine(profile.uid, id, profile.uid);
        setRoutineId(id);
        showToast('Plan creado. ¡A entrenar!');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const empty = days.length === 0;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: t('Mi plan') }} />
      <Text style={styles.title}>Mi plan</Text>
      <Text style={styles.subtitle}>
        Diseña tu entrenamiento con el método que prefieras. Tú lo creas, tú lo ajustas.
      </Text>

      {/* Plantillas de arranque (sobre todo útil cuando el plan está vacío). */}
      {empty ? (
        <Card accent style={styles.starterCard}>
          <Text style={styles.starterTitle}>Empieza rápido</Text>
          <Text style={styles.starterHint}>
            Elige una base y edítala, o crea la tuya desde cero más abajo.
          </Text>
          <View style={styles.starterRow}>
            {STARTERS.map((s) => (
              <Pressable key={s.key} onPress={() => applyStarter(s)} style={styles.starterChip}>
                <Text style={styles.starterChipText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <TextField label="Nombre del plan" value={name} onChangeText={setName} />

      {/* El atleta se entrena solo, así que se pone su propia rutina diaria:
          es su entrenador. Misma pieza que usa el coach con sus alumnos. */}
      {profile ? (
        <RutinaDiariaEditor trainerId={profile.uid} clientId={profile.uid} paraMi />
      ) : null}

      {/* Método de programación (igual que el coach). */}
      <Card accent style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>Método</Text>
        <Segmented
          compacto
          valor={schedule}
          opciones={[
            { valor: 'weekly' as RoutineSchedule, texto: 'Semana' },
            { valor: 'cycle' as RoutineSchedule, texto: 'Días sueltos' },
            { valor: 'flex' as RoutineSchedule, texto: flexLabel(scheduleLabel) },
            { valor: 'gtg' as RoutineSchedule, texto: 'Grease the groove' },
          ]}
          onChange={setSchedule}
        />

        {schedule === 'gtg' ? (
          <>
            <Text style={styles.scheduleHint}>
              Un ejercicio (o dos) repartido en series sueltas por todo el día, y ninguna al fallo:
              cada serie se queda a la mitad de lo que podrías hacer. Se usa el primer día de abajo,
              y en repeticiones va el objetivo de cada serie.
            </Text>
            <TextField
              label="Series al día"
              keyboardType="number-pad"
              placeholder={String(SERIES_POR_DEFECTO)}
              value={gtgSets}
              onChangeText={setGtgSets}
              style={{ marginTop: spacing.sm, marginBottom: 0 }}
            />
          </>
        ) : schedule === 'flex' ? (
          <>
            <Text style={styles.scheduleHint}>
              Creas varias rutinas (los "días" de abajo) y antes de entrenar eliges cuál hacer según
              cómo te encuentres. Sin calendario fijo.
            </Text>
            <TextField
              label="Nombre de esta programación"
              placeholder="Ej. Sensaciones"
              value={scheduleLabel}
              onChangeText={setScheduleLabel}
              style={{ marginTop: spacing.sm, marginBottom: 0 }}
            />
          </>
        ) : schedule === 'cycle' ? (
          <>
            <Text style={styles.scheduleHint}>
              Los {days.length} días rotan en ciclo (Día 1 → {days.length || 'N'} → repite), sin
              depender del día de la semana. Ajusta la intensidad de cada día abajo.
            </Text>
            <Pressable
              onPress={() => {
                setCycleStartDate(inicioDelDia(Date.now()));
                showToast('Ciclo reiniciado hoy');
              }}
              style={styles.cycleResetBtn}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.cycleResetText}>
                Empezar ciclo hoy · actual:{' '}
                {diaMes(cycleStartDate)}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.scheduleHint}>
            Asigna cada día a un día de la semana con los botones L-D de abajo.
          </Text>
        )}
      </Card>

      <DragList
        items={days}
        keyOf={(d) => d.id}
        gap={0}
        handleOnly
        onReorder={(from, to) => setDays((prev) => moveItem(prev, from, to))}
        renderItem={(day, di, arrastrando, asa) => {
        const isOpen = expanded[day.id] ?? false;
        const total = day.exercises.reduce((a, e) => a + (e.sets || 0), 0);
        const summary = day.isRest
          ? 'Descanso'
          : `${day.exercises.length} ej.${total ? ` · ${total} series` : ''}${
              schedule === 'cycle'
                ? ` · Int. ${day.intensity ?? 5}/10`
                : schedule === 'flex' && day.intensityPct
                  ? ` · ${day.intensityPct} %`
                  : ''
            }`;
        return (
          <Card style={[styles.dayCard, arrastrando && styles.dayCardDragging]}>
            <View style={styles.dayHead}>
              <Pressable style={styles.dayHeadMain} onPress={() => toggleDay(day.id, di === 0)}>
                <Text style={styles.dayTitle} numberOfLines={1}>
                  {nombreDelDia(day.name, di)}
                </Text>
                <Text style={styles.daySummary}>{summary}</Text>
              </Pressable>
              {/* Asa: mantener pulsado y mover para cambiar el orden del día. */}
              <View {...asa}>
                <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
              </View>
              <Pressable onPress={() => duplicateDay(di)} hitSlop={6}>
                <Ionicons name="copy-outline" size={17} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => setDays((p) => p.filter((_, i) => i !== di))} hitSlop={6}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
              <Pressable onPress={() => toggleDay(day.id, di === 0)} hitSlop={6}>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {isOpen ? (
              <>
                <TextField
                  label="Nombre del día"
                  value={day.name}
                  onChangeText={(v) => patchDay(di, { name: v })}
                  style={{ marginTop: spacing.sm }}
                />

                {/* Descanso + (semanal) día de la semana */}
                <View style={styles.dayOptsRow}>
                  <Chip
                    texto="Descanso"
                    icono={day.isRest ? 'bed' : 'bed-outline'}
                    activo={day.isRest}
                    compacto
                    onPress={() => patchDay(di, { isRest: !day.isRest })}
                  />
                  {schedule === 'cycle' && !day.isRest ? (
                    <View style={styles.intensityRow}>
                      <Text style={styles.intensityLabel}>Int. {day.intensity ?? 5}/10</Text>
                      <Pressable
                        onPress={() =>
                          patchDay(di, { intensity: Math.max(1, (day.intensity ?? 5) - 1) })
                        }
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={15} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          patchDay(di, { intensity: Math.min(10, (day.intensity ?? 5) + 1) })
                        }
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={15} color={colors.text} />
                      </Pressable>
                    </View>
                  ) : schedule === 'flex' && !day.isRest && day.gtg ? (
                    <Text style={styles.intensityLabel}>
                      Todo el día · {day.gtgSetsPerDay ?? SERIES_POR_DEFECTO} series
                    </Text>
                  ) : schedule === 'flex' && !day.isRest ? (
                    // En Sensaciones eliges rutina cada día: saber cuánto te va
                    // a pedir cada una es lo que hace que la elección signifique
                    // algo.
                    <View style={styles.intensityRow}>
                      <Text style={styles.intensityLabel}>
                        {day.intensityPct ? `${day.intensityPct} %` : 'Sin intensidad'}
                      </Text>
                      <Pressable
                        onPress={() =>
                          patchDay(di, { intensityPct: ajustaPct(day.intensityPct, -1) })
                        }
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="remove" size={15} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          patchDay(di, { intensityPct: ajustaPct(day.intensityPct, 1) })
                        }
                        style={styles.stepBtn}
                        hitSlop={6}
                      >
                        <Ionicons name="add" size={15} color={colors.text} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {schedule === 'weekly' ? (
                  <DiasSemana
                    valor={day.weekday}
                    onChange={(weekday) => patchDay(di, { weekday })}
                  />
                ) : null}

                {/* Sensaciones: esta rutina puede ser un día de grease the
                    groove. Es la opción para el día sin cuerpo para una
                    sesión: en vez de no hacer nada, series fáciles repartidas
                    por todo el día. */}
                {schedule === 'flex' && !day.isRest ? (
                  <View style={styles.gtgFila}>
                    <Chip
                      texto="Grease the groove"
                      icono={day.gtg ? 'repeat' : 'repeat-outline'}
                      activo={!!day.gtg}
                      compacto
                      onPress={() => patchDay(di, { gtg: !day.gtg })}
                    />
                    {day.gtg ? (
                      <TextField
                        keyboardType="number-pad"
                        placeholder={frase`${SERIES_POR_DEFECTO} series al día`}
                        value={day.gtgSetsPerDay ? String(day.gtgSetsPerDay) : ''}
                        onChangeText={(v) => {
                          const n = Number.parseInt(v, 10);
                          patchDay(di, {
                            gtgSetsPerDay: Number.isFinite(n) && n > 0 ? n : undefined,
                          });
                        }}
                        containerStyle={styles.gtgCampo}
                        style={{ marginBottom: 0 }}
                      />
                    ) : null}
                  </View>
                ) : null}

                {!day.isRest ? (
                  <>
                    {day.exercises.map((exx, ei) => (
                      <View
                        key={exx.id}
                        style={[styles.exBlock, exx.supersetWithPrevious && styles.exBlockLinked]}
                      >
                        {exx.supersetWithPrevious ? (
                          <View style={styles.supersetTag}>
                            <Ionicons name="link" size={12} color={colors.primaryBright} />
                            <Text style={styles.supersetTagText}>SUPERSERIE con el anterior</Text>
                          </View>
                        ) : null}
                        <View style={styles.exTopRow}>
                          <TextInput
                            value={exx.name}
                            onChangeText={(v) => patchEx(di, ei, { name: v })}
                            placeholder="Ejercicio (ej. Dominadas)"
                            placeholderTextColor={colors.textFaint}
                            style={styles.exName}
                          />
                          <Pressable
                            onPress={() =>
                              patchDay(di, { exercises: day.exercises.filter((_, j) => j !== ei) })
                            }
                            hitSlop={8}
                          >
                            <Ionicons name="close" size={18} color={colors.danger} />
                          </Pressable>
                        </View>

                        {/* Categoría del ejercicio. Aquí no hay biblioteca de
                            la que copiarla —el nombre se escribe a mano—, así
                            que sin este paso el mapa muscular, las series por
                            grupo y el reparto del informe se quedaban vacíos.

                            Se elige UNA vez, al añadir el ejercicio. Después se
                            recoge en una etiqueta junto al nombre: el plan es
                            largo y ocho botones por ejercicio lo convertían en
                            un muro. Tocando la etiqueta vuelven a salir. */}
                        {exx.muscleGroup && categoriaAbierta !== exx.id ? (
                          <Pressable
                            onPress={() => setCategoriaAbierta(exx.id)}
                            style={styles.catTag}
                            hitSlop={6}
                          >
                            <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
                            <Text style={styles.catTagText}>{exx.muscleGroup}</Text>
                          </Pressable>
                        ) : (
                          <>
                            <Text style={styles.fieldLabel}>Categoría</Text>
                            <Opciones
                              opciones={MUSCLE_GROUPS.map((g) => ({ valor: g, texto: g }))}
                              valor={exx.muscleGroup}
                              desmarcable
                              envuelve
                              onChange={(g) => {
                                patchEx(di, ei, { muscleGroup: g });
                                setCategoriaAbierta(g ? null : exx.id);
                              }}
                            />
                          </>
                        )}

                        <Opciones
                          opciones={LOAD_TYPES.map((l) => ({ valor: l, texto: LOAD_LABEL[l] }))}
                          valor={resolveLoad(exx)}
                          onChange={(v) =>
                            patchEx(di, ei, { load: v, band: v === 'assisted' })
                          }
                        />

                        {/* Agarre de ESTE ejercicio en ESTE día. Volver a
                            tocarlo lo deja sin especificar. */}
                        <Opciones
                          opciones={GRIP_TYPES.map((g) => ({ valor: g, texto: GRIP_LABEL[g] }))}
                          valor={exx.grip}
                          desmarcable
                          onChange={(grip) => patchEx(di, ei, { grip })}
                        />

                        <View style={styles.exFields}>
                          <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Series</Text>
                            <TextInput
                              value={String(exx.sets)}
                              onChangeText={(v) => patchEx(di, ei, { sets: Math.max(1, parseInt(v, 10) || 1) })}
                              keyboardType="number-pad"
                              style={styles.fieldInput}
                            />
                          </View>
                          <View style={styles.field}>
                            <Text style={styles.fieldLabel}>
                              {exx.measure === 'seconds' ? 'Segundos' : 'Reps'}
                            </Text>
                            <TextInput
                              value={exx.reps}
                              onChangeText={(v) => patchEx(di, ei, { reps: v })}
                              placeholder={isHoldMeasure(exx.measure) ? '30' : '8-12'}
                              placeholderTextColor={colors.textFaint}
                              style={styles.fieldInput}
                            />
                          </View>
                          {exx.measure === 'combo' ? (
                            <View style={styles.field}>
                              <Text style={styles.fieldLabel}>Aguante (s)</Text>
                              <TextInput
                                value={exx.seconds ?? ''}
                                onChangeText={(v) => patchEx(di, ei, { seconds: v })}
                                placeholder="12"
                                keyboardType="number-pad"
                                placeholderTextColor={colors.textFaint}
                                style={styles.fieldInput}
                              />
                            </View>
                          ) : isDualMeasure(exx.measure) ? (
                            <View style={styles.field}>
                              <Text style={styles.fieldLabel}>
                                {isHoldMeasure(exx.measure) ? 'Der. (s)' : 'Der.'}
                              </Text>
                              <TextInput
                                value={exx.side2 ?? ''}
                                onChangeText={(v) => patchEx(di, ei, { side2: v })}
                                placeholder={isHoldMeasure(exx.measure) ? '30' : '8-12'}
                                placeholderTextColor={colors.textFaint}
                                style={styles.fieldInput}
                              />
                            </View>
                          ) : null}
                          <View style={styles.field}>
                            <Text style={styles.fieldLabel}>RIR</Text>
                            <TextInput
                              value={exx.rir !== undefined ? String(exx.rir) : ''}
                              onChangeText={(v) =>
                                patchEx(di, ei, { rir: v === '' ? undefined : Number(v) || 0 })
                              }
                              keyboardType="number-pad"
                              placeholder="2"
                              placeholderTextColor={colors.textFaint}
                              style={styles.fieldInput}
                            />
                          </View>
                          <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Descanso</Text>
                            <TextInput
                              value={restText[exx.id] ?? minutosSegundos(exx.restSeconds)}
                              onChangeText={(v) => {
                                setRestText((p) => ({ ...p, [exx.id]: v }));
                                patchEx(di, ei, { restSeconds: segundosDeTexto(v) });
                              }}
                              placeholder="1:30"
                              placeholderTextColor={colors.textFaint}
                              style={styles.fieldInput}
                            />
                          </View>
                        </View>

                        {/* Clúster: la serie en bloques con una pausa mínima.
                            Sus números solo salen cuando está activado. */}
                        {exx.cluster ? (
                          <View style={styles.exFields}>
                            <View style={styles.field}>
                              <Text style={styles.fieldLabel}>Bloques</Text>
                              <TextInput
                                value={String(clusterBlocks(exx.cluster))}
                                onChangeText={(v) =>
                                  patchEx(di, ei, {
                                    cluster: {
                                      ...CLUSTER_DEFAULT,
                                      ...exx.cluster,
                                      blocks: parseInt(v, 10) || 2,
                                    },
                                  })
                                }
                                keyboardType="number-pad"
                                placeholder="3"
                                placeholderTextColor={colors.textFaint}
                                style={styles.fieldInput}
                              />
                            </View>
                            <View style={styles.field}>
                              <Text style={styles.fieldLabel}>Pausa (s)</Text>
                              <TextInput
                                value={String(exx.cluster.restSeconds)}
                                onChangeText={(v) =>
                                  patchEx(di, ei, {
                                    cluster: {
                                      ...CLUSTER_DEFAULT,
                                      ...exx.cluster,
                                      restSeconds: Math.max(
                                        0,
                                        Math.min(120, parseInt(v, 10) || 0)
                                      ),
                                    },
                                  })
                                }
                                keyboardType="number-pad"
                                placeholder="15"
                                placeholderTextColor={colors.textFaint}
                                style={styles.fieldInput}
                              />
                            </View>
                          </View>
                        ) : null}

                        <View style={styles.exLinks}>
                          <Pressable
                            onPress={() => {
                              // Rota por todas las medidas en orden, volviendo
                              // al principio: reps → segundos → combo → por
                              // lados → aguante por lados → reps.
                              const actual = exx.measure ?? 'reps';
                              const i = EXERCISE_MEASURES.indexOf(actual);
                              const siguiente =
                                EXERCISE_MEASURES[(i + 1) % EXERCISE_MEASURES.length];
                              patchEx(di, ei, { measure: siguiente });
                            }}
                            style={styles.linkBtn}
                          >
                            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                            <Text style={styles.linkBtnText}>
                              {MEASURE_SHORT[exx.measure ?? 'reps']}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              patchEx(di, ei, {
                                cluster: exx.cluster ? undefined : { ...CLUSTER_DEFAULT },
                              })
                            }
                            style={styles.linkBtn}
                          >
                            <Ionicons
                              name={exx.cluster ? 'layers' : 'layers-outline'}
                              size={14}
                              color={colors.primary}
                            />
                            <Text style={styles.linkBtnText}>
                              {exx.cluster
                                ? `Clúster ${clusterBlocks(exx.cluster)}×${exx.cluster.restSeconds}s`
                                : 'Clúster'}
                            </Text>
                          </Pressable>
                          {ei > 0 ? (
                            <Pressable
                              onPress={() =>
                                patchEx(di, ei, { supersetWithPrevious: !exx.supersetWithPrevious })
                              }
                              style={styles.linkBtn}
                            >
                              <Ionicons
                                name={exx.supersetWithPrevious ? 'unlink' : 'link'}
                                size={14}
                                color={colors.primary}
                              />
                              <Text style={styles.linkBtnText}>
                                {exx.supersetWithPrevious ? 'Quitar superserie' : 'Superserie'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>

                        <TextInput
                          value={exx.notes ?? ''}
                          onChangeText={(v) => patchEx(di, ei, { notes: v })}
                          placeholder="Notas: tempo, agarre, técnica..."
                          placeholderTextColor={colors.textFaint}
                          style={styles.notesInput}
                        />
                      </View>
                    ))}
                    <Pressable
                      style={styles.addEx}
                      onPress={() => patchDay(di, { exercises: [...day.exercises, newExercise()] })}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={styles.addExText}>Añadir ejercicio</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        );
        }}
      />

      <Button
        title="Añadir día"
        variant="secondary"
        onPress={() =>
          setDays((p) => {
            const nd = newDay(p.length + 1);
            setExpanded((e) => ({ ...e, [nd.id]: true }));
            return [...p, nd];
          })
        }
        style={{ marginTop: spacing.sm }}
      />
      <Button
        title={saving ? 'Guardando...' : routineId ? 'Guardar cambios' : 'Crear mi plan'}
        onPress={handleSave}
        loading={saving}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title="Ir a entrenar"
        variant="ghost"
        onPress={() => router.push('/(client)/workout')}
        style={{ marginTop: spacing.sm }}
      />
      <View style={{ height: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  starterCard: { marginBottom: spacing.md },
  starterTitle: { ...typography.h3, color: colors.text },
  starterHint: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  starterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  starterChipText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  scheduleCard: { marginBottom: spacing.md },
  scheduleTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  scheduleHint: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  cycleResetBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, alignSelf: 'flex-start' },
  cycleResetText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  dayCardDragging: { borderColor: colors.hairline },
  dayCard: { marginBottom: spacing.md },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayHeadMain: { flex: 1, paddingVertical: spacing.xs },
  dayTitle: { ...typography.h3, color: colors.text },
  daySummary: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  dayOptsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gtgFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gtgCampo: { flex: 1, marginBottom: 0 },
  intensityLabel: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  exBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: spacing.xs },
  exBlockLinked: { borderLeftWidth: 2, borderLeftColor: colors.hairline, paddingLeft: spacing.sm },
  supersetTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  supersetTagText: { fontSize: 10, fontFamily: fonts.semiBold, letterSpacing: 1, color: colors.primaryBright },
  exTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exName: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    backgroundColor: colors.primaryMuted,
  },
  catTagText: { ...typography.small, color: colors.primary, fontSize: 12, fontFamily: fonts.semiBold },
  exFields: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: 2 },
  fieldLabel: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  fieldInput: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
  },
  exLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  linkBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  notesInput: {
    ...typography.small,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginTop: spacing.xs,
  },
  addEx: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
  addExText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
