import { diaMes, inicioDelDia } from '../../../../lib/fechas';
import { t, frase  } from '../../../../lib/idioma';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import {
  ajustaPct,
  esfuerzoDePct,
  proporcionIntensidad,
} from '../../../../lib/intensidad';
import { Sheet } from '../../../../components/Sheet';
import { Chip, ChipRow } from '../../../../components/Chip';
import { DiasSemana } from '../../../../components/DiasSemana';
import { Opciones } from '../../../../components/Opciones';
import { Segmented } from '../../../../components/Segmented';
import { RutinaDiariaEditor } from '../../../../components/RutinaDiariaEditor';
import { TextField } from '../../../../components/TextField';
import { DragList } from '../../../../components/DragList';
import { moveItem } from '../../../../lib/useDragReorder';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import { createExercise, getExerciseLibrary } from '../../../../lib/firestore/exercises';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../../../lib/firestore/routines';
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  getRoutineTemplatesForTrainer,
} from '../../../../lib/firestore/routineTemplates';
import { getClientsForTrainer, getUserProfile } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { flexLabel, nombreDelDia } from '../../../../lib/schedule';
import { SERIES_POR_DEFECTO } from '../../../../lib/gtg';
import {
  MAX_NIVELES,
  NIVELES_POR_DEFECTO,
  nivelesDeTexto,
  POR_DEFECTO,
  type CuandoElEsfuerzo,
  type EscalaDeEsfuerzo,
  type PlanPersonalizado,
} from '../../../../lib/planPersonalizado';
import { generateRoutineDraft } from '../../../../lib/routineGenerator';
import { minutosSegundos, segundosDeTexto } from '../../../../lib/duracion';
import { nuevoId } from '../../../../lib/ids';
import { medidaDelGrupo } from '../../../../lib/medidaDeGrupo';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../../lib/theme';
import {
  CLUSTER_DEFAULT,
  clusterBlocks,
  type ClusterConfig,
  type Exercise,
  type ExerciseLoad,
  type ExerciseMeasure,
  GRIP_LABEL,
  GRIP_TYPES,
  type GripType,
  isDualMeasure,
  isHoldMeasure,
  LOAD_LABEL,
  LOAD_TYPES,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  type MuscleGroup,
  resolveLoad,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
  type RoutineTemplate,
  type UserProfile,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from '../../../../lib/types';

/** Variantes de carga elegibles al montar la rutina (por ejercicio del plan). */
export default function RoutineEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Rutina personalizada');
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [otherClients, setOtherClients] = useState<UserProfile[]>([]);
  const [copying, setCopying] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  // Filtros del selector de ejercicios: por categoría y, dentro de ella, por
  // subgrupo. Se guardan aquí y no en el modal para que al añadir varios
  // ejercicios del mismo bloque no haya que volver a elegir cada vez.
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [filtroSubgrupo, setFiltroSubgrupo] = useState<string | null>(null);
  // Crear un ejercicio nuevo sin salir del selector (agiliza montar la rutina).
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  // La categoría del ejercicio nuevo es texto libre porque el entrenador puede
  // tener las suyas propias, no solo las de fábrica.
  const [newGroup, setNewGroup] = useState<string>('Empuje');
  const [newSubgroup, setNewSubgroup] = useState('');
  const [newMeasure, setNewMeasure] = useState<ExerciseMeasure>('reps');
  // La medida que impone el grupo elegido, si ese grupo ya la tiene decidida.
  const medidaDelNuevoGrupo = medidaDelGrupo(profile?.subgroupMeasures, newGroup, newSubgroup);
  const [newLoad, setNewLoad] = useState<ExerciseLoad>('none');
  const [newVideo, setNewVideo] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
  const [scheduleLabel, setScheduleLabel] = useState('Personalizado');
  /*
   * Cómo funciona por dentro el plan personalizado.
   *
   * Se guarda entero en la rutina (ver lib/planPersonalizado.ts): la escala con
   * la que se mide el esfuerzo, cuándo se pregunta, qué ve el alumno antes de
   * elegir, cómo se llaman las cosas y qué puede tocar.
   */
  const [perso, setPerso] = useState<PlanPersonalizado>(POR_DEFECTO);
  // Las etiquetas de la escala propia se teclean seguidas, separadas por comas.
  const [nivelesTexto, setNivelesTexto] = useState(NIVELES_POR_DEFECTO.join(', '));
  const [personalizacionAbierta, setPersonalizacionAbierta] = useState(false);
  /** Cambia una parte de la configuración sin pisar el resto. */
  const cambiaPerso = (parte: Partial<PlanPersonalizado>) =>
    setPerso((prev) => ({ ...prev, ...parte }));
  const [cycleStartDate, setCycleStartDate] = useState<number>(() => inicioDelDia(Date.now()));
  /*
   * La fecha con la que se abrió la rutina, para saber si el coach la ha
   * CAMBIADO de verdad.
   *
   * Importa porque el alumno puede reiniciar su ciclo o fijar qué día es hoy, y
   * lo que decida el último manda. Si cada vez que el coach guarda la rutina
   * —para corregir una serie, por ejemplo— se anotara que acaba de reprogramar
   * el ciclo, le estaría robando al alumno su día sin querer y sin enterarse.
   */
  const fechaAlAbrir = useRef<number | null>(null);
  /**
   * La configuración tal y como se guarda.
   *
   * Las etiquetas de la escala propia se tecleaban en un campo de texto; aquí
   * se convierten en lista. Y solo se guardan SI la escala es la propia: unas
   * etiquetas colgando de un plan que mide en RIR son un ajuste invisible que
   * reaparece el día que alguien cambie de escala y no entiende de dónde sale.
   */
  const configuracionAGuardar = (): PlanPersonalizado => ({
    ...perso,
    esfuerzo: {
      escala: perso.esfuerzo?.escala ?? 'rir',
      cuando: perso.esfuerzo?.cuando ?? 'ejercicio',
      ...(perso.esfuerzo?.escala === 'propia'
        ? { niveles: nivelesDeTexto(nivelesTexto) }
        : {}),
    },
  });

  const [restText, setRestText] = useState<Record<string, string>>({});
  // Ejercicio pendiente de mover/copiar a otro día (abre el selector de día).
  const [movePicker, setMovePicker] = useState<{ dayId: string; ex: RoutineExercise } | null>(
    null
  );
  // Ejercicios con el recuadro de objetivo abierto (además de los que ya lo tienen).
  const [goalOpen, setGoalOpen] = useState<Record<string, boolean>>({});
  // Qué días están desplegados en el editor. Todos cerrados al entrar: con la
  // lista compacta se ve el plan completo de un vistazo y se abre solo el día
  // que se va a tocar.
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpanded = (dayId: string) => {
    setExpandedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  // Nivel del alumno (para el borrador automático del copiloto).
  const [clientLevel, setClientLevel] = useState<
    import('../../../../lib/types').ExperienceLevel | undefined
  >(undefined);

  useEffect(() => {
    if (!clientId || !profile) return;
    (async () => {
      const [existing, library, clientProfile] = await Promise.all([
        getActiveRoutineForClient(clientId, profile.uid),
        getExerciseLibrary(profile.uid),
        getUserProfile(clientId).catch(() => null),
      ]);
      setExercises(library);
      setClientLevel(clientProfile?.level);
      if (existing) {
        setRoutineId(existing.id);
        setName(existing.name);
        setDays(existing.days);
        /*
         * UN PLAN VIEJO DE GREASE THE GROOVE SE ABRE COMO PERSONALIZADO.
         *
         * Ese modo ya no se puede elegir (ver RoutineSchedule en lib/types.ts).
         * Mantener su editor entero vivo para algo que nadie puede crear es
         * pantalla muerta que hay que seguir arreglando; y dejar el plan a
         * medias, con un modo que la app no sabe editar, es peor.
         *
         * Así que se lee como lo que de verdad es: un plan personalizado cuya
         * primera rutina se hace en grease the groove, con sus series al día
         * intactas. Nada se pierde y no queda ningún camino sin salida.
         */
        const modo = existing.schedule ?? 'weekly';
        setSchedule(modo === 'gtg' ? 'flex' : modo);
        if (modo === 'gtg') {
          setDays((prev) =>
            prev.map((d, i) =>
              i === 0
                ? { ...d, gtg: true, gtgSetsPerDay: d.gtgSetsPerDay ?? existing.gtgSetsPerDay }
                : d
            )
          );
        }
        if (existing.scheduleLabel) setScheduleLabel(flexLabel(existing.scheduleLabel));
        if (existing.cycleStartDate) setCycleStartDate(existing.cycleStartDate);
        fechaAlAbrir.current = existing.cycleStartDate ?? null;
        if (existing.personalizado) {
          setPerso({ ...POR_DEFECTO, ...existing.personalizado });
          const niveles = existing.personalizado.esfuerzo?.niveles;
          if (niveles?.length) setNivelesTexto(niveles.join(', '));
        }
      } else {
        setDays([{ id: nuevoId(), name: 'Día 1', exercises: [] }]);
      }
      setLoading(false);
    })();
  }, [clientId, profile]);

  // Copiloto: genera un borrador de rutina desde la biblioteca según el nivel
  // del alumno. Pide confirmación si hay días con contenido (los reemplaza).
  const handleGenerateDraft = async () => {
    if (exercises.length === 0) {
      showToast('Tu biblioteca está vacía: añade o importa ejercicios primero');
      return;
    }
    const hasContent = days.some((d) => d.exercises.length > 0);
    if (hasContent) {
      const ok =
        Platform.OS === 'web'
          ? // eslint-disable-next-line no-alert
            window.confirm('El borrador reemplazará los días actuales. ¿Continuar?')
          : await new Promise<boolean>((resolve) => {
              Alert.alert('Borrador automático', 'Reemplazará los días actuales. ¿Continuar?', [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Generar', onPress: () => resolve(true) },
              ]);
            });
      if (!ok) return;
    }
    const draft = generateRoutineDraft({ library: exercises, level: clientLevel, schedule });
    setDays(draft);
    setExpandedDays(draft.length > 0 ? { [draft[0].id]: true } : {});
    showToast(
      frase`Borrador generado (nivel ${t(clientLevel ?? 'Intermedio')}) · revísalo y ajusta`
    );
  };

  const addDay = () => {
    const id = nuevoId();
    setDays((prev) => [...prev, { id, name: `Día ${prev.length + 1}`, exercises: [] }]);
    setExpandedDays((prev) => ({ ...prev, [id]: true })); // el día nuevo se abre
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  // Mueve un día una posición arriba o abajo (reordenar la semana / el ciclo).

  // Duplica un día (con ids nuevos) justo debajo, para no rehacerlo.
  const duplicateDay = (dayId: string) => {
    const newId = nuevoId();
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.id === dayId);
      if (idx < 0) return prev;
      const src = prev[idx];
      const clone: RoutineDay = {
        ...src,
        id: newId,
        name: `${src.name} (copia)`,
        exercises: src.exercises.map((e) => ({ ...e, id: nuevoId() })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setExpandedDays((p) => ({ ...p, [newId]: true }));
    showToast('Día duplicado');
  };

  const updateDayName = (dayId: string, value: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: value } : d)));
  };

  // Marca/desmarca un día del ciclo como descanso (Método REIN TENA).
  const toggleRestDay = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, isRest: !d.isRest, optionalRest: !d.isRest ? d.optionalRest : false }
          : d
      )
    );
  };

  // Marca un descanso como OPCIONAL (Día 7 TENA): implica que sea descanso.
  const toggleOptionalRest = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? d.optionalRest
            ? { ...d, optionalRest: false }
            : { ...d, optionalRest: true, isRest: true }
          : d
      )
    );
  };

  // Asigna o quita el día de la semana (tocar el mismo chip lo desasigna).
  /*
   * Días que comparten el mismo día de la semana.
   *
   * Nada lo impide, y a veces se hace a propósito —dos sesiones el mismo día—,
   * pero la app solo puede PROPONER una: la primera. La otra existe, se ve en la
   * tira de días y se puede entrenar, pero nunca sale como "lo de hoy" ni en los
   * avisos. Sin decirlo, el entrenador cree que ha programado dos y el alumno
   * solo ve una, y ninguno de los dos tiene forma de enterarse.
   */
  const diasRepetidos = (() => {
    const cuenta = new Map<number, number>();
    for (const d of days) {
      if (d.weekday === undefined) continue;
      cuenta.set(d.weekday, (cuenta.get(d.weekday) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([w]) => w));
  })();

  const updateDayWeekday = (dayId: string, weekday: number | undefined) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, weekday } : d)));
  };

  /**
   * Categorías del selector: las del entrenador si las ha personalizado y, si
   * no, las de fábrica. Se añaden además las que aparezcan en ejercicios
   * importados con el pack, para que ninguno quede fuera de todos los filtros.
   */
  const categoriasBiblioteca = React.useMemo(() => {
    const base = profile?.exerciseCategories?.length ? profile.exerciseCategories : [...MUSCLE_GROUPS];
    const enUso = [...new Set(exercises.map((e) => e.muscleGroup).filter(Boolean))];
    return [...base, ...enUso.filter((g) => !base.includes(g))];
  }, [profile?.exerciseCategories, exercises]);

  /** Subgrupos de la categoría filtrada que de verdad tienen ejercicios. */
  const subgruposVisibles = React.useMemo(() => {
    if (filtroCategoria === 'Todos') return [];
    const declarados = profile?.categorySubgroups?.[filtroCategoria] ?? [];
    const enUso = [
      ...new Set(
        exercises
          .filter((e) => e.muscleGroup === filtroCategoria && e.subgroup)
          .map((e) => e.subgroup as string)
      ),
    ];
    const todos = [...declarados, ...enUso.filter((s) => !declarados.includes(s))];
    return todos;
  }, [filtroCategoria, profile?.categorySubgroups, exercises]);

  const ejerciciosFiltrados = React.useMemo(() => {
    const busca = exerciseSearch.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(busca) &&
        (filtroCategoria === 'Todos' || ex.muscleGroup === filtroCategoria) &&
        (!filtroSubgrupo || ex.subgroup === filtroSubgrupo)
    );
  }, [exercises, exerciseSearch, filtroCategoria, filtroSubgrupo]);

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const routineExercise: RoutineExercise = {
      id: nuevoId(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: exercise.measure === 'seconds' ? '30' : '10',
      measure: exercise.measure ?? 'reps',
      // La categoría y el subgrupo viajan con el plan: se enseñan durante el
      // entrenamiento junto al nombre —para no confundir dos ejercicios que se
      // llaman parecido— y sostienen el reparto por grupos aunque el ejercicio
      // se renombre o se borre de la biblioteca.
      muscleGroup: exercise.muscleGroup,
      subgroup: exercise.subgroup,
      load: resolveLoad(exercise),
      band: exercise.band ?? false,
    };
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, routineExercise] } : d
      )
    );
    showToast(`${exercise.name} añadido`);
  };

  // Crea el ejercicio en la biblioteca del coach y lo añade al día de una vez.
  const handleCreateAndAdd = async () => {
    if (!profile || !pickerForDay || !newName.trim()) return;
    const dayId = pickerForDay;
    setSavingNew(true);
    try {
      const data = {
        trainerId: profile.uid,
        name: newName.trim(),
        muscleGroup: newGroup,
        subgroup: newSubgroup.trim() || undefined,
        // Si el grupo ya decidió cómo se mide, manda él: es justo para lo que
        // está, para no tener que acordarse ejercicio a ejercicio.
        measure: medidaDelNuevoGrupo ?? newMeasure,
        load: newLoad,
        videoUrl: newVideo.trim() || undefined,
      };
      const id = await createExercise(data);
      const ex: Exercise = { id, createdAt: Date.now(), ...data };
      setExercises((prev) => [...prev, ex]);
      addExerciseToDay(dayId, ex);
      setCreatingNew(false);
      setNewName('');
      setNewSubgroup('');
      setNewMeasure('reps');
      setNewLoad('none');
      setNewVideo('');
      setExerciseSearch('');
      setPickerForDay(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo crear el ejercicio');
    } finally {
      setSavingNew(false);
    }
  };

  const removeExercise = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseRowId) }
          : d
      )
    );
  };

  const updateExerciseField = (
    dayId: string,
    exerciseRowId: string,
    field: 'sets' | 'reps' | 'seconds' | 'side2' | 'restSeconds' | 'notes' | 'rir' | 'goal',
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? {
                      ...e,
                      [field]:
                        field === 'sets' || field === 'restSeconds' || field === 'rir'
                          ? Number(value) || 0
                          : value,
                    }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Ajusta la intensidad (1-10) de un día del ciclo (Método REIN TENA).
  const updateDayIntensity = (dayId: string, delta: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, intensity: Math.max(1, Math.min(10, (d.intensity ?? 5) + delta)) }
          : d
      )
    );
  };

  // Ajusta el porcentaje de intensidad de una rutina de Sensaciones.
  const updateDayPct = (dayId: string, delta: number) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, intensityPct: ajustaPct(d.intensityPct, delta) } : d))
    );
  };

  /**
   * Sensaciones: marca esta rutina como grease the groove.
   *
   * Es la opción para el día que el alumno no tiene cuerpo para una sesión:
   * en vez de no hacer nada, seis series fáciles repartidas. Y va por rutina y
   * no por plan entero porque en Sensaciones conviven varias formas de
   * entrenar y el alumno elige una cada mañana.
   */
  const toggleGtgDay = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, gtg: !d.gtg, isRest: false } : d))
    );
  };

  const updateDayGtgSets = (dayId: string, valor: string) => {
    const n = Number.parseInt(valor, 10);
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, gtgSetsPerDay: Number.isFinite(n) && n > 0 ? n : undefined }
          : d
      )
    );
  };

  const toggleIntervalTimer = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, showIntervalTimer: !d.showIntervalTimer } : d))
    );
  };

  const updateApproaches = (dayId: string, value: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, approachesNote: value } : d)));
  };

  // Descanso en formato mm:ss; se guarda en segundos.
  const updateRestSeconds = (dayId: string, exerciseRowId: string, seconds: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, restSeconds: seconds } : e
              ),
            }
          : d
      )
    );
  };

  // Fija la variante de carga de un ejercicio DENTRO de la rutina (normal /
  // lastrado / con goma), sin depender de la ficha del ejercicio.
  const setExerciseLoad = (dayId: string, exerciseRowId: string, load: ExerciseLoad) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, load, band: load === 'assisted' } : e
              ),
            }
          : d
      )
    );
  };

  // Fija el agarre de un ejercicio DENTRO de la rutina. Va aquí y no en la
  // ficha del ejercicio porque las mismas dominadas son prono un día y supinas
  // otro: es cosa del plan, no del ejercicio. Volver a tocar el agarre activo
  // lo quita, para poder dejarlo sin especificar.
  const setExerciseGrip = (dayId: string, exerciseRowId: string, grip: GripType) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, grip: e.grip === grip ? undefined : grip } : e
              ),
            }
          : d
      )
    );
  };

  /**
   * Series en clúster: activarlas, apagarlas o cambiar sus números.
   *
   * No es lo mismo que el EMOM del día: allí el reloj manda sobre toda la
   * sesión y aquí se parte UNA serie en bloques con una pausa mínima, ejercicio
   * a ejercicio. Por eso se configura en el ejercicio y no en el día.
   */
  const setExerciseCluster = (
    dayId: string,
    exerciseRowId: string,
    patch: Partial<ClusterConfig> | null
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) => {
                if (e.id !== exerciseRowId) return e;
                if (patch === null) {
                  const { cluster: _fuera, ...resto } = e;
                  return resto;
                }
                return { ...e, cluster: { ...CLUSTER_DEFAULT, ...e.cluster, ...patch } };
              }),
            }
          : d
      )
    );
  };

  // Encadena o desencadena un ejercicio en superserie con el anterior.
  const toggleSuperset = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? { ...e, supersetWithPrevious: !e.supersetWithPrevious }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Mueve o copia un ejercicio a OTRO día sin tener que volver a montarlo
  // (mantiene series, reps, RIR, descanso, carga y notas).
  const moveOrCopyExercise = (targetDayId: string, keepOriginal: boolean) => {
    if (!movePicker) return;
    const { dayId, ex } = movePicker;
    setDays((prev) =>
      prev.map((d) => {
        let exercises = d.exercises;
        // Quitar del día de origen (solo al MOVER).
        if (!keepOriginal && d.id === dayId) {
          exercises = exercises.filter((e) => e.id !== ex.id);
        }
        // Añadir al final del día de destino (id nuevo, sin superserie heredada).
        if (d.id === targetDayId) {
          exercises = [...exercises, { ...ex, id: nuevoId(), supersetWithPrevious: false }];
        }
        return exercises === d.exercises ? d : { ...d, exercises };
      })
    );
    // Deja el día de destino desplegado para verlo al instante.
    setExpandedDays((p) => ({ ...p, [targetDayId]: true }));
    setMovePicker(null);
    showToast(keepOriginal ? 'Ejercicio copiado' : 'Ejercicio movido');
  };

  // Mueve un ejercicio una posición arriba o abajo dentro de su día.
  const reordenarEjercicios = (dayId: string, from: number, to: number) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, exercises: moveItem(d.exercises, from, to) } : d))
    );
  };


  // Abre el selector de "copiar rutina de otro alumno".
  const openCopyPicker = async () => {
    if (!profile) return;
    setCopyPickerOpen(true);
    if (otherClients.length === 0) {
      const clients = await getClientsForTrainer(profile.uid);
      setOtherClients(clients.filter((c) => c.uid !== clientId));
    }
  };

  // Copia nombre y días (con ids nuevos) de la rutina activa de otro alumno.
  const copyFromClient = async (otherId: string) => {
    setCopying(true);
    try {
      const source = await getActiveRoutineForClient(otherId, profile?.uid);
      if (source) {
        setName(`${source.name}`);
        setDays(
          source.days.map((d) => ({
            ...d,
            id: nuevoId(),
            exercises: d.exercises.map((e) => ({ ...e, id: nuevoId() })),
          }))
        );
      }
      setCopyPickerOpen(false);
    } finally {
      setCopying(false);
    }
  };

  // Abre el panel de plantillas y las carga.
  const openTemplates = async () => {
    if (!profile) return;
    setTemplatesOpen(true);
    setTemplates(await getRoutineTemplatesForTrainer(profile.uid));
  };

  // Aplica una plantilla a la rutina actual (días con ids nuevos).
  const applyTemplate = (t: RoutineTemplate) => {
    setName(t.name);
    setSchedule(t.schedule ?? 'weekly');
    if (t.scheduleLabel) setScheduleLabel(flexLabel(t.scheduleLabel));
    if (t.personalizado) {
      setPerso({ ...POR_DEFECTO, ...t.personalizado });
      const niveles = t.personalizado.esfuerzo?.niveles;
      if (niveles?.length) setNivelesTexto(niveles.join(', '));
    }
    /*
     * La fecha de inicio del ciclo NO viene de la plantilla.
     *
     * Una plantilla es una estructura —los días y sus ejercicios—, no un
     * calendario. Aplicando una guardada en marzo, el ciclo arrancaba en marzo:
     * el alumno estrenaba plan y le tocaba un día cualquiera de la rueda, sin
     * que nada en la pantalla explicara por qué. Se queda la fecha que hay
     * puesta, que por defecto es hoy.
     */
    setDays(
      t.days.map((d) => ({
        ...d,
        id: nuevoId(),
        exercises: d.exercises.map((e) => ({ ...e, id: nuevoId() })),
      }))
    );
    setTemplatesOpen(false);
    showToast('Plantilla aplicada');
  };

  // Guarda la rutina que se está editando como plantilla reutilizable.
  const saveAsTemplate = async () => {
    if (!profile) return;
    if (days.length === 0) {
      showToast('Añade al menos un día antes de guardar la plantilla');
      return;
    }
    setSavingTemplate(true);
    try {
      await createRoutineTemplate({
        trainerId: profile.uid,
        name: name.trim() || 'Plantilla',
        schedule,
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
        personalizado: schedule === 'flex' ? configuracionAGuardar() : undefined,
        days,
      });
      setTemplates(await getRoutineTemplatesForTrainer(profile.uid));
      showToast('Guardada como plantilla');
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteRoutineTemplate(id);
  };

  const handleSave = useCallback(async () => {
    if (!profile || !clientId) return;
    setSaving(true);
    try {
      // Solo se anota "el coach ha reprogramado el ciclo" si la fecha CAMBIA.
      const cambioLaFecha = schedule === 'cycle' && cycleStartDate !== fechaAlAbrir.current;
      const scheduleFields = {
        schedule,
        cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
        cycleStartDateSetAt: cambioLaFecha ? Date.now() : undefined,
        scheduleLabel: schedule === 'flex' ? flexLabel(scheduleLabel) : undefined,
        // Solo el plan personalizado la lleva: en los otros dos no significa
        // nada, y guardarla ahí sería dejar escrito un ajuste que no se aplica.
        personalizado: schedule === 'flex' ? configuracionAGuardar() : undefined,
      };
      if (cambioLaFecha) fechaAlAbrir.current = cycleStartDate;
      if (routineId) {
        await updateRoutine(routineId, { name, days, ...scheduleFields });
        await setActiveRoutine(clientId, routineId, profile.uid);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days,
          active: true,
          ...scheduleFields,
        });
        await setActiveRoutine(clientId, newId, profile.uid);
      }
      notifyUser(
        clientId,
        routineId ? 'Rutina actualizada' : 'Nueva rutina asignada',
        frase`Tu entrenador ha actualizado tu plan: ${name}`
      );
      showToast('Rutina guardada');
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la rutina.');
    } finally {
      setSaving(false);
    }
  }, [profile, clientId, routineId, name, days, schedule, scheduleLabel, cycleStartDate, router]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField label="Nombre de la rutina" value={name} onChangeText={setName} />

      {copyPickerOpen ? (
        <Card style={styles.copyCard}>
          <Text style={styles.copyTitle}>Copiar la rutina activa de...</Text>
          {otherClients.length === 0 ? (
            <Text style={styles.mutedText}>Cargando alumnos...</Text>
          ) : (
            otherClients.map((c) => (
              <Pressable
                key={c.uid}
                onPress={() => copyFromClient(c.uid)}
                style={styles.pickerRow}
                disabled={copying}
              >
                <Text style={styles.pickerRowText}>{c.name}</Text>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
              </Pressable>
            ))
          )}
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setCopyPickerOpen(false)}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : templatesOpen ? (
        <Card style={styles.copyCard}>
          <Text style={styles.copyTitle}>Plantillas de rutina</Text>
          {templates.length === 0 ? (
            <Text style={styles.mutedText}>
              Aún no tienes plantillas. Guarda esta rutina para reutilizarla con
              otros alumnos.
            </Text>
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.templateRow}>
                <Pressable style={{ flex: 1 }} onPress={() => applyTemplate(t)}>
                  <Text style={styles.pickerRowText}>{t.name}</Text>
                  <Text style={styles.mutedText}>
                    {t.days.length} {t.days.length === 1 ? 'día' : 'días'} · toca para
                    aplicar
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeTemplate(t.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
          <Button
            title="Guardar rutina actual como plantilla"
            onPress={saveAsTemplate}
            loading={savingTemplate}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            title="Cerrar"
            variant="ghost"
            onPress={() => setTemplatesOpen(false)}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : (
        <View style={styles.actionsRow}>
          <Button
            title="Borrador"
            variant="secondary"
            compacto
            onPress={handleGenerateDraft}
            style={styles.accionAncha}
          />
          <Button
            title="Plantillas"
            variant="secondary"
            compacto
            onPress={openTemplates}
            style={styles.accionAncha}
          />
          <Button
            title="Copiar"
            variant="secondary"
            compacto
            onPress={openCopyPicker}
            style={styles.accionAncha}
          />
        </View>
      )}

      {/* Lo que hará TODOS los días aparte del plan. Va aquí, pegado a la
          programación, porque es cuando se está decidiendo qué entrena y
          cuándo: es el momento en que uno se acuerda del pino y la movilidad. */}
      {clientId && profile ? (
        <RutinaDiariaEditor trainerId={profile.uid} clientId={clientId} />
      ) : null}

      <Card accent style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>Programación</Text>
        <Segmented
          compacto
          valor={schedule}
          /*
            TRES MODOS, NO CUATRO.
            
            "Grease the groove" estaba aquí como un cuarto plan entero, y no le
            pegaba: es una forma de entrenar UN día —series sueltas repartidas,
            ninguna al fallo—, no una programación. Sigue existiendo en los dos
            sitios donde significa algo: marcando un día suelto dentro del plan
            personalizado, y en la rutina diaria de cada alumno.
          */
          opciones={[
            { valor: 'weekly' as RoutineSchedule, texto: 'Semana' },
            { valor: 'cycle' as RoutineSchedule, texto: 'Días sueltos' },
            { valor: 'flex' as RoutineSchedule, texto: 'Crear personalizado' },
          ]}
          onChange={setSchedule}
        />

        {schedule === 'flex' ? (
          <>
            <Text style={styles.scheduleHint}>
              Tu método, montado por ti: creas varias rutinas (las de abajo) y el alumno elige cuál
              hacer cada día. Y decides cómo funciona por dentro — en qué unidades se mide el
              esfuerzo, qué ve antes de elegir, cómo se llaman las cosas y qué puede tocar.
            </Text>
            <TextField
              label="Nombre de esta programación (lo ve el alumno)"
              containerStyle={{ marginTop: spacing.md }}
              placeholder="Ej. Personalizado"
              value={scheduleLabel}
              onChangeText={setScheduleLabel}
              style={{ marginTop: spacing.sm, marginBottom: 0 }}
            />
            <Pressable
              onPress={() => setPersonalizacionAbierta((v) => !v)}
              style={styles.persoToggle}
              hitSlop={6}
            >
              <Ionicons
                name={personalizacionAbierta ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.persoToggleTexto}>Personalizar cómo funciona</Text>
            </Pressable>
            {personalizacionAbierta ? (
              <View style={styles.persoCaja}>
                {/* 1 · LA ESCALA. Lo que el entrenador usa para hablar de
                    esfuerzo con su gente. Si trabaja con letras, la app trabaja
                    con letras. */}
                <Text style={styles.persoTitulo}>Cómo se mide el esfuerzo</Text>
                <Segmented
                  compacto
                  valor={perso.esfuerzo?.escala ?? 'rir'}
                  opciones={[
                    { valor: 'rir' as EscalaDeEsfuerzo, texto: 'RIR' },
                    { valor: 'porcentaje' as EscalaDeEsfuerzo, texto: '%' },
                    { valor: 'propia' as EscalaDeEsfuerzo, texto: 'La mía' },
                  ]}
                  onChange={(v) =>
                    cambiaPerso({
                      esfuerzo: {
                        escala: v,
                        cuando: perso.esfuerzo?.cuando ?? 'ejercicio',
                        niveles: perso.esfuerzo?.niveles,
                      },
                    })
                  }
                />
                {perso.esfuerzo?.escala === 'propia' ? (
                  <TextField
                    label={frase`Tus niveles, separados por comas (máx. ${MAX_NIVELES})`}
                    containerStyle={{ marginTop: spacing.sm }}
                    placeholder="Ej. A, B, C, D"
                    value={nivelesTexto}
                    onChangeText={setNivelesTexto}
                    style={{ marginTop: spacing.xs, marginBottom: 0 }}
                  />
                ) : null}

                {/* 2 · CUÁNDO. Preguntar por cada ejercicio es lo más fino y lo
                    más pesado; una vez al terminar es lo que la mayoría
                    contesta de verdad; y hay quien no quiere preguntar nada. */}
                <Text style={styles.persoTitulo}>Cuándo se le pregunta</Text>
                <Segmented
                  compacto
                  valor={perso.esfuerzo?.cuando ?? 'ejercicio'}
                  opciones={[
                    { valor: 'ejercicio' as CuandoElEsfuerzo, texto: 'Por ejercicio' },
                    { valor: 'sesion' as CuandoElEsfuerzo, texto: 'Al terminar' },
                    { valor: 'nunca' as CuandoElEsfuerzo, texto: 'Nunca' },
                  ]}
                  onChange={(v) =>
                    cambiaPerso({
                      esfuerzo: {
                        escala: perso.esfuerzo?.escala ?? 'rir',
                        cuando: v,
                        niveles: perso.esfuerzo?.niveles,
                      },
                    })
                  }
                />

                {/* 3 · LA FICHA. Lo que se lee antes de decidir "cómo me siento
                    hoy": es la pantalla donde el plan personalizado se gana o
                    se pierde. */}
                <Text style={styles.persoTitulo}>Qué ve antes de elegir</Text>
                <View style={styles.persoFichas}>
                {(
                  [
                    ['intensidad', 'La intensidad en %'],
                    ['ejercicios', 'Cuántos ejercicios lleva'],
                    ['duracion', 'Cuánto dura, estimado'],
                    ['grupos', 'Qué grupos musculares toca'],
                  ] as const
                ).map(([clave, texto]) => (
                  <Chip
                    key={clave}
                    texto={texto}
                    icono={perso.ficha?.[clave] ? 'eye' : 'eye-outline'}
                    activo={!!perso.ficha?.[clave]}
                    compacto
                    onPress={() =>
                      cambiaPerso({
                        ficha: { ...perso.ficha, [clave]: !perso.ficha?.[clave] },
                      })
                    }
                  />
                ))}
                </View>

                {/* 4 · EL VOCABULARIO. Un entrenador que trabaja por bloques no
                    quiere que su app diga "días". */}
                <Text style={styles.persoTitulo}>Cómo se llaman las cosas</Text>
                <TextField
                  label="Cada rutina del plan"
                  placeholder="Día"
                  value={perso.vocabulario?.rutina ?? ''}
                  onChangeText={(v) =>
                    cambiaPerso({ vocabulario: { ...perso.vocabulario, rutina: v } })
                  }
                  style={{ marginBottom: spacing.sm }}
                />
                <TextField
                  label="Cada serie"
                  placeholder="Serie"
                  value={perso.vocabulario?.serie ?? ''}
                  onChangeText={(v) =>
                    cambiaPerso({ vocabulario: { ...perso.vocabulario, serie: v } })
                  }
                  style={{ marginBottom: 0 }}
                />

                {/* 5 · LOS PERMISOS. Hasta ahora el plan era intocable y el
                    alumno solo elegía rutina. Hay métodos que viven de lo
                    contrario. */}
                <Text style={styles.persoTitulo}>Qué puede tocar el alumno</Text>
                <View style={styles.persoFichas}>
                {(
                  [
                    ['saltar', 'Saltarse un ejercicio', 'barbell-outline'],
                    ['reordenar', 'Cambiar el orden', 'swap-vertical-outline'],
                    ['anadir', 'Añadir uno de otra rutina', 'add-circle-outline'],
                  ] as const
                ).map(([clave, texto, icono]) => (
                  <Chip
                    key={clave}
                    texto={texto}
                    icono={icono}
                    activo={!!perso.permisos?.[clave]}
                    compacto
                    onPress={() =>
                      cambiaPerso({
                        permisos: { ...perso.permisos, [clave]: !perso.permisos?.[clave] },
                      })
                    }
                  />
                ))}
                </View>
              </View>
            ) : null}
          </>
        ) : schedule === 'cycle' ? (
          <>
            <Text style={styles.scheduleHint}>
              Los {days.length} días rotan en bucle (1 → {days.length} → 1), sin atarse al
              calendario. Marca uno como “Opcional” y el alumno elige: descansar o volver al Día 1.
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
        renderItem={(day, dayIndex, diaArrastrando, asaDia) => {
        const isOpen = expandedDays[day.id] ?? false;
        const exCount = day.exercises.length;
        const summaryParts: string[] = [];
        if (schedule === 'cycle') {
          if (day.optionalRest) summaryParts.push(frase`Día ${dayIndex + 1}`, 'Descanso opcional');
          else if (day.isRest) summaryParts.push(frase`Día ${dayIndex + 1}`, 'Descanso');
          else summaryParts.push(frase`Día ${dayIndex + 1}`, `Intensidad ${day.intensity ?? 5}`);
        } else if (schedule === 'flex') {
          if (day.isRest) summaryParts.push('Descanso');
          else if (day.gtg) {
            summaryParts.push(frase`Todo el día · ${day.gtgSetsPerDay ?? SERIES_POR_DEFECTO} series`);
          }
          else if (day.intensityPct) {
            summaryParts.push(`${day.intensityPct} %`);
            const palabra = esfuerzoDePct(day.intensityPct);
            if (palabra) summaryParts.push(palabra);
          }
        } else if (day.weekday !== undefined) {
          summaryParts.push(WEEKDAY_NAMES[day.weekday]);
          if (day.isRest) summaryParts.push('Descanso');
        }
        if (!day.isRest) {
          summaryParts.push(`${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`);
          // Series totales del día (suma de las series de todos sus ejercicios).
          const totalSets = day.exercises.reduce((acc, e) => acc + (e.sets || 0), 0);
          if (totalSets > 0) summaryParts.push(frase`${totalSets} series`);
        }
        return (
        <Card style={[styles.dayCard, diaArrastrando && styles.dayCardDragging]}>
          <View style={styles.dayHeaderRow}>
            <Pressable
              style={styles.dayHeaderMain}
              onPress={() => toggleDayExpanded(day.id)}
            >
              <Text style={styles.dayTitle} numberOfLines={1}>
                {nombreDelDia(day.name, dayIndex)}
              </Text>
            </Pressable>
            {/* Asa del día: mantener pulsado y mover para cambiar su orden. */}
            <View {...asaDia} style={styles.moveDayBtn}>
              <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
            </View>
            <Pressable onPress={() => duplicateDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="copy-outline" size={17} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => removeDay(day.id)} style={styles.removeDayBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => toggleDayExpanded(day.id)} hitSlop={8}>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          {/* El resumen del día va DEBAJO de la fila, a lo ancho de la tarjeta.
              Al lado de los cuatro botones —mover, duplicar, borrar, desplegar—
              le quedaban 81 píxeles en un móvil de 320, y lo que se leía era
              "Día 1 · Intensidad ...": se perdían los ejercicios y las series,
              que es justo lo que se viene a mirar sin abrir el día. */}
          <Pressable onPress={() => toggleDayExpanded(day.id)}>
            <Text style={styles.daySummary} numberOfLines={2}>
              {summaryParts.join(' · ')}
            </Text>
          </Pressable>

          {isOpen ? (
          <>
          <TextField
            label="Nombre del día"
            value={day.name}
            onChangeText={(v) => updateDayName(day.id, v)}
            style={{ marginTop: spacing.sm }}
          />

          {schedule === 'cycle' ? (
            <>
            <View style={styles.cycleDayRow}>
              <View style={styles.cyclePill}>
                <Text style={styles.cyclePillText}>Día {dayIndex + 1} del ciclo</Text>
              </View>
              <View style={styles.restToggles}>
                <Chip
                  texto="Descanso"
                  icono={day.isRest ? 'bed' : 'bed-outline'}
                  activo={day.isRest && !day.optionalRest}
                  compacto
                  onPress={() => toggleRestDay(day.id)}
                />
                <Chip
                  texto="Opcional"
                  icono={day.optionalRest ? 'shuffle' : 'shuffle-outline'}
                  activo={!!day.optionalRest}
                  compacto
                  onPress={() => toggleOptionalRest(day.id)}
                />
              </View>
            </View>
            {day.optionalRest ? (
              <Text style={styles.optionalHint}>
                Descanso opcional: el alumno decide cada vez entre descansar o
                reiniciar el ciclo entrenando el Día 1.
              </Text>
            ) : null}
            {!day.isRest ? (
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensity ?? 5}/10
                </Text>
                <View style={styles.dayIntensityControls}>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, -1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <View style={styles.intensityTrack}>
                    <View
                      style={[
                        styles.intensityFill,
                        { width: `${((day.intensity ?? 5) / 10) * 100}%` },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, 1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            </>
          ) : schedule === 'flex' ? (
            // En Sensaciones el alumno elige entre varias rutinas: lo que
            // necesita saber antes de elegir es cuánto le va a pedir cada una.
            !day.isRest ? (
              <>
              <View style={styles.gtgFila}>
                <Chip
                  texto="Grease the groove"
                  icono={day.gtg ? 'repeat' : 'repeat-outline'}
                  activo={!!day.gtg}
                  compacto
                  onPress={() => toggleGtgDay(day.id)}
                />
                {day.gtg ? (
                  <TextField
                    keyboardType="number-pad"
                    placeholder={frase`${SERIES_POR_DEFECTO} series al día`}
                    value={day.gtgSetsPerDay ? String(day.gtgSetsPerDay) : ''}
                    onChangeText={(v) => updateDayGtgSets(day.id, v)}
                    containerStyle={styles.gtgCampo}
                    style={{ marginBottom: 0 }}
                  />
                ) : null}
              </View>
              {day.gtg ? (
                <Text style={styles.optionalHint}>
                  Esta rutina no es una sesión: son series sueltas repartidas por todo el día,
                  ninguna al fallo. El alumno la elige sola, no encadenada con otra, y en
                  repeticiones va el objetivo de CADA serie.
                </Text>
              ) : null}
              {day.gtg ? null : (
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensityPct ? `${day.intensityPct} %` : 'sin poner'}
                  {esfuerzoDePct(day.intensityPct)
                    ? ` · ${esfuerzoDePct(day.intensityPct)}`
                    : ''}
                </Text>
                <View style={styles.dayIntensityControls}>
                  <Pressable
                    onPress={() => updateDayPct(day.id, -1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <View style={styles.intensityTrack}>
                    <View
                      style={[
                        styles.intensityFill,
                        { width: `${proporcionIntensidad(day, 'flex') != null ? proporcionIntensidad(day, 'flex')! * 100 : 0}%` },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateDayPct(day.id, 1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              )}
              </>
            ) : null
          ) : (
          <View style={styles.weekdayRow}>
            <View style={styles.weekdayHeadRow}>
              <Text style={styles.weekdayLabel}>Día de la semana</Text>
              <Chip
                texto="Descanso"
                icono={day.isRest ? 'bed' : 'bed-outline'}
                activo={day.isRest}
                compacto
                onPress={() => toggleRestDay(day.id)}
              />
            </View>
            <DiasSemana
              valor={day.weekday}
              onChange={(weekday) => updateDayWeekday(day.id, weekday)}
            />
            {day.isRest ? (
              <Text style={styles.optionalHint}>
                Día de descanso: en el día de la semana elegido, el alumno verá “Descanso”, no
                registra nada y no afecta a su racha.
              </Text>
            ) : null}
            {day.weekday !== undefined && diasRepetidos.has(day.weekday) ? (
              <Text style={styles.avisoRepetido}>
                Otro día del plan cae en el mismo día de la semana. El alumno verá los dos y podrá
                entrenar el que quiera, pero la app le propondrá el primero.
              </Text>
            ) : null}
          </View>
          )}

          {!day.isRest ? (
            <View style={styles.dayTools}>
              <Pressable
                onPress={() => toggleIntervalTimer(day.id)}
                style={styles.checkRow}
                hitSlop={6}
              >
                <Ionicons
                  name={day.showIntervalTimer ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={day.showIntervalTimer ? colors.primary : colors.textMuted}
                />
                <Text style={styles.checkLabel}>
                  Temporizador de intervalos (EMOM) este día
                </Text>
              </Pressable>
              <TextField
                label="Aproximaciones (calentamiento · paso 3)"
                placeholder="Ej. 2 series al 60% y 70% del peso de trabajo"
                value={day.approachesNote ?? ''}
                onChangeText={(v) => updateApproaches(day.id, v)}
              />
            </View>
          ) : null}

          <DragList
            items={day.exercises}
            keyOf={(ex) => ex.id}
            gap={0}
            handleOnly
            onReorder={(from, to) => reordenarEjercicios(day.id, from, to)}
            renderItem={(ex, exIndex, arrastrando, asa) => (
            <View
              style={[
                styles.exerciseRow,
                ex.supersetWithPrevious && styles.exerciseRowLinked,
                arrastrando && styles.exerciseRowDragging,
              ]}
            >
              {ex.supersetWithPrevious ? (
                <View style={styles.supersetTag}>
                  <Ionicons name="link" size={12} color={colors.primaryBright} />
                  <Text style={styles.supersetTagText}>SUPERSERIE con el anterior</Text>
                </View>
              ) : null}
              <View style={styles.exerciseTitleRow}>
                <Text style={styles.exerciseName}>
                  {ex.name}
                  {resolveLoad(ex) === 'assisted' ? (
                    <Text style={styles.markAssisted}> · goma</Text>
                  ) : resolveLoad(ex) === 'weighted' ? (
                    <Text style={styles.markWeighted}> · lastre</Text>
                  ) : null}
                </Text>
                {days.length > 1 ? (
                  <Pressable
                    onPress={() => setMovePicker({ dayId: day.id, ex })}
                    style={styles.moveBtn}
                    hitSlop={4}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
                {/* Asa: mantener pulsado aquí y mover arriba o abajo. Va
                    aparte de la fila porque está llena de campos de texto y
                    colocar el cursor no debe mover el ejercicio. */}
                <View {...asa} style={styles.moveBtn}>
                  <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                </View>
                <Pressable
                  onPress={() => removeExercise(day.id, ex.id)}
                  style={styles.deleteBtn}
                  hitSlop={4}
                >
                  <Ionicons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>

              {/* La categoría del ejercicio, debajo del nombre.
                  Estaba en el selector de la biblioteca y se perdía justo al
                  añadirlo al día, que es donde el entrenador pasa el rato: dos
                  ejercicios que empiezan igual ("Front lever", "Front lever
                  press") quedaban indistinguibles aquí y sí se distinguían en
                  la pantalla del alumno. El dato ya viajaba en el plan; solo
                  faltaba enseñarlo. */}
              {ex.muscleGroup || ex.subgroup ? (
                <Text style={styles.exerciseGrupo} numberOfLines={1}>
                  {ex.muscleGroup}
                  {ex.muscleGroup && ex.subgroup ? ' · ' : ''}
                  {ex.subgroup}
                  {ex.measure === 'seconds' ? ' · isométrico' : ''}
                </Text>
              ) : null}

              <Text style={styles.loadLabel}>Carga</Text>
              <Opciones
                opciones={LOAD_TYPES.map((l) => ({ valor: l, texto: LOAD_LABEL[l] }))}
                valor={resolveLoad(ex)}
                onChange={(v) => v && setExerciseLoad(day.id, ex.id, v)}
              />

              <Text style={styles.loadLabel}>Agarre (opcional)</Text>
              <Opciones
                opciones={GRIP_TYPES.map((g) => ({ valor: g, texto: GRIP_LABEL[g] }))}
                valor={ex.grip}
                desmarcable
                onChange={(g) => g && setExerciseGrip(day.id, ex.id, g)}
              />

              <View style={styles.exerciseFields}>
                <TextField
                  label="Series"
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'sets', v)}
                  containerStyle={styles.smallInput}
                />
                <TextField
                  label={
                    isDualMeasure(ex.measure)
                      ? isHoldMeasure(ex.measure)
                        ? 'Aguante izq. (seg)'
                        : 'Reps izq.'
                      : isHoldMeasure(ex.measure)
                        ? 'Aguante (seg)'
                        : 'Reps'
                  }
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                  containerStyle={styles.smallInput}
                />
                {/* Combo: además de las reps, el aguante de la misma serie. */}
                {ex.measure === 'combo' ? (
                  <TextField
                    label="Aguante (seg)"
                    value={ex.seconds ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'seconds', v)}
                    placeholder="12"
                    containerStyle={styles.smallInput}
                  />
                ) : isDualMeasure(ex.measure) ? (
                  /* Por lados: el objetivo del lado derecho. Casi siempre será
                     el mismo que el izquierdo, pero no siempre, y ahí está la
                     gracia de poder ponerlo aparte. */
                  <TextField
                    label={isHoldMeasure(ex.measure) ? 'Aguante der. (seg)' : 'Reps der.'}
                    value={ex.side2 ?? ''}
                    onChangeText={(v) => updateExerciseField(day.id, ex.id, 'side2', v)}
                    placeholder={isHoldMeasure(ex.measure) ? '30' : '8-12'}
                    containerStyle={styles.smallInput}
                  />
                ) : null}
              </View>
              <View style={styles.exerciseFields}>
                <TextField
                  label="RIR"
                  keyboardType="number-pad"
                  value={ex.rir !== undefined ? String(ex.rir) : ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'rir', v)}
                  placeholder="2"
                  containerStyle={styles.smallInput}
                />
                <TextField
                  label="Descanso (min:seg)"
                  keyboardType="numbers-and-punctuation"
                  value={restText[ex.id] ?? minutosSegundos(ex.restSeconds)}
                  onChangeText={(v) => {
                    setRestText((prev) => ({ ...prev, [ex.id]: v }));
                    updateRestSeconds(day.id, ex.id, segundosDeTexto(v));
                  }}
                  placeholder="3:30"
                  containerStyle={styles.smallInput}
                />
              </View>
              {/* Clúster: la serie se parte en bloques con una pausa mínima.
                  Los números solo aparecen si está activado, para no meter dos
                  casillas más en la ficha de todos los ejercicios. */}
              {ex.cluster ? (
                <View style={styles.exerciseFields}>
                  <TextField
                    label="Bloques por serie"
                    keyboardType="number-pad"
                    value={String(clusterBlocks(ex.cluster))}
                    onChangeText={(v) =>
                      setExerciseCluster(day.id, ex.id, { blocks: parseInt(v, 10) || 2 })
                    }
                    placeholder="3"
                    containerStyle={styles.smallInput}
                  />
                  <TextField
                    label="Pausa entre bloques (seg)"
                    keyboardType="number-pad"
                    value={String(ex.cluster.restSeconds)}
                    onChangeText={(v) =>
                      setExerciseCluster(day.id, ex.id, {
                        restSeconds: Math.max(0, Math.min(120, parseInt(v, 10) || 0)),
                      })
                    }
                    placeholder="15"
                    containerStyle={styles.smallInput}
                  />
                </View>
              ) : null}
              <TextField
                label="Indicaciones (opcional)"
                value={ex.notes ?? ''}
                onChangeText={(v) => updateExerciseField(day.id, ex.id, 'notes', v)}
                placeholder="Tempo, agarre, técnica..."
                style={{ marginBottom: 0, marginTop: spacing.xs }}
              />
              {goalOpen[ex.id] || ex.goal ? (
                <TextField
                  label="Objetivo (texto libre)"
                  value={ex.goal ?? ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'goal', v)}
                  placeholder={
                    ex.measure === 'seconds' ? 'Ej. 20 segundos con 5 kg' : 'Ej. 3x10 con 5 kg'
                  }
                  style={{ marginBottom: 0, marginTop: spacing.xs }}
                />
              ) : null}
              <View style={styles.linksRow}>
                <Pressable
                  onPress={() => setGoalOpen((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                  style={styles.linkBtn}
                >
                  <Ionicons name="flag-outline" size={14} color={colors.primary} />
                  <Text style={styles.linkBtnText}>
                    {ex.goal ? `Objetivo: ${ex.goal}` : 'Añadir objetivo'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setExerciseCluster(day.id, ex.id, ex.cluster ? null : { ...CLUSTER_DEFAULT })
                  }
                  style={styles.linkBtn}
                >
                  <Ionicons
                    name={ex.cluster ? 'layers' : 'layers-outline'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.linkBtnText}>
                    {ex.cluster
                      ? `Clúster: ${clusterBlocks(ex.cluster)} bloques · ${ex.cluster.restSeconds}s`
                      : 'Series en clúster'}
                  </Text>
                </Pressable>
                {exIndex > 0 ? (
                  <Pressable onPress={() => toggleSuperset(day.id, ex.id)} style={styles.linkBtn}>
                    <Ionicons
                      name={ex.supersetWithPrevious ? 'unlink' : 'link'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.linkBtnText}>
                      {ex.supersetWithPrevious
                        ? 'Quitar superserie'
                        : 'Superserie con el anterior'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            )}
          />

          <Button
            title="+ Añadir ejercicio"
            variant="secondary"
            onPress={() => {
              setExerciseSearch('');
              setCreatingNew(false);
              setPickerForDay(day.id);
            }}
            style={{ marginTop: spacing.sm }}
          />
          </>
          ) : null}
        </Card>
        );
        }}
      />

      <Sheet
        visible={pickerForDay !== null}
        onClose={() => {
          setPickerForDay(null);
          setCreatingNew(false);
        }}
        titulo={creatingNew ? 'Nuevo ejercicio' : 'Añadir ejercicio'}
      >

            {creatingNew ? (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                <TextField
                  label="Nombre del ejercicio"
                  placeholder="Ej. Muscle up"
                  value={newName}
                  onChangeText={setNewName}
                />
                <Text style={styles.loadLabel}>Categoría</Text>
                <Opciones
                  opciones={categoriasBiblioteca.map((g) => ({ valor: g, texto: g }))}
                  valor={newGroup}
                  envuelve
                  onChange={(g) => {
                    setNewGroup(g ?? '');
                    setNewSubgroup('');
                  }}
                />
                {/* Subgrupo: solo si esa categoría ya tiene alguno definido. */}
                {(profile?.categorySubgroups?.[newGroup] ?? []).length > 0 ? (
                  <>
                    <Text style={styles.loadLabel}>Subgrupo (opcional)</Text>
                    <Opciones
                      opciones={(profile?.categorySubgroups?.[newGroup] ?? []).map((sg) => ({
                        valor: sg,
                        texto: sg,
                      }))}
                      valor={newSubgroup}
                      desmarcable
                      envuelve
                      onChange={(sg) => setNewSubgroup(sg ?? '')}
                    />
                  </>
                ) : null}
                {/* Con el grupo decidido no se pregunta: se dice cuál es y se
                    sigue. Preguntar aquí solo sirve para que alguien conteste
                    distinto de lo que su propio grupo ya dice. */}
                {medidaDelNuevoGrupo ? (
                  <Text style={styles.medidaHeredada}>
                    Medida: {MEASURE_SHORT[medidaDelNuevoGrupo].toLowerCase()} · lo decide el
                    grupo «{newSubgroup}»
                  </Text>
                ) : (
                  <>
                    <Text style={styles.loadLabel}>Medida</Text>
                    <Opciones
                      opciones={[
                        { valor: 'reps' as ExerciseMeasure, texto: 'Repeticiones' },
                        { valor: 'seconds' as ExerciseMeasure, texto: 'Segundos' },
                      ]}
                      valor={newMeasure}
                      onChange={(m) => m && setNewMeasure(m)}
                    />
                  </>
                )}
                <Text style={styles.loadLabel}>Carga</Text>
                <Opciones
                  opciones={LOAD_TYPES.map((l) => ({ valor: l, texto: LOAD_LABEL[l] }))}
                  valor={newLoad}
                  onChange={(v) => v && setNewLoad(v)}
                />
                <TextField
                  label="Vídeo de técnica (opcional)"
                  placeholder="Pega el enlace de YouTube"
                  value={newVideo}
                  onChangeText={setNewVideo}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  title="Crear y añadir al día"
                  onPress={handleCreateAndAdd}
                  loading={savingNew}
                  disabled={!newName.trim()}
                  style={{ marginTop: spacing.md }}
                />
                <Button
                  title="Volver a la biblioteca"
                  variant="ghost"
                  onPress={() => setCreatingNew(false)}
                  style={{ marginTop: spacing.xs }}
                />
              </ScrollView>
            ) : (
              <>
                <TextField
                  placeholder="Buscar ejercicio..."
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  autoCapitalize="none"
                  style={{ marginBottom: spacing.sm }}
                />
                <Pressable
                  onPress={() => {
                    setNewName(exerciseSearch.trim());
                    setCreatingNew(true);
                  }}
                  style={styles.createNewBtn}
                >
                  <Ionicons name="add-circle" size={18} color={colors.primary} />
                  <Text style={styles.createNewText}>
                    Crear ejercicio nuevo
                    {exerciseSearch.trim() ? ` “${exerciseSearch.trim()}”` : ''}
                  </Text>
                </Pressable>
                {exercises.length === 0 ? (
                  <Text style={styles.mutedText}>
                    No tienes ejercicios en tu biblioteca todavía. Crea el primero con el botón de
                    arriba.
                  </Text>
                ) : (
                  <>
                    {/* Filtro por categoría. Con una biblioteca grande, buscar
                        por nombre obliga a saber ya lo que quieres; por
                        categoría se puede ir a "Tirón" y ver qué hay. */}
                    <ChipRow scroll>
                      {['Todos', ...categoriasBiblioteca].map((cat) => (
                        <Chip
                          key={cat}
                          texto={cat}
                          activo={filtroCategoria === cat}
                          onPress={() => {
                            setFiltroCategoria(cat);
                            setFiltroSubgrupo(null);
                          }}
                        />
                      ))}
                    </ChipRow>

                    {/* Subgrupos: solo dentro de una categoría concreta y solo
                        si esa categoría los tiene. */}
                    {subgruposVisibles.length > 0 ? (
                      <ChipRow scroll>
                        {subgruposVisibles.map((sg) => (
                          <Chip
                            key={sg}
                            texto={sg}
                            activo={filtroSubgrupo === sg}
                            onPress={() =>
                              setFiltroSubgrupo(filtroSubgrupo === sg ? null : sg)
                            }
                          />
                        ))}
                      </ChipRow>
                    ) : null}

                  <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                    {ejerciciosFiltrados.length === 0 ? (
                      <Text style={styles.mutedText}>
                        Ningún ejercicio de esa categoría coincide con la búsqueda.
                      </Text>
                    ) : null}
                    {ejerciciosFiltrados
                      .map((ex) => (
                        <Pressable
                          key={ex.id}
                          onPress={() => pickerForDay && addExerciseToDay(pickerForDay, ex)}
                          style={styles.pickerRow}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickerRowText}>
                              {ex.name}
                              {resolveLoad(ex) === 'assisted' ? (
                                <Text style={styles.markAssisted}> · goma</Text>
                              ) : resolveLoad(ex) === 'weighted' ? (
                                <Text style={styles.markWeighted}> · lastre</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.pickerRowMuscle}>
                              {ex.muscleGroup}
                              {ex.subgroup ? ` · ${ex.subgroup}` : ''}
                              {ex.measure === 'seconds' ? ' · isométrico' : ''}
                            </Text>
                          </View>
                          <Ionicons name="add-circle" size={22} color={colors.primary} />
                        </Pressable>
                      ))}
                  </ScrollView>
                  </>
                )}
              </>
            )}
      </Sheet>

      <Sheet
        visible={movePicker !== null}
        onClose={() => setMovePicker(null)}
        titulo="Mover o copiar"
        descripcion={movePicker?.ex.name}
      >
            <ScrollView style={styles.modalList}>
              {days.map((d, i) => {
                const isSource = d.id === movePicker?.dayId;
                return (
                  <View key={d.id} style={styles.moveDayRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowText}>
                        {nombreDelDia(d.name, i)}
                        {isSource ? '  · actual' : ''}
                      </Text>
                      <Text style={styles.pickerRowMuscle}>
                        {d.exercises.length}{' '}
                        {d.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                        {d.isRest ? ' · descanso' : ''}
                      </Text>
                    </View>
                    <Button
                      title="Copiar"
                      variant="secondary"
                      onPress={() => moveOrCopyExercise(d.id, true)}
                      style={styles.moveActionBtn}
                    />
                    {!isSource ? (
                      <Button
                        title="Mover"
                        onPress={() => moveOrCopyExercise(d.id, false)}
                        style={styles.moveActionBtn}
                      />
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
      </Sheet>

      <Button title="+ Añadir día" variant="ghost" onPress={addDay} style={styles.addDayBtn} />

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button title="Guardar rutina" onPress={handleSave} loading={saving} style={styles.saveBtn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayCardDragging: { borderColor: colors.hairline },
  dayCard: { marginBottom: spacing.md },
  scheduleCard: { marginBottom: spacing.md },
  scheduleTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  scheduleHint: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  dayTools: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkLabel: { ...typography.small, color: colors.text, flex: 1, lineHeight: 18 },
  // El panel de personalización: cerrado por defecto para que el editor siga
  // empezando por lo de siempre —los ejercicios—, y abierto de un toque para
  // quien quiera montarse su método.
  persoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  persoToggleTexto: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  persoCaja: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.xs,
  },
  persoTitulo: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  // En fila y envolviendo: son interruptores cortos, y en columna ocupaban
  // media pantalla para decir cuatro palabras.
  persoFichas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  gtgFila: {
    flexDirection: 'row',
    alignItems: 'center',
    // El nombre del método no se abrevia: "Grease the groove" pide seis
    // píxeles más de los que quedan al lado del campo de series en un móvil
    // estrecho, así que el campo se va debajo en vez de comerse la etiqueta.
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gtgCampo: { flex: 1, marginBottom: 0 },
  dayIntensityRow: { marginBottom: spacing.sm },
  dayIntensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dayIntensityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  intensityTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  intensityFill: { height: '100%', backgroundColor: colors.primary },
  cycleResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  cycleResetText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  cycleDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  cyclePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cyclePillText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  restToggles: { flexDirection: 'row', gap: spacing.xs },
  optionalHint: {
    ...typography.small,
    color: colors.primaryBright,
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  moveDayBtn: { paddingHorizontal: 4 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  removeDayBtn: { paddingHorizontal: spacing.sm },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayHeaderMain: { flex: 1, paddingVertical: spacing.xs },
  dayTitle: { ...typography.h3, color: colors.text },
  daySummary: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  weekdayRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  avisoRepetido: { ...typography.small, color: colors.warning, marginTop: spacing.xs },
  weekdayHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayLabel: fieldLabel,
  exerciseRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  exerciseRowDragging: { borderColor: colors.hairline },
  exerciseRowLinked: {
    borderLeftWidth: 2,
    borderLeftColor: colors.hairline,
    paddingLeft: spacing.sm,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  exerciseFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  // Va en `containerStyle`, no en `style`: `style` acaba en el TextInput de
  // dentro, así que el contenedor seguía midiendo lo que ocupase su etiqueta y
  // "Descanso (min:seg)" empujaba la fila fuera de la pantalla.
  smallInput: { flex: 1, marginBottom: 0 },
  medidaHeredada: {
    ...typography.small,
    color: colors.primaryBright,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  loadLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: 11,
  },
  // Marcadores de carga en color (sin emojis): azul = lastre, dorado = goma.
  markWeighted: { color: '#5B9BD5', fontFamily: fonts.semiBold, fontSize: 13 },
  markAssisted: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
  createNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.sm,
  },
  createNewText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, flex: 1 },
  moveBtn: { padding: spacing.xs },
  deleteBtn: { padding: spacing.xs },
  moveDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveActionBtn: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  supersetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetTagText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  linkBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  copyCard: { marginBottom: spacing.md },
  copyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  /*
   * Tres botones en fila, y si no caben, en dos filas.
   *
   * Con `flex: 1` a secas se reparten el ancho pase lo que pase, y en un móvil
   * estrecho —o con la letra del sistema más grande— a cada uno le tocan menos
   * píxeles de los que mide su palabra: "Borrador" se partía en "Borrado" y una
   * "r" suelta debajo. Con un ancho mínimo, cuando los tres ya no caben la fila
   * se parte en dos y cada botón vuelve a tener sitio para su texto.
   */
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accionAncha: { flexGrow: 1, flexShrink: 1, flexBasis: 96, minWidth: 96 },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalList: { maxHeight: 420 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowText: { ...typography.body, color: colors.text },
  pickerRowMuscle: { ...typography.small, color: colors.textFaint },
  exerciseGrupo: { ...typography.small, color: colors.textFaint, marginTop: 2 },
  mutedText: { ...typography.small, color: colors.textFaint },
  addDayBtn: { marginBottom: spacing.lg },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  saveBtn: { marginBottom: spacing.xl },
});
