import type { MuscleId } from './muscles';
import type { PausaPlan } from './pausa';
import type { EsfuerzoApuntado, PlanPersonalizado } from './planPersonalizado';

// 'athlete' = usuario individual que se autoentrena (es su propio coach:
// crea sus rutinas, sigue su progreso y nutrición). De pago mensual.
export type UserRole = 'trainer' | 'client' | 'athlete';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  createdAt: number;
  /** Última vez que el alumno cambió su nombre (límite: 1 vez cada 30 días). */
  nameChangedAt?: number;
  /**
   * Pedirle el esfuerzo (RIR) al terminar cada ejercicio. Lo activa el
   * entrenador por alumno; los atletas lo tienen siempre.
   *
   * No se pide a todo el mundo porque a quien empieza el RIR no le suena: lo
   * rellenaría al azar, y un dato inventado es peor que no tener dato.
   */
  trackRir?: boolean;
  /** Solo entrenadores: categorías propias de ejercicios (crea/borra las suyas).
   * Sin valor = usa las de por defecto (MUSCLE_GROUPS). */
  exerciseCategories?: string[];
  /** Color elegido por el entrenador para cada categoría (nombre → color). */
  categoryColors?: Record<string, string>;
  /**
   * Subgrupos dentro de cada categoría, en su orden (categoría → subgrupos).
   * Sirven para separar ejercicios afines: en "Planche", por ejemplo,
   * "Accesorios", "Flexiones", "Press" y "Aguantes".
   */
  categorySubgroups?: Record<string, string[]>;
  /**
   * Cómo se mide cada grupo (categoría + subgrupo → reps, segundos, combo…).
   *
   * Se decide una vez por grupo y vale para todos sus ejercicios, incluidos
   * los que se añadan después: "el grupo Aguantes va en segundos" es una
   * decisión del entrenador sobre su biblioteca, no un campo que repetir en
   * cada ficha. Ver lib/medidaDeGrupo.ts.
   */
  subgroupMeasures?: Record<string, ExerciseMeasure>;
  /**
   * Cuántos alumnos tiene el entrenador. Lo mantiene su propia app al cargar
   * la lista de clientes. Existe para saber si sigue dentro del plan gratuito
   * sin tener que contar la colección en cada arranque.
   */
  clientCount?: number;
  /**
   * Plazas de alumno incluidas en esta cuenta. Sin valor = las del alta
   * (FREE_CLIENT_LIMIT). Solo lo escribe el servidor, que lo pone a 0 cuando el
   * alta se pagó con una tarjeta que ya compró sus plazas en otra cuenta.
   */
  clientSlots?: number;
  /** Cuándo se pagó el alta de 1 €. Solo servidor. */
  entryPaidAt?: number;
  /**
   * Huella de la tarjeta del alta: la misma tarjeta da la misma huella en
   * cualquier cuenta. Solo servidor; es la señal que sostiene el control de
   * multicuentas.
   */
  payerFingerprint?: string;
  /** Otras cuentas de entrenador que pagaron con esa misma tarjeta. Solo servidor. */
  sharedCardWith?: string[];
  /**
   * Día del mes en que se le cobra la cuota. Es el ancla de su ciclo: sin él,
   * un alumno que cobra el 31 caería a 28 al pasar por febrero y se quedaría
   * ahí para siempre.
   */
  billingAnchorDay?: number;
  /** Solo en entrenadores: código que comparten con sus clientes para vincularse. */
  inviteCode?: string;
  /**
   * Enlace de cobro de ESTE alumno (Stripe Payment Link, Bizum, PayPal.me…):
   * el que abre para pagar su cuota de un toque desde el aviso de cobro. Lo
   * pone su entrenador en su ficha, junto a la cuota.
   *
   * Va por alumno y no por entrenador porque los precios no son uno solo: la
   * tarifa de lanzamiento, el plan trimestral, el que vino de una promoción y
   * el que pactó un precio a mano son cuatro enlaces distintos. Con uno común
   * el botón cobraba de más a unos y de menos a otros.
   *
   * (En cuentas de entrenador antiguas puede quedar el enlace común de antes.
   * Ya no se usa para cobrar: solo se ofrece como sugerencia al rellenar la
   * ficha de cada alumno, para no tener que buscarlo otra vez.)
   */
  paymentLink?: string;
  /** Solo en clientes: uid del entrenador al que pertenecen. */
  trainerId?: string;
  /** Stripe: id de cliente y de suscripción (los escribe el webhook). */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /*
   * Aquí vivían `stripeAccountId` y `stripeChargesEnabled`, de cuando el
   * entrenador daba de alta una cuenta conectada de Stripe para cobrar desde
   * la app. Se quitó: obligaba a montar una cuenta y cobraba lo mismo a todos
   * los alumnos, calculado desde la cuota. El enlace por alumno hace lo mismo,
   * vale igual para Bizum o PayPal y no obliga a darse de alta en nada.
   *
   * Puede que sigan escritos en cuentas viejas. No los lee nadie.
   */
  /**
   * Solo en clientes: el objetivo principal, de cuando había uno solo.
   * Lo lee `lib/objetivos.ts` para no perder lo que ya estaba escrito; lo
   * nuevo se guarda en los tres de abajo.
   */
  goal?: string;
  /** Objetivo a corto plazo (una línea). */
  goalShort?: string;
  /** Objetivo a medio plazo (una línea). */
  goalMid?: string;
  /** Objetivo a largo plazo (una línea). */
  goalLong?: string;
  /**
   * Alumno VIP: ve también las clases que su entrenador marca como VIP.
   *
   * Lo escribe SU entrenador desde la ficha, nunca el propio alumno: si
   * pudiera ponérselo él, "VIP" sería una casilla y no un plan.
   */
  vip?: boolean;
  /** Avatar del usuario como data URL (base64) o URL remota. */
  photoURL?: string;
  /** Breve biografía / presentación del alumno. */
  bio?: string;
  /** Nivel de experiencia del alumno. */
  level?: ExperienceLevel;
  /** Peso objetivo del alumno en kg. */
  targetWeightKg?: number;
  /**
   * Pasos al día que se propone. Sin valor, los de por omisión (ver
   * lib/pasos.ts). Va en el perfil y no en cada día porque es un objetivo, no
   * un dato del martes.
   */
  stepGoal?: number;
  /**
   * De dónde salen sus pasos, una vez elegido. Se guarda en LA CUENTA.
   *
   * Antes no se guardaba nada: había que pulsar "traer los pasos del móvil"
   * cada día, y un contador que hay que pedir a mano cada mañana no lo usa
   * nadie más de tres días. Ahora se elige una vez y a partir de ahí los pasos
   * aparecen solos al abrir la app.
   *
   * En la cuenta y no en el móvil a propósito: quien cambia de teléfono o entra
   * desde otro no tiene que volver a decidirlo. Lo único que sigue siendo del
   * aparato es el PERMISO del sistema, que no se puede llevar de un móvil a
   * otro por definición.
   *
   *  - `telefono`: el contador del propio móvil.
   *  - `mano`: lo escribe él (reloj, otra app). Es una elección legítima, no un
   *    plan B: mucha gente lleva reloj, y un contador que solo acepta lo que
   *    mide él deja fuera justo a quien más anda.
   *
   * Sin valor = todavía no lo ha elegido.
   */
  stepsSource?: 'telefono' | 'mano';
  /**
   * Idioma elegido ('es' | 'en'). Sin valor, el del teléfono. No se guarda
   * "es" por omisión a propósito: quien no ha elegido no ha elegido español,
   * ha elegido "lo que hable mi móvil", y el día que cambie de móvil quiere
   * que la app le siga.
   */
  language?: string;
  /**
   * Solo en clientes: momento en que el alumno declaró "ya he pagado" (pendiente
   * de que el entrenador lo confirme). Se limpia al registrar el cobro.
   */
  paymentReportedAt?: number;
  /** Recordatorio diario de entrenamiento (hora local, 0-23). */
  reminderHour?: number;
  /** Minuto del recordatorio (0-59). */
  reminderMinute?: number;
  reminderEnabled?: boolean;
  /**
   * Avisos de "se te ha olvidado subir el entreno": uno por hora, desde la
   * hora del recordatorio y hasta las 22:00, solo los días que toca entrenar.
   * Apagado por omisión: son muchos avisos y hay que pedirlos.
   */
  missedWorkoutRemindersEnabled?: boolean;
  /** Estado del alumno gestionado por el entrenador. */
  status?: ClientStatus;
  /** Estado de pago del alumno, gestionado por el entrenador. */
  paymentStatus?: PaymentStatus;
  /** Cuota mensual del alumno en euros (la fija el entrenador). */
  monthlyFeeEur?: number;
  /** Fecha (timestamp) del próximo pago / renovación. */
  nextPaymentDate?: number;
  /** Token de Expo Push Notifications del último dispositivo registrado. */
  pushToken?: string;
  /** true en cuentas creadas con verificación de correo obligatoria. */
  emailVerificationRequired?: boolean;
  /**
   * SaaS UDECA (solo coaches): fin de la suscripción o del periodo de prueba
   * (timestamp ms). Sin valor = cuenta fundadora (acceso completo, anterior a
   * la monetización). Solo el admin de UDECA puede modificarlo (reglas).
   */
  subscriptionUntil?: number;
  /**
   * Fin de la prueba gratuita fijado al crear la cuenta. Sirve para distinguir
   * "está probando" de "ha pagado": al pagar, subscriptionUntil supera esta
   * fecha. No se vuelve a tocar, así que la prueba no se puede repetir.
   */
  trialEndsAt?: number;
  /**
   * Marcas del último aviso automático enviado por la tarea diaria del
   * servidor (inactividad y cuota). Evitan repetir el mismo recordatorio a
   * diario. Solo las escribe el backend.
   */
  lastInactivityNudge?: number;
  lastPaymentNudge?: number;
  /**
   * Último aviso enviado sobre el final de la prueba, en días que quedaban
   * (3 o 1). Guarda el HITO y no la fecha para que los dos avisos puedan
   * salir con un día de diferencia sin pisarse. Solo lo escribe el backend.
   */
  trialNudgeStage?: number;
  /**
   * Plan contratado: el entrenador paga al año y el atleta al mes.
   *
   * No decide el acceso —eso lo decide `subscriptionUntil`— pero sí lo que se
   * lee en la ficha, así que un atleta con 'annual' escrito dice que ha
   * contratado algo que no existe para él.
   */
  subscriptionPlan?: 'annual' | 'monthly';
  /**
   * Número de fundador, si entró durante la campaña. Es correlativo y no se
   * reutiliza: el 7 es el séptimo que pagó su alta, y lo sigue siendo aunque
   * los seis anteriores se borren la cuenta.
   *
   * Lo asigna el servidor al activar el alta (payments-webhook/api/_alta.js);
   * las reglas impiden que nadie se lo ponga a mano.
   */
  founderNumber?: number;
  /** Cuándo se le asignó ese número. */
  founderSince?: number;
  /** Onboarding completado (una vez por cuenta, sincronizado entre dispositivos). */
  onboardingCompleted?: boolean;
  /**
   * Cuándo cerró por última vez el aviso del plan (la pantalla completa).
   *
   * Va en la CUENTA y no en el dispositivo a propósito: cerrarlo en el móvil y
   * que vuelva a saltar en el ordenador media hora después no es un
   * recordatorio, es perseguir a alguien. Aquí se cierra una vez y descansa una
   * semana en todos sus dispositivos.
   */
  planPopupClosedAt?: number;
  /**
   * Objetivo de macros que el propio alumno calculó (en el onboarding o en la
   * calculadora): se usa en Nutrición si su coach aún no le asignó un plan.
   */
  nutritionTargets?: {
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    goal?: string;
    updatedAt: number;
  };
  /**
   * Sesión de entrenamiento en curso, para sincronizar entre dispositivos de la
   * misma cuenta (series, reps, marcas). Se limpia al terminar o descartar.
   */
  activeSession?: ActiveSession;
  /**
   * Ancla del ciclo (Método REIN TENA) por rutina: routineId → timestamp del
   * Día 1. Sincroniza el día del ciclo entre dispositivos.
   */
  cycleAnchors?: Record<string, number>;
  /**
   * Cuándo se decidió cada ancla: routineId → timestamp. Es lo que permite
   * saber qué manda cuando el mismo alumno toca su ciclo desde dos móviles, o
   * cuando el coach reprograma el plan por su lado. Va en un mapa aparte para
   * no cambiarle el tipo a `cycleAnchors`, que las versiones anteriores de la
   * app leen como número.
   */
  cycleAnchorsSetAt?: Record<string, number>;
  /**
   * Modo Sensaciones: días (timestamp a medianoche) que el alumno marcó como
   * descanso a propósito; no rompen la racha.
   */
  flexRestDays?: number[];
  /**
   * Pausas del plan: días en los que la programación no exige nada (lesión,
   * viaje, una semana imposible). Ver lib/pausa.ts. Las pasadas se guardan
   * porque son las que mantienen congelado el ciclo; se podan a los 180 días.
   */
  planPauses?: PausaPlan[];
  /**
   * Categorías cuyas series semanales quiere ver el alumno en su progreso. Sin
   * valor se muestran las que más trabaja. Antes eran siempre Empuje y Tirón,
   * que a quien entrena sobre todo Core le dejaba dos gráficas planas.
   */
  progressGroups?: string[];
}

/** Sesión de entrenamiento a medias, sincronizable entre dispositivos. */
export interface ActiveSession {
  routineId: string;
  dayId: string;
  log: LoggedExercise[];
  startedAt: number | null;
  savedAt: number;
}

export const CLIENT_STATUSES = ['active', 'paused', 'inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/*
 * "En espera" y no "En pausa": desde que existen las pausas del plan (unos días
 * sin entrenar, ver lib/pausa.ts) había dos cosas distintas con el mismo nombre
 * en la misma ficha. Esto es el estado del ALUMNO —sigue apuntado pero ahora
 * mismo no se le entrena—, no unos días sueltos de su programación.
 */
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Activo',
  paused: 'En espera',
  inactive: 'Inactivo',
};

/** Estado de pago del alumno, gestionado por el entrenador. */
export const PAYMENT_STATUSES = ['paid', 'pending', 'overdue', 'trial', 'free'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: 'Pagado',
  pending: 'Pago pendiente',
  overdue: 'Vencido',
  trial: 'Prueba',
  free: 'Cortesía',
};

/** Color semántico de cada estado de pago (verde/ámbar/rojo/neutro). */
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'good' | 'warn' | 'bad' | 'muted'> = {
  paid: 'good',
  pending: 'warn',
  overdue: 'bad',
  trial: 'muted',
  free: 'muted',
};

export const EXPERIENCE_LEVELS = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const MUSCLE_GROUPS = [
  'Tren superior',
  'Tren inferior',
  'Core',
  'Empuje',
  'Tirón',
  'Full body',
  'Movilidad',
  'Cardio',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Cómo se mide el ejercicio: repeticiones o segundos (isométricos). */
/**
 * Cómo se mide un ejercicio:
 *  - 'reps': repeticiones (dominadas).
 *  - 'seconds': isométrico, se aguanta (front lever).
 *  - 'combo': ambas en la MISMA serie (muscle up + front lever): se apuntan
 *    las repeticiones y, a continuación, el aguante.
 */
/**
 * Paleta con la que cada entrenador colorea sus categorías. Son tonos que
 * conviven con el negro y el oro de UDECA sin competir con ellos.
 */
export const CATEGORY_PALETTE = [
  '#A2968B',
  '#4CAF7D',
  '#3F8EDC',
  '#8E6FD8',
  '#E0A43B',
  '#E2703A',
  '#D2422F',
  '#6B7078',
] as const;

/**
 * Cómo se mide una serie.
 *
 *  - 'reps'        una marca: repeticiones.
 *  - 'seconds'     una marca: segundos de aguante (isométrico).
 *  - 'combo'       dos marcas DISTINTAS en la misma serie: repeticiones y, a
 *                  continuación, aguante (muscle up + front lever).
 *  - 'repsDual'    dos marcas del MISMO tipo, una por lado: repeticiones con
 *                  el brazo izquierdo y con el derecho.
 *  - 'secondsDual' igual, pero de aguante por lado.
 *
 * Los dos últimos existen porque en calistenia hay mucho trabajo a un brazo
 * (dominadas a un brazo, planchas a una mano) y anotar los dos lados en la
 * misma casilla pierde justo el dato que importa: cuál va por detrás.
 */
export type ExerciseMeasure = 'reps' | 'seconds' | 'combo' | 'repsDual' | 'secondsDual';

export const EXERCISE_MEASURES: ExerciseMeasure[] = [
  'reps',
  'seconds',
  'combo',
  'repsDual',
  'secondsDual',
];

/** Etiqueta larga (formularios donde se elige la medida). */
export const MEASURE_LABEL: Record<ExerciseMeasure, string> = {
  reps: 'Repeticiones',
  seconds: 'Segundos (isométrico)',
  combo: 'Combo (reps + aguante)',
  repsDual: 'Reps por lado (izq. y der.)',
  secondsDual: 'Aguante por lado (izq. y der.)',
};

/** Etiqueta corta (listados y resúmenes). */
export const MEASURE_SHORT: Record<ExerciseMeasure, string> = {
  reps: 'Repeticiones',
  seconds: 'Isométrico',
  combo: 'Combo',
  repsDual: 'Reps por lado',
  secondsDual: 'Isométrico por lado',
};

/** ¿La marca principal se mide en segundos (aguante) en vez de en reps? */
export function isHoldMeasure(m?: ExerciseMeasure): boolean {
  return m === 'seconds' || m === 'secondsDual';
}

/** ¿Se anota cada lado por separado (izquierda y derecha)? */
export function isDualMeasure(m?: ExerciseMeasure): boolean {
  return m === 'repsDual' || m === 'secondsDual';
}


/**
 * Carga del ejercicio (calistenia):
 *  - 'none': peso corporal, sin nada extra (dominadas normales).
 *  - 'weighted': lastrado, se añade peso (dominadas lastradas → casilla kg).
 *  - 'assisted': asistido con goma/banda (dominadas asistidas → casilla goma).
 */
export type ExerciseLoad = 'none' | 'weighted' | 'assisted';

/** Cómo se llama cada carga en pantalla. Estaba escrita en los dos editores
 *  de rutina; vive aquí, junto al tipo, para que no puedan discrepar. */
export const LOAD_LABEL: Record<ExerciseLoad, string> = {
  none: 'Normal',
  weighted: 'Lastrado',
  assisted: 'Goma',
};

export const LOAD_TYPES: ExerciseLoad[] = ['none', 'weighted', 'assisted'];

/** Deriva la carga admitiendo datos antiguos (band = asistido con goma). */
export function resolveLoad(x: { load?: ExerciseLoad; band?: boolean }): ExerciseLoad {
  if (x.load) return x.load;
  return x.band ? 'assisted' : 'none';
}

export interface Exercise {
  id: string;
  trainerId: string;
  name: string;
  /** Categoría del ejercicio. Por defecto una de MUSCLE_GROUPS, pero el coach
   * puede crear las suyas propias, así que es texto libre. */
  muscleGroup: string;
  description?: string;
  videoUrl?: string;
  /** 'reps' (por defecto) o 'seconds' para isométricos (planchas, L-sit...). */
  measure?: ExerciseMeasure;
  /** Carga: normal / lastrado / asistido con goma. */
  load?: ExerciseLoad;
  /** (Obsoleto) se conserva por compatibilidad; equivale a load='assisted'. */
  band?: boolean;
  /**
   * Músculos que trabaja el ejercicio (para colorear el cuerpo anatómico). Si
   * está definido, tiene prioridad sobre la clasificación automática por nombre.
   * Se hereda de la plantilla UDECA al importar el pack.
   */
  muscles?: MuscleId[];
  /**
   * Cuánto trabaja cada músculo, en porcentaje (25/50/75/100). Lo fija el
   * admin en la plantilla y viaja con el pack; el cuerpo anatómico colorea de
   * transparente a rojo intenso según este valor. Si falta, cada músculo de
   * `muscles` cuenta al 100 % (comportamiento anterior).
   */
  muscleWeights?: Partial<Record<MuscleId, number>>;
  /** Subgrupo dentro de su categoría (opcional). */
  subgroup?: string;
  createdAt: number;
}

/**
 * Tipo de agarre. NO es una propiedad del ejercicio, sino de cómo se programa
 * en un plan concreto: las mismas dominadas son prono un día y supinas otro, y
 * fijarlo en la biblioteca obligaba a duplicar el ejercicio para cada agarre.
 * Por eso vive en `RoutineExercise` y se elige al montar el plan.
 */
export type GripType = 'prone' | 'neutral' | 'supine';

export const GRIP_TYPES: GripType[] = ['prone', 'neutral', 'supine'];

export const GRIP_LABEL: Record<GripType, string> = {
  prone: 'Prono',
  neutral: 'Neutro',
  supine: 'Supino',
};

/**
 * Plantilla maestra de ejercicios de UDECA. La edita SOLO el admin (CEO) y
 * cualquier entrenador nuevo puede precargarla en su biblioteca. Cada ejercicio
 * define qué músculos trabaja para el gráfico del cuerpo anatómico.
 */
export interface TemplateExercise {
  id: string;
  name: string;
  /** Categoría (una de MUSCLE_GROUPS o libre). */
  muscleGroup: string;
  description?: string;
  videoUrl?: string;
  measure?: ExerciseMeasure;
  /** Músculos que trabaja (alimenta el cuerpo anatómico). */
  muscles?: MuscleId[];
  /** Porcentaje de trabajo por músculo (25/50/75/100); ver Exercise. */
  muscleWeights?: Partial<Record<MuscleId, number>>;
  /** Subgrupo dentro de su categoría (viaja con el pack). */
  subgroup?: string;
  /** Orden de aparición en la lista (menor primero). */
  order?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Series en CLÚSTER: la serie no se hace de un tirón, sino en bloques cortos
 * separados por un descanso muy breve (10-20 s). Con 3+3+3 y 15 s de pausa se
 * acumulan más repeticiones de calidad que con una serie seguida al fallo, y
 * por eso es una herramienta distinta del EMOM: allí manda el reloj, aquí la
 * pausa mínima entre bloques.
 *
 * No es una medida del ejercicio (`ExerciseMeasure`) sino una forma de
 * programarlo, así que vive en el plan: las mismas dominadas son en clúster un
 * día y normales al siguiente.
 */
export interface ClusterConfig {
  /** Bloques dentro de cada serie (mínimo 2). */
  blocks: number;
  /** Descanso entre bloques, en segundos. */
  restSeconds: number;
}

export const CLUSTER_DEFAULT: ClusterConfig = { blocks: 2, restSeconds: 15 };

/** Bloques reales de un clúster (nunca menos de 2: si no, no es un clúster). */
export function clusterBlocks(c?: ClusterConfig | null): number {
  if (!c) return 1;
  return Math.max(2, Math.min(10, Math.round(c.blocks || 2)));
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  /** Objetivo por serie: repeticiones o segundos según `measure`. */
  reps: string;
  /**
   * Aguante objetivo por serie, en segundos. Solo lo usan los ejercicios
   * 'combo', donde `reps` marca las repeticiones y esto el isométrico.
   */
  seconds?: string;
  /**
   * Objetivo del SEGUNDO lado en los ejercicios por lados ('repsDual' y
   * 'secondsDual'): `reps` es el lado izquierdo y esto el derecho. Va en un
   * campo propio y no reutiliza `seconds` porque ahí guardar repeticiones
   * sería mentir sobre lo que contiene.
   */
  side2?: string;
  restSeconds?: number;
  notes?: string;
  /** true = se hace en superserie encadenado con el ejercicio anterior. */
  supersetWithPrevious?: boolean;
  /** Copia de la medida del ejercicio al añadirlo ('reps' por defecto). */
  measure?: ExerciseMeasure;
  /**
   * Categoría del ejercicio (Empuje, Tirón, Core…), copiada de la biblioteca al
   * añadirlo o elegida a mano por el atleta, que no tiene biblioteca.
   *
   * Sin esto, todo lo que reparte el trabajo por grupos —el mapa muscular, las
   * series semanales, el reparto del informe— se quedaba vacío para quien monta
   * su plan escribiendo los nombres, que es justo lo que hace el atleta.
   */
  muscleGroup?: string;
  /** Subgrupo dentro de la categoría ("Accesorios", "Aguantes"…), si lo tiene. */
  subgroup?: string;
  /** Copia de la carga del ejercicio al añadirlo. */
  load?: ExerciseLoad;
  /** (Obsoleto) copia del uso de goma; equivale a load='assisted'. */
  band?: boolean;
  /** RIR objetivo (repeticiones en reserva), 0-5. */
  rir?: number;
  /**
   * Agarre con el que se hace ESTE ejercicio en ESTE día del plan (prono,
   * neutro o supino). Lo elige el entrenador al montar el plan, no al crear el
   * ejercicio: así unas dominadas sirven para los tres agarres.
   */
  grip?: GripType;
  /**
   * Objetivo del coach para este ejercicio (opcional): reps o segundos a
   * alcanzar según su medida (p. ej. "20" reps o "60" seg de aguante).
   */
  goal?: string;
  /**
   * Series en clúster: bloques con una pausa mínima entre ellos. Sin esto, la
   * serie es normal.
   */
  cluster?: ClusterConfig;
}

export interface RoutineDay {
  id: string;
  name: string;
  /** Día de la semana asignado (0=lunes ... 6=domingo). Sin valor = flexible. */
  weekday?: number;
  /** En el Método REIN TENA (ciclo), marca este día del ciclo como descanso. */
  isRest?: boolean;
  /**
   * Método REIN TENA: descanso OPCIONAL (p. ej. el Día 7). El alumno decide
   * cada vez: descansar ese día o reiniciar el ciclo entrenando el Día 1.
   * A efectos de programación cuenta como descanso (implica isRest).
   */
  optionalRest?: boolean;
  /** Intensidad 1-10 de este entrenamiento (Método REIN TENA), la fija el coach. */
  intensity?: number;
  /**
   * Intensidad en PORCENTAJE para el modo Sensaciones, la fija el coach.
   *
   * Va aparte del 1-10 a propósito. En un ciclo, la intensidad es la del día
   * que toca y se lee en la escala del Método REIN TENA. En Sensaciones no hay
   * "día que toca": hay varias rutinas y el alumno elige según cómo se
   * encuentre, así que lo que necesita saber antes de elegir es cuánto le va a
   * pedir cada una. Un porcentaje se compara de un vistazo ("hoy no estoy para
   * el 90 %") de una forma que un 9/10 no consigue.
   */
  intensityPct?: number;
  /**
   * En Sensaciones, esta "rutina" no es una sesión: es un día de grease the
   * groove, series sueltas repartidas por todo el día y ninguna al fallo.
   *
   * Se marca por día y no por rutina entera porque en Sensaciones conviven
   * varias formas de entrenar y el alumno elige una cada mañana: el día que no
   * tiene cuerpo para una sesión puede hacer seis dominadas fáciles repartidas
   * en vez de no hacer nada.
   */
  gtg?: boolean;
  /** Solo con `gtg`: series al día de ESTE día. Sin valor, las de la rutina. */
  gtgSetsPerDay?: number;
  /** El coach activa el temporizador de intervalos (EMOM) para este día. */
  showIntervalTimer?: boolean;
  /**
   * Texto de las "aproximaciones" del calentamiento para este día, editable por
   * el coach (paso 3 del calentamiento). Vacío = usa el texto por defecto.
   */
  approachesNote?: string;
  exercises: RoutineExercise[];
}

/**
 * Cómo se programa una rutina:
 *  - 'weekly': cada día se asigna a un día de la semana (lun/mié/vie...).
 *  - 'cycle' (Método REIN TENA): los días rotan en un ciclo constante
 *    (Día 1 → 2 → 3 → ... → repite) independientemente del día de la semana.
 */
/**
 * Cómo se programa una rutina. Son TRES:
 *
 *  - 'weekly': cada rutina se ata a un día de la semana.
 *  - 'cycle': las rutinas rotan en bucle, sin mirar el calendario.
 *  - 'flex': el plan PERSONALIZADO. El entrenador monta varias rutinas y el
 *    alumno elige cuál hace cada día; y además el entrenador decide cómo
 *    funciona el plan por dentro (ver lib/planPersonalizado.ts).
 *
 * 'gtg' ES HERENCIA Y YA NO SE PUEDE ELEGIR. Grease the groove seguía siendo
 * un cuarto modo de plan entero, y no le pegaba: es una forma de entrenar UN
 * día, no una programación. Donde vive ahora es donde tiene sentido — marcando
 * un día suelto dentro del plan personalizado (`RoutineDay.gtg`), y en la
 * rutina diaria de cada alumno, que es suya y va aparte.
 *
 * El valor se queda escrito aquí porque el código que lo lee tiene que seguir
 * entendiéndolo: una rutina guardada con él no puede dejar de funcionar por
 * haber quitado un botón.
 */
export type RoutineSchedule = 'weekly' | 'cycle' | 'flex' | 'gtg';

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const WEEKDAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/** Índice de día de la semana con lunes=0 (JS usa domingo=0). */
export function weekdayOf(when: number | Date): number {
  const d = (typeof when === 'number' ? new Date(when) : when).getDay();
  return d === 0 ? 6 : d - 1;
}

/** El de hoy. */
export function todayWeekday(): number {
  return weekdayOf(Date.now());
}

export interface Routine {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  active: boolean;
  days: RoutineDay[];
  /** Modo de programación ('weekly' por defecto). */
  schedule?: RoutineSchedule;
  /**
   * Nombre del modo 'flex' que el coach muestra al alumno (p. ej.
   * "Sensaciones"): el alumno elige qué rutina hacer cada día según se sienta.
   */
  scheduleLabel?: string;
  /** Método REIN TENA: fecha (medianoche) en que el ciclo empieza por el Día 1. */
  cycleStartDate?: number;
  /**
   * Cuándo puso el coach esa fecha.
   *
   * Sin esto no hay forma de saber si la fecha del coach es más nueva que lo
   * que el alumno haya decidido por su cuenta, y la app tenía que adivinarlo
   * comparando las dos fechas: ganaba la más grande, así que un coach que
   * programase el plan "para el lunes que viene" dejaba una fecha futura que
   * tumbaba cualquier reinicio del alumno para siempre.
   *
   * Solo se escribe cuando la fecha CAMBIA. Guardar la rutina para corregir un
   * ejercicio no puede robarle al alumno el día que él había fijado.
   */
  cycleStartDateSetAt?: number;
  /**
   * Solo en 'gtg': series que se buscan AL DÍA, repartidas. Sin valor, las de
   * por defecto (ver lib/gtg.ts).
   */
  gtgSetsPerDay?: number;
  /**
   * Cómo funciona por dentro este plan, si es el PERSONALIZADO ('flex').
   *
   * La escala con la que se mide el esfuerzo, cuándo se pregunta, qué ve el
   * alumno antes de elegir rutina, cómo se llaman las cosas y qué puede tocar
   * mientras entrena. Sin esto puesto, el plan se comporta como se ha
   * comportado siempre: ver POR_DEFECTO en lib/planPersonalizado.ts.
   */
  personalizado?: PlanPersonalizado;
  /** (Obsoleto) intensidad global; ahora se define por día en RoutineDay. */
  intensity?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Plantilla de rutina reutilizable del entrenador: guarda la estructura de
 * días/ejercicios para aplicarla a cualquier alumno con un toque, sin rehacerla.
 */
export interface RoutineTemplate {
  id: string;
  trainerId: string;
  name: string;
  schedule?: RoutineSchedule;
  scheduleLabel?: string;
  cycleStartDate?: number;
  gtgSetsPerDay?: number;
  /**
   * La configuración del plan personalizado, para que una plantilla traiga
   * también la FORMA de trabajar y no solo los ejercicios. Es justo lo que un
   * entrenador no quiere volver a montar alumno por alumno.
   */
  personalizado?: PlanPersonalizado;
  days: RoutineDay[];
  createdAt: number;
}

/**
 * Ciclos de entrenamiento (planificación). Los tres niveles son OPCIONALES e
 * independientes: el coach decide si usa alguno, y cuáles, para cada alumno.
 * Un ciclo es solo un contenedor con fechas; las estadísticas se derivan de
 * los entrenos que el alumno registra dentro de ese rango. Si el coach no crea
 * ninguno, la app funciona exactamente igual que ahora.
 */
export type CycleLevel = 'macro' | 'meso' | 'micro';

export const CYCLE_LEVEL_LABEL: Record<CycleLevel, string> = {
  macro: 'Macrociclo',
  meso: 'Mesociclo',
  micro: 'Microciclo',
};

/** Semanas por defecto que dura cada nivel al crearlo (editable). */
export const CYCLE_DEFAULT_WEEKS: Record<CycleLevel, number> = {
  macro: 12,
  meso: 4,
  micro: 1,
};

/** Ajuste de un ejercicio para una semana concreta. */
export interface WeekPlanEntry {
  exerciseId: string;
  sets?: number;
  /** Objetivo por serie, con el mismo formato que la rutina ("8", "8-12"). */
  reps?: string;
  /** RIR objetivo de la semana. */
  rir?: number;
}

/**
 * Un objetivo medible del ciclo: un ejercicio y un número.
 *
 * "Dominadas, 12 repeticiones". "Planche tuck, 20 segundos". Nada de
 * porcentajes a mano ni de casillas que marcar: se compara con la mejor marca
 * que ya está apuntada, y se acabó.
 */
export interface ObjetivoDeCiclo {
  id: string;
  /** El ejercicio con el que se compara. Sin él no hay nada que medir. */
  ejercicioId: string;
  /** Cómo se llama, para no tener que buscarlo en la biblioteca al leerlo. */
  nombre: string;
  /** Qué se mide: repeticiones, segundos de aguante o kilos. */
  medida: 'reps' | 'seg' | 'kg';
  /** El número que se persigue. */
  meta: number;
}

export interface TrainingCycle {
  id: string;
  trainerId: string;
  clientId: string;
  level: CycleLevel;
  name: string;
  /**
   * Ciclo que lo contiene: un mesociclo cuelga de su macro, un microciclo de su
   * meso. Vacío = ciclo suelto. Es OPCIONAL a propósito: los ciclos creados a
   * mano (y todos los que ya existían) siguen funcionando sin padre.
   */
  parentId?: string;
  /** Posición dentro del padre (1 = primer bloque / primera semana). */
  orderIndex?: number;
  /** Fechas (medianoche). Opcionales: un ciclo puede quedar abierto. */
  startDate?: number;
  endDate?: number;
  /** Objetivo del ciclo (texto libre): la frase que explica el bloque. */
  goal?: string;
  /**
   * Los objetivos que se persiguen en este ciclo, medibles.
   *
   * Distinto de `goal`, que es una frase ("preparar la planche") y no se puede
   * comparar con nada. Estos son un ejercicio y un número, así que la app puede
   * decir cuánto falta — que es lo único que hace que un objetivo se mire dos
   * veces.
   *
   * Los pone el entrenador, o el propio atleta en su plan. Y el progreso sale
   * de las marcas que ya se apuntan al entrenar: un objetivo que hay que
   * actualizar a mano deja de estar actualizado la segunda semana, y entonces
   * miente, que es peor que no estar.
   */
  objetivos?: ObjetivoDeCiclo[];
  /** Notas privadas del coach. */
  notes?: string;
  /** Meta de sesiones para el % completado y avisos (opcional). */
  targetSessions?: number;
  /** Solo microciclo: semana de descarga (deload). */
  isDeload?: boolean;
  /**
   * Solo microciclo: qué cambia ESTA semana respecto a la rutina.
   *
   * La rutina sigue siendo la base (los ejercicios, el orden, los descansos);
   * aquí solo van los números que se mueven de una semana a otra, que es lo
   * que un entrenador escribía en su hoja: semana 1 a 4×8, semana 3 a 5×8.
   * Vacío = esta semana se hace la rutina tal cual.
   */
  weekPlan?: WeekPlanEntry[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Agenda del coach: tareas de negocio organizadas por horizonte (hoy / esta
 * semana / este mes) y objetivos de emprendimiento con progreso. Privadas del
 * entrenador; no tienen nada que ver con las rutinas de los alumnos.
 */
export type TaskScope = 'day' | 'week' | 'month' | 'goal';

export const TASK_SCOPE_LABEL: Record<TaskScope, string> = {
  day: 'Hoy',
  week: 'Semana',
  month: 'Mes',
  goal: 'Objetivos',
};

export interface CoachTask {
  id: string;
  trainerId: string;
  title: string;
  scope: TaskScope;
  done: boolean;
  doneAt?: number;
  /** Destacada (prioridad): sube arriba y se marca en oro. */
  flagged?: boolean;
  notes?: string;
  /** Solo objetivos: progreso 0-100. */
  progress?: number;
  /**
   * Solo tareas de día: fecha concreta en el calendario (00:00). Si falta, la
   * tarea se entiende "para hoy". El coach puede moverla a otro día.
   */
  dueDate?: number;
  /** Orden estable dentro de su lista (por defecto, momento de creación). */
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Pago registrado por el entrenador (para el historial de ingresos). */
export interface Payment {
  id: string;
  trainerId: string;
  clientId: string;
  amountEur: number;
  date: number;
  createdAt: number;
}

export interface LoggedSet {
  /**
   * Marca principal de la serie. En ejercicios por repeticiones (y en la parte
   * de repeticiones de un combo) son reps; en los isométricos, segundos.
   */
  reps: string;
  /** Aguante en segundos de la serie. Solo lo usan los ejercicios 'combo'. */
  seconds?: string;
  /** Marca del segundo lado (derecho) en los ejercicios por lados. */
  side2?: string;
  /**
   * Marcas de los bloques SIGUIENTES de una serie en clúster; el primero va en
   * `reps`. Se guarda así, y no como una lista completa, para que todo lo que
   * ya lee `reps` (récords, tabla de progreso, informes) siga funcionando sin
   * enterarse de que existen los clústeres.
   */
  clusters?: string[];
  weight?: string;
  completed: boolean;
}

/**
 * Todas las marcas apuntadas en una serie: la principal y, si fue en clúster,
 * la de cada bloque. Vacías fuera.
 */
export function setMarks(set: { reps: string; clusters?: string[] }): string[] {
  return [set.reps, ...(set.clusters ?? [])].filter((m) => String(m ?? '').trim() !== '');
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  notes?: string;
  /**
   * Repeticiones que quedaron en recámara (RIR), 0 = al fallo.
   *
   * Va por EJERCICIO y no por serie a propósito: por serie es lo que hace un
   * laboratorio, por ejercicio es lo que un entrenador usa de verdad, y es un
   * toque en vez de cuatro. Cada pregunta en mitad de una serie se paga en
   * abandono, así que solo se pide a quien sabe contestarla (ver
   * `UserProfile.trackRir`).
   */
  rir?: number;
  /**
   * Lo apuntado cuando el plan mide el esfuerzo con OTRA escala.
   *
   * En un plan personalizado el entrenador puede medir en porcentaje o con sus
   * propias etiquetas (A/B/C, suave/medio/duro). Eso no cabe en `rir`, que es
   * un número de repeticiones, y meterlo ahí haría falsas todas las medias que
   * lo leen. Así que se guarda aparte y con su escala al lado: sin saber en qué
   * unidades está, un "80" no significa nada.
   *
   * Con escala 'rir' se guardan LAS DOS COSAS: aquí para saber cómo se
   * preguntó, y en `rir` para que todo lo que ya lo leía siga funcionando.
   */
  esfuerzo?: EsfuerzoApuntado;
  /** El ejercicio lo saltó el alumno (solo si su plan se lo permite). */
  saltado?: boolean;
  /** Cómo se midió (reps o segundos), para mostrar el histórico con su unidad. */
  measure?: ExerciseMeasure;
  /** Carga del ejercicio en su momento (normal/lastrado/asistido). */
  load?: ExerciseLoad;
}

export interface WorkoutLog {
  id: string;
  trainerId: string;
  clientId: string;
  routineId: string;
  routineName: string;
  dayName: string;
  date: number;
  exercises: LoggedExercise[];
  feedback?: string;
  /**
   * El esfuerzo de la SESIÓN ENTERA, cuando el plan personalizado pregunta una
   * sola vez al terminar en vez de ejercicio por ejercicio.
   *
   * Son dos preguntas distintas y por eso son dos campos: "cómo ha ido este
   * ejercicio" y "cómo ha ido el día". Meter la del día en el último ejercicio
   * sería falsear el histórico de ese ejercicio para siempre.
   */
  esfuerzo?: EsfuerzoApuntado;
  /** Duración de la sesión en minutos (desde la primera serie completada). */
  durationMin?: number;
  createdAt: number;
}

export interface WeightLog {
  id: string;
  trainerId: string;
  clientId: string;
  date: number;
  weightKg: number;
  notes?: string;
  createdAt: number;
}

export interface NutritionPlan {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  active: boolean;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Una foto dentro de una libreta de comida del entrenador. */
export interface MealBookPhoto {
  id: string;
  /** Foto (data URL comprimida). */
  imageURL: string;
  /** Pie de foto opcional (nombre del plato, ingredientes...). */
  caption?: string;
}

/**
 * "Libreta" / cuaderno de comidas que el entrenador sube UNA vez y comparten
 * TODOS sus alumnos (recetas, ejemplos de platos por foto). Se ve dentro de la
 * app, al final de la sección de nutrición del alumno.
 */
export interface MealBook {
  id: string;
  trainerId: string;
  title: string;
  photos: MealBookPhoto[];
  /**
   * Posición en la lista (menor primero). Las libretas creadas antes de que
   * existiera este campo no lo tienen: se ordenan por fecha de creación, que
   * es justo el orden que tenían hasta ahora.
   */
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MealLog {
  id: string;
  trainerId: string;
  clientId: string;
  date: number;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
  createdAt: number;
}

/**
 * Documento público (por cliente) con métricas no sensibles para el ranking
 * social del coaching. Se guarda aparte del perfil para no exponer datos
 * privados (email, peso, medidas) al resto de miembros.
 */
export interface SocialStats {
  uid: string;
  trainerId: string;
  name: string;
  photoURL?: string;
  level?: ExperienceLevel;
  currentStreak: number;
  sessionsThisWeek: number;
  totalWorkouts: number;
  /** Racha en curso DENTRO del mes actual (se reinicia cada mes). */
  streakThisMonth?: number;
  /** Entrenos registrados en el mes actual (se reinicia cada mes). */
  workoutsThisMonth?: number;
  /** Mejor racha lograda el MES ANTERIOR (para el podio del cambio de mes). */
  lastMonthStreak?: number;
  /**
   * Marcas superadas ESTE mes: es lo que ordena la clasificación (ver
   * lib/marcas.ts). Sustituye a la racha de días, que premiaba aparecer en vez
   * de mejorar y se rompía sola con una gripe.
   */
  prsThisMonth?: number;
  /** Marcas superadas el MES ANTERIOR, para el podio del cambio de mes. */
  lastMonthPrs?: number;
  /** Clave "YYYY-MM" del mes en que se sincronizaron las métricas mensuales. */
  monthKey?: string;
  /**
   * Marca (lunes 00:00) de la semana en que se sincronizaron las métricas
   * semanales. Si no es la semana en curso, `sessionsThisWeek` se muestra a 0.
   */
  weekKey?: string;
  /** Último récord personal (para el tablón de récords del grupo). */
  lastPR?: { exerciseName: string; label: string; date: number };
  /** Última vez con la app abierta (presencia "en línea" para el coach). */
  lastSeen?: number;
  updatedAt: number;
}

/**
 * Solicitud de un alumno para unirse al grupo de un entrenador. Se crea al
 * introducir el código; el entrenador la aprueba manualmente (ve nombre,
 * correo y foto). El id es `${clientId}_${trainerId}` (una por par).
 */
export interface JoinRequest {
  id: string;
  trainerId: string;
  clientId: string;
  /** Datos del alumno mostrados al entrenador para decidir. */
  name: string;
  email: string;
  photoURL?: string;
  createdAt: number;
}

/** Hábito diario asignado por el entrenador a un alumno. */
export interface Habit {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  createdAt: number;
}

/**
 * LA RUTINA DIARIA: lo que se hace TODOS los días, aparte del plan.
 *
 * El pino, la movilidad, los estiramientos de la cadera. Cosas que no son "el
 * entreno del martes" sino algo corto que se repite a diario y que, precisamente
 * por repetirse, es lo que más cambia a alguien en seis meses.
 *
 * POR QUÉ NO ES UNA RUTINA NORMAL
 *
 * Una rutina normal tiene días, y cada día toca o no toca. Esto toca siempre.
 * Meterlo en el plan obligaría a copiar los mismos ejercicios en los siete días
 * y a que el alumno los viera mezclados con su sesión, compitiendo con ella.
 * Va aparte y se ve aparte.
 *
 * POR QUÉ NO ES UN HÁBITO
 *
 * Los hábitos ya existen y son una lista de frases que se marcan ("beber 2 L").
 * Esto son EJERCICIOS: llevan un objetivo por sesión —tres series de treinta
 * segundos— y quien los pone es el entrenador pensando en entrenamiento, no en
 * costumbres.
 *
 * ES COMO EL GREASE THE GROOVE, PERO AL LADO
 *
 * La idea es la misma —poco, fácil y a menudo— con una diferencia que importa:
 * el grease the groove SUSTITUYE al entreno del día y esto lo ACOMPAÑA.
 */
export interface EjercicioDiario {
  id: string;
  /** Cómo se llama. Lo escribe el entrenador; no hace falta que esté en la biblioteca. */
  nombre: string;
  /**
   * De qué ejercicio de la biblioteca salió, si salió de una.
   *
   * Se puede seguir escribiendo el nombre a mano —hay cosas que no están en la
   * biblioteca y no merecen estarlo—, y entonces esto va vacío. Cuando sí viene
   * de la biblioteca, guardar de cuál permite dos cosas: traerse su vídeo de una
   * vez, y que al corregir el ejercicio en la biblioteca se corrija también
   * aquí, sin tener que quitarlo y volverlo a poner.
   */
  exerciseId?: string;
  /**
   * Qué hay que hacer, en una línea: "3 series de 30 s", "5 × 5", "2 min".
   *
   * Texto libre y no números sueltos a propósito: aquí caben cosas que no son
   * series por repeticiones —un aguante, unos minutos de movilidad, "hasta que
   * deje de tirar"— y encajarlas en campos numéricos obligaría a mentir.
   */
  objetivo: string;
  /**
   * Cuántas series al día, si se quiere contarlas.
   *
   * Es lo que separa esto de una lista de tareas: en el grease the groove no se
   * hacen las cinco series seguidas, se reparten por el día. Con un número
   * aquí, el alumno va marcando de una en una y sabe cuántas le quedan; sin él,
   * el ejercicio se marca entero de un toque, como hasta ahora.
   *
   * Sin poner es exactamente eso: SIN PONER. No es "una serie" disfrazado de
   * vacío, porque hay ejercicios —dos minutos de movilidad— que no se cuentan
   * por series y obligarles a llevar un 1 sería inventarse un dato.
   */
  series?: number;
  /**
   * Enlace al vídeo de la técnica (YouTube o Vimeo).
   *
   * El mismo campo que los ejercicios del plan, y se abre con el mismo visor:
   * un pino mal hecho cien días seguidos es cien días haciéndolo mal, así que
   * de todos los ejercicios de la app estos son de los que más falta les hace
   * poder mirar cómo se hacen.
   */
  video?: string;
}

export interface RutinaDiaria {
  /** El id ES el del alumno: una rutina diaria por alumno, ni más ni menos. */
  id: string;
  trainerId: string;
  clientId: string;
  /** Apagada, no se le enseña nada al alumno. Se apaga sin perder los ejercicios. */
  activa: boolean;
  /** Cómo la llama el entrenador. Lo ve el alumno. */
  nombre: string;
  ejercicios: EjercicioDiario[];
  updatedAt: number;
}

/** Lo hecho de la rutina diaria en un día concreto (medianoche local). */
export interface DiaDeRutinaDiaria {
  /** `${clientId}_${aaaa-mm-dd}`. */
  id: string;
  clientId: string;
  trainerId?: string;
  /** Día al que corresponde, a medianoche. */
  date: number;
  /** Ids de los ejercicios ya hechos hoy. */
  hechos: string[];
  updatedAt: number;
}

/** Registro de un hábito cumplido en un día concreto (medianoche local). */
export interface HabitLog {
  id: string;
  trainerId: string;
  clientId: string;
  habitId: string;
  /** Día al que corresponde (timestamp a medianoche). */
  day: number;
  createdAt: number;
}

/**
 * Lo que comparten una lección y una mini clase: un vídeo (o un PDF) con su
 * miniatura y su duración.
 *
 * Están separadas y no es lo mismo un tipo que otro a propósito. Una mini
 * clase no puede llevar mini clases dentro: el anidamiento sin fondo es fácil
 * de escribir y imposible de recorrer para el alumno, que acaba sin saber
 * dónde está. Un nivel, y que lo imponga el tipo en vez de una costumbre.
 */
export interface ContenidoDeCurso {
  id: string;
  title: string;
  /** Tipo de contenido: vídeo (por defecto) o e-book/PDF. */
  kind?: 'video' | 'pdf';
  /** URL del vídeo (Firebase Storage, Vimeo privado, etc.). Puede estar vacío. */
  videoUrl?: string;
  /** E-book/PDF de apoyo (enlace a Drive, Dropbox...); se ve dentro de la app. */
  pdfUrl?: string;
  /**
   * Duración tal y como la escribe el entrenador ("12 min", "1 h 05").
   *
   * No se saca del vídeo a propósito: la mitad están en Vimeo privado o
   * detrás de un enlace que la app no puede interrogar sin descargarlo, y una
   * duración a veces sí y a veces no es peor que una escrita a mano siempre.
   */
  durationLabel?: string;
  /**
   * Solo para los alumnos VIP (ver lib/vip.ts).
   *
   * Va en el CONTENIDO y no en el curso porque lo normal es un curso con casi
   * todo abierto y unas cuantas clases del plan de arriba: dos cursos gemelos
   * para eso serían dos cursos que mantener a la vez.
   */
  vip?: boolean;
}

/**
 * Una mini clase NO lleva miniatura propia: se usa la de la plataforma donde
 * está el vídeo (ver lib/video.ts).
 *
 * Un curso entero vive en UN documento de Firestore y cada miniatura subida va
 * dentro, en base64. Con tres mini clases por lección, las fotos se comían el
 * documento antes que el contenido. La lección sí la lleva, porque es la que
 * se enseña en la lista y la que merece una portada elegida.
 */
export interface MiniClase extends ContenidoDeCurso {}

export interface Lesson extends ContenidoDeCurso {
  /** Portada de la lección. Sin ella se usa la de la plataforma del vídeo. */
  thumbURL?: string;
  description?: string;
  /**
   * Candado por antigüedad: días que el alumno debe llevar en el grupo para
   * desbloquear esta lección. Vacío/0 = disponible desde el primer día.
   */
  unlockAfterDays?: number;
  /**
   * Mini clases dentro de la lección, en su orden.
   *
   * Solo existen si el entrenador las crea. Una lección puede tener su propio
   * vídeo, tener mini clases, o las dos cosas: hay cursos donde la lección es
   * la explicación y las mini clases los ejercicios sueltos.
   */
  minis?: MiniClase[];
}

export interface CourseSection {
  id: string;
  title: string;
  /** Portada de la sección (data URL comprimida), opcional. */
  coverURL?: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  trainerId: string;
  title: string;
  description?: string;
  coverURL?: string;
  /** Solo los cursos publicados son visibles para los alumnos. */
  published: boolean;
  /** Posición del curso en la lista (el coach los reordena). */
  order?: number;
  sections: CourseSection[];
  createdAt: number;
  updatedAt: number;
}

export type PhotoPose = 'front' | 'side' | 'back';

export const PHOTO_POSES: { key: PhotoPose; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'side', label: 'Perfil' },
  { key: 'back', label: 'Espalda' },
];

export interface ProgressPhoto {
  id: string;
  trainerId: string;
  clientId: string;
  pose: PhotoPose;
  imageURL: string;
  date: number;
  createdAt: number;
}
