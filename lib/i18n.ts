/**
 * La app en inglés.
 *
 * LA CLAVE ES EL TEXTO EN ESPAÑOL
 *
 * `t('Mi entrenamiento')` devuelve "My training" en inglés y, si esa frase
 * todavía no está traducida, devuelve la propia frase en español. Es feo de
 * mirar en el código y es lo correcto aquí por dos motivos:
 *
 *  - La app ya está escrita en español, en treinta pantallas. Con claves
 *    inventadas (`workout.title`) habría que tocar las treinta a la vez o
 *    dejar media app enseñando "workout.title" a los usuarios. Con el español
 *    como clave, una pantalla sin traducir sigue estando perfecta en español.
 *  - Una traducción que falta NUNCA deja un hueco en blanco ni un identificador
 *    a la vista. Lo peor que puede pasar es que a un inglés le salga una frase
 *    en español, que es exactamente lo que le pasaba antes con la app entera.
 *
 * De ahí que traducir sea incremental de verdad: se añade la frase al
 * diccionario y queda traducida en todos los sitios donde se use, sin tocar
 * ninguna pantalla.
 *
 * LO QUE AÚN NO CUBRE
 *
 * Las fechas se siguen escribiendo en español (lib/fechas.ts). Cambiarlas pide
 * pasarle el idioma a todas las funciones de fecha de la app, y prefiero que
 * eso vaya en su propio cambio antes que a medias.
 */

export type Idioma = 'es' | 'en';

export const IDIOMAS: { valor: Idioma; texto: string }[] = [
  { valor: 'es', texto: 'Español' },
  { valor: 'en', texto: 'English' },
];

/**
 * El diccionario. La clave es la frase en español, tal cual está en el código.
 *
 * Cuando el mismo español necesite dos ingleses distintos según el sitio (no
 * ha pasado todavía), lo que toca es cambiar el español de uno de los dos: si
 * dos frases del producto dicen lo mismo y significan cosas distintas, el
 * problema es del español, no de la traducción.
 */
export const EN: Record<string, string> = {
  // --- Entrar y crear cuenta ---
  'Iniciar sesión': 'Sign in',
  'Crear cuenta': 'Create account',
  'Correo electrónico': 'Email',
  Contraseña: 'Password',
  'Repetir contraseña': 'Repeat password',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
  'Continuar con Google': 'Continue with Google',
  'Usar otra cuenta': 'Use another account',
  'Cuentas guardadas': 'Saved accounts',
  '¿Has olvidado tu contraseña?': 'Forgot your password?',
  '¿No tienes cuenta?': "Don't have an account?",
  Regístrate: 'Sign up',
  'Entrar con otra cuenta': 'Use a different account',
  'Nombre completo': 'Full name',
  'Ya tengo cuenta': 'I already have an account',
  Alumno: 'Student',
  Atleta: 'Athlete',
  Entrenador: 'Coach',
  Formación: 'Course',
  'Código de invitación': 'Invite code',

  // --- Barra de pestañas ---
  Inicio: 'Home',
  Entreno: 'Training',
  Cursos: 'Courses',
  Nutrición: 'Nutrition',
  Progreso: 'Progress',
  Social: 'Community',
  Perfil: 'Profile',
  Clientes: 'Clients',
  Ejercicios: 'Exercises',

  // --- Entrenar ---
  'Mi entrenamiento': 'My training',
  'Terminar entreno': 'Finish workout',
  'Terminar sesión': 'Finish session',
  'Seguir entrenando': 'Keep training',
  'Estás entrenando': "You're training",
  Calentamiento: 'Warm-up',
  'Añadir serie': 'Add set',
  'Quitar serie': 'Remove set',
  'Añadir nota': 'Add note',
  Anterior: 'Previous',
  Siguiente: 'Next',
  Series: 'Sets',
  Repeticiones: 'Reps',
  Isométricos: 'Holds',
  Volumen: 'Volume',
  Duración: 'Duration',
  Descanso: 'Rest',
  'Día de descanso': 'Rest day',
  'Volver a inicio': 'Back to home',
  'Sin rutina asignada': 'No routine assigned',
  '¡Entrenamiento completado!': 'Workout complete!',
  'Registrar un entreno de otro día': 'Log a workout from another day',
  'Registrar un entreno': 'Log a workout',
  '¿Qué día fue?': 'Which day was it?',
  '¿Qué entrenaste?': 'What did you train?',
  Hoy: 'Today',
  Ayer: 'Yesterday',
  'Series de hoy': "Today's sets",
  'Apuntar serie': 'Log set',
  'Quitar la última': 'Remove the last one',
  'Añadir un ejercicio': 'Add an exercise',
  'Añadir un ejercicio a esta sesión': 'Add an exercise to this session',
  'Grease the groove': 'Grease the groove',

  // --- Nutrición ---
  'Mi nutrición': 'My nutrition',
  'Pasos de hoy': "Today's steps",
  'Traer los pasos del móvil': 'Get steps from your phone',
  'Apuntar a mano': 'Enter manually',
  'Comidas de hoy': "Today's meals",
  'Calcular mis macros': 'Calculate my macros',
  'Fotos de progreso': 'Progress photos',
  Calorías: 'Calories',
  Proteína: 'Protein',
  Carbohidratos: 'Carbs',
  Grasas: 'Fats',

  // --- Progreso ---
  'Mi progreso': 'My progress',
  Entrenos: 'Workouts',
  Peso: 'Weight',
  Logros: 'Achievements',
  'Aún no hay entrenamientos': 'No workouts yet',
  'Registrar peso': 'Log weight',

  // --- Planificación ---
  'Mi temporada': 'My season',
  'Nueva temporada': 'New season',
  'Bloque suelto': 'Standalone block',
  Planificación: 'Planning',
  'Sin planificar': 'Not planned yet',
  Semana: 'Week',
  Macrociclo: 'Macrocycle',
  Mesociclo: 'Mesocycle',
  Microciclo: 'Microcycle',

  // --- Cursos ---
  Academia: 'Academy',
  'Contenido privado · solo para miembros': 'Private content · members only',
  'Marcar como vista': 'Mark as watched',
  'Quitar de vistas': 'Mark as not watched',
  'Curso completado': 'Course completed',
  'Este curso aún no tiene lecciones': 'This course has no lessons yet',

  // --- Perfil y ajustes ---
  'Mi plan de entreno': 'My training plan',
  'Compartir mi carné': 'Share my member card',
  'Cerrar sesión': 'Sign out',
  Idioma: 'Language',
  Guardar: 'Save',
  'Guardar cambios': 'Save changes',
  Cancelar: 'Cancel',
  Volver: 'Back',
  Eliminar: 'Delete',
  Editar: 'Edit',
  Añadir: 'Add',
  Cerrar: 'Close',
  Aceptar: 'OK',

  // --- Frases de estado que se repiten ---
  'No se pudo guardar': "Couldn't save",
  'Inténtalo de nuevo': 'Try again',
  'Sin conexión': 'No connection',
  Cargando: 'Loading',
  'Sin datos todavía': 'No data yet',

  // --- Entrar, registrarse y completar el perfil ---
  'Tu nombre': 'Your name',
  'Ya casi': 'Almost there',
  '¿Cómo entrenas?': 'How do you train?',
  'Nombre y apellido': 'First and last name',
  'Código de tu entrenador': "Your coach's code",
  'Ej. AB12CD': 'e.g. AB12CD',
  'Crear mi cuenta': 'Create my account',
  'Bienvenido de nuevo': 'Welcome back',
  'Un paso y ya está': "One step and you're in",
  'Entra y sigue con tu entrenamiento': 'Sign in and pick up your training',
  'Entrar como': 'Sign in as',
  'No se puede entrar desde este dispositivo. Prueba desde el navegador en app.udeca.app.':
    "You can't sign in from this device. Try from your browser at app.udeca.app.",
  'Al entrar aceptas los términos y la política de privacidad de UDECA.':
    "By signing in you accept UDECA's terms and privacy policy.",
  'Unir mi cuenta': 'Link my account',
  'Crea tu cuenta': 'Create your account',
  'En un toque. Sin contraseñas que recordar.': 'One tap. No passwords to remember.',
  'No se puede crear la cuenta desde este dispositivo. Prueba desde el navegador en app.udeca.app.':
    "You can't create an account from this device. Try from your browser at app.udeca.app.",
  'Al crear tu cuenta aceptas los términos y la política de privacidad de UDECA.':
    "By creating your account you accept UDECA's terms and privacy policy.",
  'Puedes entrar como': 'You can sign in as',
  'Lo eliges al terminar de entrar.': "You'll choose that once you're in.",
  '¿Ya tienes cuenta?': 'Already have an account?',
  Entrar: 'Sign in',
  'Registrarme con Google': 'Sign up with Google',
  'Registrarme con Apple': 'Sign up with Apple',
  Saltar: 'Skip',

  // --- Cursos del alumno ---
  'Documento no disponible': 'Document not available',
  'E-book de la lección': 'Lesson e-book',
  'Captura detectada': 'Screenshot detected',
  'Curso no encontrado': 'Course not found',
  vistas: 'watched',
  'Seguir viendo la clase': 'Keep watching the lesson',
  'No se pudo guardar. Inténtalo de nuevo.': "Couldn't save. Try again.",
  'Cursos exclusivos de tu coaching': 'Courses exclusive to your coaching',
  'Aún no hay cursos': 'No courses yet',
  'Cuando tu entrenador publique cursos, aparecerán aquí.':
    "When your coach publishes courses, they'll show up here.",

  // --- Inicio del alumno ---
  'Ya he pagado': "I've already paid",
  'Primeros pasos': 'First steps',
  'Mis objetivos': 'My goals',
  'No se pudo enviar el aviso': "Couldn't send the notice",
  'Pago informado · pendiente de confirmar': 'Payment reported · awaiting confirmation',
  'Plan en pausa': 'Plan paused',
  'Tu racha está a salvo y no te voy a dar la lata. Si un día te apetece entrenar, adelante: cuenta igual.':
    "Your streak is safe and I won't nag you. If you feel like training one day, go ahead: it counts all the same.",
  'Descanso opcional': 'Optional rest',
  'Tú eliges: descansar o reiniciar el ciclo en el Día 1. Entra para decidir.':
    'Your call: rest, or restart the cycle at Day 1. Go in to decide.',
  'Hoy no toca sesión. Recupera y vuelve con todo.':
    'No session today. Recover and come back strong.',
  'Tú eliges qué hacer hoy. Entra y empieza.': 'You choose what to do today. Go in and start.',
  'Crea tu plan': 'Create your plan',
  'Diseña tus días y empieza hoy. Toca para crearlo.':
    'Design your days and start today. Tap to create it.',
  'Sin rutina aún': 'No routine yet',
  'Tu entrenador te la asignará pronto.': 'Your coach will assign you one soon.',
  'Crea y edita tus días y ejercicios.': 'Create and edit your days and exercises.',
  'Bloques, semanas y descargas.': 'Blocks, weeks and deloads.',
  'Llevas más de una semana sin registrar tu peso.':
    "It's been over a week since you logged your weight.",
  'Semana de descarga': 'Deload week',
  'Tu semana': 'Your week',
  Hecho: 'Done',
  Planificado: 'Planned',
  'Hábitos de hoy': "Today's habits",
  semana: 'week',
  'Tu entrenador recibirá el aviso': 'Your coach will get the notice',
  'No se pudo abrir el pago': "Couldn't open the payment",

  // --- Mi plan (alumno) ---
  Categoría: 'Category',
  'Nombre del plan': 'Plan name',
  'Asigna cada día a un día de la semana con los botones L-D de abajo.':
    'Assign each day to a weekday with the buttons below.',
  'SUPERSERIE con el anterior': 'SUPERSET with the previous one',
  Bloques: 'Blocks',
  'Añadir ejercicio': 'Add exercise',
  'Series al día': 'Sets per day',
  'Ej. Sensaciones': 'e.g. How you feel',
  'Nombre del día': 'Day name',
  'Ciclo reiniciado hoy': 'Cycle restarted today',
  'Mi plan': 'My plan',
  'Diseña tu entrenamiento con el método que prefieras. Tú lo creas, tú lo ajustas.':
    'Design your training with whichever method you prefer. You create it, you adjust it.',
  'Empieza rápido': 'Quick start',
  'Elige una base y edítala, o crea la tuya desde cero más abajo.':
    'Pick a starting point and edit it, or build your own from scratch below.',
  Método: 'Method',
  'Un ejercicio (o dos) repartido en series sueltas por todo el día, y ninguna al fallo: cada serie se queda a la mitad de lo que podrías hacer. Se usa el primer día de abajo, y en repeticiones va el objetivo de cada serie.':
    'One exercise (or two) spread across single sets through the whole day, none to failure: every set stops at about half of what you could do. It uses the first day below, and the reps field holds the target for each set.',
  'Creas varias rutinas (los "días" de abajo) y antes de entrenar eliges cuál hacer según cómo te encuentres. Sin calendario fijo.':
    'You create several routines (the "days" below) and pick which one to do before training, depending on how you feel. No fixed calendar.',
  'Aguante (s)': 'Hold (s)',
  'Pausa (s)': 'Pause (s)',
  'Nombre de esta programación': 'Name for this programming',
  'Ejercicio (ej. Dominadas)': 'Exercise (e.g. Pull-ups)',
  'Notas: tempo, agarre, técnica...': 'Notes: tempo, grip, technique...',
  'Añadir día': 'Add day',
  'Ir a entrenar': 'Go and train',
  'Plantilla aplicada · ajústala a tu gusto': 'Template applied · adjust it to your liking',
  'Añade al menos un día con ejercicios': 'Add at least one day with exercises',
  'Plan guardado': 'Plan saved',
  'Plan creado. ¡A entrenar!': "Plan created. Let's train!",

  // --- Planificación del alumno ---
  'Reparte los próximos meses en bloques: acumular, apretar y soltar. Entrenar sin plan funciona unas semanas; a partir de ahí, lo que falta es saber cuándo bajar.':
    "Split the coming months into blocks: build up, push hard, back off. Training without a plan works for a few weeks; after that, what's missing is knowing when to ease off.",
  'Bloques sueltos': 'Standalone blocks',
  'Elige una plantilla y la app monta los bloques y las semanas, con sus descargas. Si prefieres no planificar, entrenas igual que siempre.':
    "Pick a template and the app builds the blocks and the weeks, deloads included. If you'd rather not plan, you train just as always.",

  // --- Perfil del alumno ---
  Nombre: 'Name',
  'Eliminar mi cuenta': 'Delete my account',
  'Solo puedes cambiar tu nombre una vez cada 90 días.':
    'You can only change your name once every 90 days.',
  'Nombre actualizado': 'Name updated',
  'Nivel de experiencia': 'Experience level',
  'Cambios guardados': 'Changes saved',
  'Insistir si se me olvida': 'Remind me if I forget',
  'Cambiar nombre': 'Change name',
  'Sobre mí': 'About me',
  'Cuéntale a tu entrenador sobre ti...': 'Tell your coach about yourself...',
  'Peso objetivo (kg)': 'Target weight (kg)',
  'Ej. 72': 'e.g. 72',

  // --- Progreso del alumno ---
  Completado: 'Completed',
  Sesiones: 'Sessions',
  'Volumen (kg)': 'Volume (kg)',
  series: 'sets',
  'Exportar a PDF': 'Export to PDF',
  'No se pudo exportar el PDF': "Couldn't export the PDF",
  'Imagen de la sesión descargada': 'Session image downloaded',
  'Resumen copiado, pégalo donde quieras': 'Summary copied, paste it wherever you like',
  'No se pudo compartir': "Couldn't share",
  'Días que has entrenado': "Days you've trained",
  'Tu progreso completo': 'Your full progress',
  'Tus últimos 28 días frente a los mismos días de hace 3 meses.':
    'Your last 28 days against the same days three months ago.',
  'Eliminar este entrenamiento': 'Delete this workout',
  'Series completadas cada semana en lo que más entrenas. Toca una categoría para seguirla o dejar de seguirla.':
    'Sets completed each week in what you train the most. Tap a category to follow or unfollow it.',
  'Registra entrenamientos para ver aquí tus series por categoría.':
    'Log workouts to see your sets by category here.',
  'Series completadas por patrón de movimiento, en los últimos 28 días.':
    'Sets completed by movement pattern, over the last 28 days.',
  'Músculos trabajados': 'Muscles worked',
  'Última sesión': 'Last session',
  CONFIRMAR: 'CONFIRM',
  // El texto llega partido en trozos porque la palabra va resaltada en medio:
  // cada trozo se busca por su cuenta, con sus espacios tal cual.
  'Esta acción no se puede deshacer. Para confirmar, escribe':
    'This cannot be undone. To confirm, type',
  ' abajo.': ' below.',
  'Progreso completo': 'Full progress',
  'Cuando termines una sesión se guardará aquí, en tu registro mensual.':
    "When you finish a session it'll be saved here, in your monthly log.",
  'Hace 3 meses → hoy': '3 months ago → today',
  'Peso corporal': 'Body weight',
  'isom.': 'hold',
  'Series semanales': 'Weekly sets',
  'Mapa muscular': 'Muscle map',
  'Más entrenados': 'Most trained',
  'Aún no hay datos por ejercicio': 'No per-exercise data yet',
  'Cuando completes entrenamientos verás aquí cómo mejoras en cada ejercicio.':
    "When you complete workouts you'll see here how you improve in each exercise.",
  'Borrar entrenamiento': 'Delete workout',
  'Entrenamiento borrado': 'Workout deleted',
  'No se pudo guardar tu selección': "Couldn't save your selection",

  // --- Registrar un entreno de otro día ---
  'Cuéntamelo hablando': 'Tell me out loud',
  '¿Entrenaste sin el móvil delante? Apúntalo ahora. Cuenta igual que cualquier otro: para tu racha, para tu histórico y para tu entrenador.':
    'Trained without your phone at hand? Log it now. It counts just like any other: for your streak, your history and your coach.',
  'Dime las series y las marcas en voz alta y lo apunto yo.':
    "Say your sets and numbers out loud and I'll write them down.",
  'Ese día del plan no tiene ejercicios.': 'That day of the plan has no exercises.',
  'Si no te acuerdas, déjalo en blanco: el entreno se guarda igual.':
    "If you can't remember, leave it blank: the workout is saved anyway.",
  'Para registrar un entreno hace falta un plan del que sacar los ejercicios.':
    'To log a workout you need a plan to take the exercises from.',
  '¿Cuánto duró? (minutos)': 'How long did it take? (minutes)',
  'Ej. 45': 'e.g. 45',
  'Ponle al menos una serie': 'Add at least one set',
  'Entreno registrado': 'Workout logged',
  '¿Entrenaste sin el móvil delante? Apúntalo con su fecha y cuenta igual: para tu racha, para tu progreso y para tu entrenador.':
    'Trained without your phone at hand? Log it with its date and it counts all the same: for your streak, your progress and your coach.',

  // --- Comunidad ---
  'Aún no hay actividad': 'No activity yet',
  'Quién más se supera a sí mismo en tu coaching': 'Who beats their own numbers the most',
  Miembros: 'Members',
  Marcas: 'PRs',
  'Quién más se supera · este mes': 'Who beats themselves the most · this month',
  TÚ: 'YOU',
  marcas: 'PRs',
  'Sin comunidad todavía': 'No community yet',
  'Vincúlate a tu entrenador con un código de invitación para ver a tus compañeros.':
    'Link up with your coach using an invite code to see your teammates.',
  'Cuando tú y tus compañeros registréis entrenamientos, apareceréis aquí.':
    "When you and your teammates log workouts, you'll show up here.",

  // --- Entrenar ---
  'Tienes un entreno sin terminar': 'You have an unfinished workout',
  'Rellenar datos': 'Fill in the details',
  'Más tarde': 'Later',
  'Termina tu sesión antes de salir: tu progreso lo merece. Si sales, la sesión queda guardada y podrás retomarla.':
    'Finish your session before leaving: your progress deserves it. If you leave, the session is saved and you can pick it up again.',
  'Hoy descansas. No cuenta contra tu racha. Vuelve mañana con todo.':
    "Today you rest. It doesn't count against your streak. Come back tomorrow at full power.",
  '¿Cómo te sientes hoy? Marca una o varias rutinas (en el orden que quieras hacerlas):':
    'How do you feel today? Pick one or more routines (in the order you want to do them):',
  'Tus últimos 7 días': 'Your last 7 days',
  'Hoy: descanso opcional': 'Today: optional rest',
  'Disfruta tu descanso. El ciclo continuará solo con el Día 1.':
    'Enjoy your rest. The cycle will carry on by itself with Day 1.',
  'Hoy toca recuperar: el descanso también es parte del entrenamiento. No tienes que marcar nada.':
    "Today is for recovering: rest is part of training too. There's nothing to tick off.",
  'Sesión anterior recuperada': 'Previous session restored',
  'Empezar de cero': 'Start from scratch',
  'Temporizador de intervalos': 'Interval timer',
  'SUPERSERIE con el anterior — sin descanso': 'SUPERSET with the previous one — no rest',
  'Con goma': 'With band',
  Lastrado: 'Weighted',
  'Ver técnica': 'Watch technique',
  'AGUANTE S': 'HOLD S',
  'PESO KG': 'WEIGHT KG',
  'GOMA KG': 'BAND KG',
  'Marca cada serie con ✓, o pulsa “Terminar” para dar la sesión por hecha sin apuntar nada.':
    'Tick each set with ✓, or press "Finish" to call the session done without logging anything.',
  'Tu entrenador todavía no te ha asignado una rutina. Vuelve a comprobarlo pronto.':
    "Your coach hasn't assigned you a routine yet. Check back soon.",
  'Salir (emergencia)': 'Exit (emergency)',
  'Mejor entrenar': 'Better train',
  'Hoy descanso': 'Rest today',
  'Busca o escribe el nombre': 'Search or type the name',
  '¿Qué día del plan es hoy?': 'Which day of the plan is today?',
  'Entrenar Día 1 ahora': 'Train Day 1 now',
  'Descansar hoy': 'Rest today',
  'He cambiado de idea: entrenar Día 1': "I changed my mind: train Day 1",
  'Ej. Hice la variante con goma, molestia en hombro...':
    'e.g. Did the band variation, shoulder felt off...',
  'Ese ejercicio ya está en la sesión': 'That exercise is already in the session',
  'Ciclo reiniciado · hoy es el Día 1': 'Cycle restarted · today is Day 1',
  'Imagen del récord descargada': 'PR image downloaded',
  'Récord copiado, pégalo donde quieras': 'PR copied, paste it wherever you like',
  'Corrigiendo el entreno. Al guardar se actualiza el mismo.':
    'Editing the workout. Saving updates that same one.',
  'No se pudo apuntar la serie. Inténtalo en un momento.':
    "Couldn't log the set. Try again in a moment.",
  'No se pudo quitar la serie': "Couldn't remove the set",
  'Entreno corregido': 'Workout corrected',
  'Sin conexión: la sesión se subirá sola al recuperarla':
    "No connection: the session will upload by itself once you're back online",

  // --- Agenda del coach ---
  'Cargando...': 'Loading...',
  'Entrando...': 'Signing you in...',
  HOY: 'TODAY',
  'Nada este día · lo siguiente': 'Nothing on this day · up next',
  'Sin eventos este día.': 'Nothing on this day.',
  'Al día': 'All caught up',
  'Nada por aquí': 'Nothing here',
  Calendario: 'Calendar',
  'Tareas y objetivos': 'Tasks and goals',
  Mañana: 'Tomorrow',
  'Tus objetivos como coach': 'Your goals as a coach',
  'Marca metas de negocio (alumnos, ingresos, contenido…) y ve su avance.':
    'Set business goals (students, revenue, content…) and watch them move.',
  Logrado: 'Achieved',
  'Ajusta el avance': 'Adjust the progress',
  Cobro: 'Payment',
  'Empieza ciclo': 'Cycle starts',
  'Termina ciclo': 'Cycle ends',
  Tareas: 'Tasks',
  'Elige el nuevo día para esta tarea.': 'Pick the new day for this task.',
  'Tarea movida': 'Task moved',

  // --- Ciclo de un alumno ---
  'No se pudo eliminar': "Couldn't delete",
  Objetivo: 'Goal',
  Notas: 'Notes',
  Descarga: 'Deload',
  'Calendario del plan': 'Plan calendar',
  'Días entrenados': 'Days trained',
  'Progreso por ejercicio': 'Progress by exercise',
  'Todo su historial, no solo este ciclo. Elige qué ejercicios seguir: es la misma tabla que ve tu alumno.':
    'Their whole history, not just this cycle. Choose which exercises to follow: it is the same table your student sees.',
  'Sale con las semanas y los ejercicios que tengas puestos ahora mismo.':
    'It comes out with the weeks and exercises you have set right now.',
  'Aún no hay entrenos en este rango de fechas. Aparecerán aquí cuando el alumno entrene.':
    'No workouts in this date range yet. They will show up here once your student trains.',
  'Guardar como plantilla': 'Save as template',
  'Guarda este plan entero —bloques, semanas y los números que hayas programado— para montárselo a otro alumno de un toque. No se guardan las fechas: esas se eligen al aplicarlo.':
    'Save this whole plan —blocks, weeks and the numbers you programmed— to set it up for another student in one tap. Dates are not saved: you pick those when you apply it.',
  'Programación de la semana': 'This week’s programming',
  'Ciclo no encontrado': 'Cycle not found',
  'Por semana': 'By week',
  'Editar ciclo': 'Edit cycle',
  'Nombre de la plantilla': 'Template name',
  'Con este nombre te saldrá al crear el plan de otro alumno.':
    "This is the name you'll see when creating another student's plan.",
  'Ej. Mi bloque de fuerza': 'e.g. My strength block',
  'Plantilla guardada': 'Template saved',
  'No se pudo guardar la plantilla': "Couldn't save the template",

  // --- Ficha del alumno ---
  'Plan nutricional': 'Nutrition plan',
  Pagos: 'Payments',
  'Estado de pago': 'Payment status',
  'Cuota mensual': 'Monthly fee',
  '€ / mes': '€ / month',
  'Enlace guardado': 'Link saved',
  'Próximo pago': 'Next payment',
  'Suma un mes a la fecha de arriba.': 'Adds one month to the date above.',
  'Pago único hasta una fecha': 'One-off payment up to a date',
  'Paga de una vez y queda cubierto hasta el día que pongas. El importe entra en tus ingresos tal cual, sin partirlo en cuotas.':
    'They pay once and stay covered until the day you set. The amount goes into your revenue as it is, without splitting it into instalments.',
  'Quitar la fecha de próximo pago': 'Remove the next payment date',
  'Rutina asignada': 'Assigned routine',
  'Este cliente no tiene una rutina activa.': 'This client has no active routine.',
  'Planificación por ciclos': 'Cycle planning',
  'La temporada en bloques y semanas, su cumplimiento y el progreso ejercicio a ejercicio.':
    'The season in blocks and weeks, how well it is followed and progress exercise by exercise.',
  'Sus objetivos': 'Their goals',
  'Solo tú las ves (lesiones, preferencias, objetivos…).':
    'Only you can see these (injuries, preferences, goals…).',
  'Nota guardada': 'Note saved',
  'Los alumnos VIP ven además las clases que hayas marcado como VIP dentro de tus cursos. Para el resto, esas clases no existen: no se les enseña un candado ni un anuncio de lo que no tienen.':
    "VIP students also see the lessons you marked as VIP inside your courses. For everyone else those lessons do not exist: they are shown no padlock and no advert for what they don't have.",
  'Objetivo guardado': 'Goal saved',
  'Al terminar cada ejercicio le preguntamos cuántas repeticiones le quedaban. Actívalo solo si entiende lo que es: quien empieza lo rellena al azar, y un dato inventado es peor que no tenerlo.':
    'After each exercise we ask how many reps they had left. Turn this on only if they understand it: a beginner fills it in at random, and a made-up number is worse than no number.',
  'Plan del alumno (onboarding)': 'Student plan (onboarding)',
  'Plan oficial calculado por el alumno en el onboarding. Puedes ajustarlo si lo ves necesario.':
    'Official plan the student calculated during onboarding. You can adjust it if you think it needs it.',
  'Este cliente no tiene un plan nutricional activo.': 'This client has no active nutrition plan.',
  'El cliente todavía no ha subido fotos.': "The client hasn't uploaded any photos yet.",
  'Asigna hábitos que el alumno marcará cada día desde su inicio.':
    'Assign habits your student will tick off every day from their home screen.',
  'Cada punto dorado es un día entrenado.': 'Every gold dot is a day trained.',
  'Volumen semanal (kg)': 'Weekly volume (kg)',
  'Isométricos: segundos por semana': 'Holds: seconds per week',
  'Segundos totales de aguante (ejercicios por tiempo), separados por empuje y tirón.':
    'Total seconds held (timed exercises), split into push and pull.',
  Empuje: 'Push',
  Tirón: 'Pull',
  Otros: 'Other',
  'Ritmo de progreso': 'Rate of progress',
  'Tendencia al mes según sus últimas sesiones.': 'Monthly trend from their latest sessions.',
  'Todavía no ha registrado entrenamientos.': "They haven't logged any workouts yet.",
  'Sácalo de tu grupo para que deje de aparecer en tus clientes. No se borra su cuenta ni su historial; podrá vincularse a otro entrenador con un código.':
    'Remove them from your group so they stop appearing in your clients. Their account and history are not deleted; they can link to another coach with a code.',
  '¿Seguro? Pulsa de nuevo para confirmar.': 'Are you sure? Press again to confirm.',
  'No se pudo cargar el cliente': "Couldn't load the client",
  'Cliente no encontrado': 'Client not found',
  'Guardar enlace': 'Save link',
  'Registrar pago': 'Log payment',
  Días: 'Days',
  'Añadir días': 'Add days',
  'Registrar pago único': 'Log one-off payment',
  'Notas privadas': 'Private notes',
  'Escribe aquí tus notas sobre este alumno...': 'Write your notes about this student here...',
  'Alumno VIP': 'VIP student',
  'Pasos al día': 'Steps per day',
  'Pedirle el esfuerzo (RIR)': 'Ask them for effort (RIR)',
  'Evolución del peso': 'Weight over time',
  'Hábitos diarios': 'Daily habits',
  'Ej: Dormir 8 horas': 'e.g. Sleep 8 hours',
  'Actividad (12 semanas)': 'Activity (12 weeks)',
  'Historial de entrenamientos': 'Workout history',
  'Gestión del alumno': 'Manage this student',
  'No se ha podido guardar la pausa': "Couldn't save the pause",
  'Hábito añadido': 'Habit added',
  'El enlace debe empezar por https://': 'The link must start with https://',
  'No se pudo guardar el enlace': "Couldn't save the link",
  'Pago registrado · próxima renovación en 1 mes':
    'Payment logged · next renewal in 1 month',
  'Recordatorio de pago enviado': 'Payment reminder sent',
  'Alumno sacado de tu grupo': 'Student removed from your group',

  // --- Nutrición del alumno, desde el coach ---
  'Proteína (g)': 'Protein (g)',
  'Grasas (g)': 'Fats (g)',
  'Notas (opcional)': 'Notes (optional)',
  'Calorías diarias (kcal)': 'Daily calories (kcal)',
  'Carbs (g)': 'Carbs (g)',
  'Guardar plan': 'Save plan',

  // --- Planificación del alumno, desde el coach ---
  'Nuevo plan': 'New plan',
  'Monta la temporada en bloques y comprueba semana a semana si el alumno la está cumpliendo.':
    'Build the season in blocks and check week by week whether your student is keeping up.',
  'Ciclo suelto': 'Standalone cycle',
  'Ciclos sueltos': 'Standalone cycles',
  'Crea un plan y la app monta el macrociclo con sus bloques y sus semanas. Si prefieres no planificar, el alumno entrena igual que siempre.':
    "Create a plan and the app builds the macrocycle with its blocks and weeks. If you'd rather not plan, your student trains just as always.",

  // --- Rutina de un alumno ---
  'Subgrupo (opcional)': 'Subgroup (optional)',
  Opcional: 'Optional',
  'Nombre del ejercicio': 'Exercise name',
  'Buscar ejercicio...': 'Search exercise...',
  'Copiar la rutina activa de...': 'Copy the active routine from...',
  'Cargando alumnos...': 'Loading students...',
  'Plantillas de rutina': 'Routine templates',
  'Aún no tienes plantillas. Guarda esta rutina para reutilizarla con otros alumnos.':
    'No templates yet. Save this routine to reuse it with other students.',
  Programación: 'Programming',
  'Un solo ejercicio (o dos), repartido en series sueltas a lo largo del día. Ninguna al fallo: cada serie se queda a la mitad de lo que el alumno podría hacer. Se usa el primer día de abajo; el objetivo por serie es el campo de repeticiones del ejercicio.':
    "A single exercise (or two), spread across single sets through the day. None to failure: every set stops at about half of what the student could do. It uses the first day below; the target per set is the exercise's reps field.",
  'Modo a elección: creas varias rutinas (los "días" de abajo) y el alumno, antes de entrenar, elige cuál hacer según cómo se encuentre ese día. Sin calendario fijo.':
    'Pick-your-own mode: you create several routines (the "days" below) and the student chooses which one to do before training, depending on how they feel that day. No fixed calendar.',
  'Descanso opcional: el alumno decide cada vez entre descansar o reiniciar el ciclo entrenando el Día 1.':
    'Optional rest: each time, the student chooses between resting or restarting the cycle by training Day 1.',
  'Esta rutina no es una sesión: son series sueltas repartidas por todo el día, ninguna al fallo. El alumno la elige sola, no encadenada con otra, y en repeticiones va el objetivo de CADA serie.':
    'This routine is not a session: it is single sets spread through the whole day, none to failure. The student picks it on its own, never chained to another, and the reps field holds the target for EACH set.',
  'Día de la semana': 'Weekday',
  'Día de descanso: en el día de la semana elegido, el alumno verá “Descanso”, no registra nada y no afecta a su racha.':
    'Rest day: on the chosen weekday the student sees "Rest", logs nothing and their streak is unaffected.',
  'Otro día del plan cae en el mismo día de la semana. El alumno verá los dos y podrá entrenar el que quiera, pero la app le propondrá el primero.':
    'Another day of the plan falls on the same weekday. The student will see both and can train either, but the app will suggest the first one.',
  'Temporizador de intervalos (EMOM) este día': 'Interval timer (EMOM) on this day',
  '· goma': '· band',
  '· lastre': '· added weight',
  Carga: 'Load',
  'Agarre (opcional)': 'Grip (optional)',
  Medida: 'Measured in',
  'No tienes ejercicios en tu biblioteca todavía. Crea el primero con el botón de arriba.':
    'You have no exercises in your library yet. Create the first one with the button above.',
  'Ningún ejercicio de esa categoría coincide con la búsqueda.':
    'No exercise in that category matches your search.',
  'Nombre de la rutina': 'Routine name',
  'Guardar rutina actual como plantilla': 'Save current routine as a template',
  Borrador: 'Draft',
  Plantillas: 'Templates',
  Copiar: 'Copy',
  'Nombre de esta programación (lo ve el alumno)':
    'Name for this programming (your student sees it)',
  'Aproximaciones (calentamiento · paso 3)': 'Ramp-up sets (warm-up · step 3)',
  'Ej. 2 series al 60% y 70% del peso de trabajo':
    'e.g. 2 sets at 60% and 70% of the working weight',
  'Aguante (seg)': 'Hold (sec)',
  'Descanso (min:seg)': 'Rest (min:sec)',
  'Bloques por serie': 'Blocks per set',
  'Pausa entre bloques (seg)': 'Pause between blocks (sec)',
  'Indicaciones (opcional)': 'Cues (optional)',
  'Tempo, agarre, técnica...': 'Tempo, grip, technique...',
  'Objetivo (texto libre)': 'Goal (free text)',
  '+ Añadir ejercicio': '+ Add exercise',
  'Ej. Muscle up': 'e.g. Muscle up',
  'Vídeo de técnica (opcional)': 'Technique video (optional)',
  'Pega el enlace de YouTube': 'Paste the YouTube link',
  'Crear y añadir al día': 'Create and add to the day',
  'Volver a la biblioteca': 'Back to the library',
  'Mover o copiar': 'Move or copy',
  Mover: 'Move',
  '+ Añadir día': '+ Add day',
  'Guardar rutina': 'Save routine',
  'Tu biblioteca está vacía: añade o importa ejercicios primero':
    'Your library is empty: add or import exercises first',
  'Día duplicado': 'Day duplicated',
  'Plantilla aplicada': 'Template applied',
  'Añade al menos un día antes de guardar la plantilla':
    'Add at least one day before saving the template',
  'Guardada como plantilla': 'Saved as a template',
  'Rutina guardada': 'Routine saved',

  // --- Sesión de un alumno, vista por el coach ---
  Cliente: 'Client',
  'Comentario del alumno': 'Student comment',
  'Sesión no encontrada': 'Session not found',

  // --- Lista de clientes ---
  'Libretas de comida': 'Meal books',
  'Tus clientes': 'Your clients',
  Exportar: 'Export',
  'Recetas y platos por foto para todos tus alumnos':
    'Recipes and meals in photos for all your students',
  'Cargando tu grupo...': 'Loading your group...',
  'No se pudo cargar la lista': "Couldn't load the list",
  'Buscar cliente...': 'Search client...',
  'Aún no tienes clientes': 'No clients yet',
  'Comparte tu código de invitación para que tus alumnos se registren y aparezcan aquí automáticamente.':
    'Share your invite code so your students sign up and appear here automatically.',
  'Sin resultados': 'No results',
  'Prueba con otro nombre o cambia el filtro.': 'Try another name or change the filter.',
  'Mantén pulsado sobre cualquier alumno para llegar aquí':
    'Press and hold any student to get here',
  'La exportación solo está disponible en la versión web':
    'Exporting is only available on the web version',

  // --- Libretas de comida ---
  'Sube tus cuadernos de recetas y platos por foto. Los verán TODOS tus alumnos dentro de la app, al final de su pestaña de nutrición.':
    'Upload your recipe and meal notebooks as photos. ALL your students will see them inside the app, at the bottom of their nutrition tab.',
  'Nueva libreta': 'New book',
  'Aún no hay fotos en esta libreta.': 'No photos in this book yet.',
  'Título (Ej. Recetas de desayuno)': 'Title (e.g. Breakfast recipes)',
  'Crear libreta': 'Create book',
  'Aún no tienes libretas': 'No books yet',
  'Crea tu primera libreta y añade fotos de tus platos y recetas.':
    'Create your first book and add photos of your meals and recipes.',
  'Nombre de la libreta': 'Book name',
  'No se pudieron cargar las libretas': "Couldn't load the books",
  'No se pudo renombrar': "Couldn't rename",
  'Libreta borrada': 'Book deleted',
  '¿Quitar esta foto de la libreta?': 'Remove this photo from the book?',

  // --- Cursos del coach ---
  'Añadir portada del curso': 'Add course cover',
  Publicado: 'Published',
  'Si está activo, tus alumnos podrán verlo. Déjalo desactivado como borrador.':
    'When this is on, your students can see it. Leave it off to keep it a draft.',
  Contenido: 'Content',
  'Portada de la sección': 'Section cover',
  'Eliminar curso': 'Delete course',
  'Título del curso': 'Course title',
  'Ej. Domina tu primer muscle-up': 'e.g. Master your first muscle-up',
  Descripción: 'Description',
  'De qué trata el curso...': "What the course is about...",
  'Nombre de la sección': 'Section name',
  '+ Añadir lección': '+ Add lesson',
  '+ Añadir sección': '+ Add section',
  'Guardar curso': 'Save course',
  '+ Nuevo': '+ New',
  'Aún no tienes cursos': 'No courses yet',
  'Crea tu primer curso, organízalo en secciones y sube tus lecciones en vídeo.':
    'Create your first course, organise it into sections and upload your video lessons.',

  // --- Inicio del coach ---
  'Necesita tu atención': 'Needs your attention',
  'Pon en marcha tu coaching en 3 pasos.': 'Get your coaching going in 3 steps.',
  'Error al cargar datos': 'Error loading data',
  'Tu grupo esta semana': 'Your group this week',
  'Calendario y tareas': 'Calendar and tasks',
  'Nuevo ejercicio': 'New exercise',
  'Nuevo curso': 'New course',
  'Ingresado este mes': 'Collected this month',
  'Próximo cobro': 'Next payment due',
  'No hay pagos pendientes.': 'No payments pending.',
  'Ajusta el importe o elimina un pago si hubo un error.':
    'Adjust the amount or delete a payment if something went wrong.',
  'Aún no hay pagos registrados este mes.': 'No payments logged this month yet.',
  'Aún no hay pagos registrados.': 'No payments logged yet.',
  'No hay renovaciones previstas en 30 días.': 'No renewals due in the next 30 days.',
  activos: 'active',
  'Cobros del mes': 'Payments this month',
  'Actividad reciente': 'Recent activity',
  'Cuando tus alumnos entrenen, sus sesiones aparecerán aquí.':
    'When your students train, their sessions will show up here.',
  'Avisar a todos': 'Remind everyone',
  Ingresos: 'Revenue',
  'Solicitud rechazada': 'Request rejected',
  'No hay pagos pendientes': 'No payments pending',
  'No se pudo enviar el recordatorio. Reinténtalo.': "Couldn't send the reminder. Try again.",
  'Importe no válido': 'Invalid amount',
  'Pago actualizado': 'Payment updated',
  'Pago eliminado': 'Payment deleted',
  'No se pudo marcar': "Couldn't mark it",
  '¿Eliminar este pago del historial de ingresos?':
    'Delete this payment from your revenue history?',

  // --- Un ejercicio de la biblioteca ---
  'Ej. Dominadas estrictas': 'e.g. Strict pull-ups',
  'Nueva categoría…': 'New category…',
  'Descripción / técnica': 'Description / technique',
  'Indicaciones de ejecución...': 'How to perform it...',
  'Renombrar subgrupo': 'Rename subgroup',
  'Nuevo nombre': 'New name',
  'No se pudieron guardar las categorías': "Couldn't save the categories",
  'Esa categoría ya existe': 'That category already exists',
  'Ya existe un subgrupo con ese nombre': 'A subgroup with that name already exists',
  'Subgrupo renombrado': 'Subgroup renamed',
  'No se pudo renombrar el subgrupo': "Couldn't rename the subgroup",
  'Deja al menos una categoría': 'Leave at least one category',
  Subgrupo: 'Subgroup',
  'Por ejercicio': 'By exercise',
  'Cada serie combina repeticiones y aguante en una sola tarjeta. Ej.: Muscle Up + Front Lever → 5 repeticiones y 12 s.':
    'Each set combines reps and a hold in a single card. e.g. Muscle Up + Front Lever → 5 reps and 12 s.',
  'Cada serie se anota por separado para el lado izquierdo y el derecho. Para trabajo a un brazo, donde saber cuál va por detrás es justo el dato que importa.':
    'Each set is logged separately for the left and the right side. For one-arm work, where knowing which side is lagging is exactly the number that matters.',
  'Eliminar ejercicio': 'Delete exercise',
  'Sin subgrupo': 'No subgroup',
  'URL del vídeo': 'Video URL',
  'Desaparece de tu biblioteca y de las rutinas que lo usen. Los entrenamientos ya registrados con él se quedan como están.':
    'It disappears from your library and from any routine using it. Workouts already logged with it stay as they are.',
  'Ejercicio guardado': 'Exercise saved',
  'No se pudo aplicar la medida al grupo': "Couldn't apply the measure to the group",
  'No se pudo soltar la medida del grupo': "Couldn't detach the measure from the group",
  'Ese subgrupo ya existe': 'That subgroup already exists',
  'No se pudo crear el subgrupo': "Couldn't create the subgroup",

  // --- Biblioteca de ejercicios ---
  Continuar: 'Continue',
  Categorías: 'Categories',
  Listo: 'Done',
  'Toca un color para cambiarlo': 'Tap a colour to change it',
  Vídeo: 'Video',
  Usar: 'Use',
  Biblioteca: 'Library',
  'Cargando ejercicios...': 'Loading exercises...',
  Todos: 'All',
  'Toda la categoría': 'The whole category',
  'No hay ejercicios': 'No exercises',
  '¿Actualizar a pack UDECA?': 'Update to the UDECA pack?',
  'Elige un color o escribe el tuyo.': 'Pick a colour or type your own.',
  'Pegar plantilla': 'Paste template',
  'Pega aquí el texto de la plantilla que te ha compartido otro entrenador.':
    'Paste here the template text another coach shared with you.',
  'Pega el contenido JSON…': 'Paste the JSON content…',
  '¿Sustituir tu plantilla actual?': 'Replace your current template?',
  'No se pudo guardar el color': "Couldn't save the colour",
  'Escribe un color tipo #FF9900': 'Type a colour like #FF9900',
  'Ya tienes todos los ejercicios del pack': 'You already have every exercise in the pack',
  'Biblioteca sincronizada con el pack UDECA': 'Library synced with the UDECA pack',
  'No se pudo actualizar el pack': "Couldn't update the pack",
  'No tienes ejercicios que exportar': 'You have no exercises to export',
  'Plantilla exportada': 'Template exported',
  'No se pudo exportar': "Couldn't export",
  'El archivo no es una plantilla de ejercicios válida':
    'That file is not a valid exercise template',
  'El texto no es una plantilla de ejercicios válida':
    'That text is not a valid exercise template',
  'Plantilla importada': 'Template imported',
  'No se pudo importar la plantilla': "Couldn't import the template",

  // --- Plantilla UDECA (solo CEO) ---
  'Plantilla UDECA': 'UDECA template',
  'Solo tú (CEO) editas esta plantilla. Cada entrenador nuevo puede precargarla en su biblioteca. Elige los músculos de cada ejercicio para el cuerpo anatómico.':
    'Only you (CEO) edit this template. Every new coach can preload it into their library. Choose the muscles of each exercise for the anatomical body.',
  'Se mide en': 'Measured in',
  'Músculos que trabaja': 'Muscles it works',
  'Toca para subir el % (0 → 25 → 50 → 75 → 100)': 'Tap to raise the % (0 → 25 → 50 → 75 → 100)',
  'La plantilla no lleva vídeo: cada entrenador añadirá el suyo al importarla.':
    'The template carries no video: each coach adds their own when importing it.',
  'Añadir mis ejercicios de coach': 'Add my coach exercises',
  'Cargar pack base de calistenia': 'Load the base calisthenics pack',
  'Plantilla vacía': 'Empty template',
  'Carga el pack base o crea el primer ejercicio con':
    'Load the base pack or create the first exercise with',
  'Ej. Accesorios, Flexiones, Press, Aguantes': 'e.g. Accessories, Push-ups, Press, Holds',
  'Eliminar de la plantilla': 'Remove from the template',
  'No se pudo cargar la plantilla': "Couldn't load the template",
  'Pon un nombre al ejercicio': 'Give the exercise a name',
  'Ejercicio guardado en la plantilla': 'Exercise saved to the template',
  'El pack base ya está cargado': 'The base pack is already loaded',
  'No se pudo cargar el pack base': "Couldn't load the base pack",
  'Tus ejercicios ya están en la plantilla': 'Your exercises are already in the template',
  'No se pudieron añadir': "Couldn't add them",
  'Ejercicio eliminado de la plantilla': 'Exercise removed from the template',

  // --- Perfil del coach ---
  'Ej. LUISTENA': 'e.g. LUISTENA',
  'Comparte este código con tus clientes para que se registren y queden vinculados a ti automáticamente.':
    'Share this code with your clients so they sign up and get linked to you automatically.',
  'Aparecerá cuando tus alumnos empiecen a entrenar con la app.':
    'It will show up once your students start training with the app.',
  'Mantén la lista limpia: elimina perfiles antiguos o de prueba con la papelera.':
    'Keep the list clean: delete old or test profiles with the bin.',
  'Embudo de ventas': 'Sales funnel',
  'Dónde se cae la gente entre abrir la app y crear la cuenta.':
    'Where people drop off between opening the app and creating an account.',
  'Cargando métricas...': 'Loading metrics...',
  'Errores de usuarios': 'User errors',
  'Qué se ha roto de verdad en el móvil de la gente, agrupado por fallo.':
    "What actually broke on people's phones, grouped by fault.",
  'Cargando errores...': 'Loading errors...',
  'Ningún error registrado. Buena señal.': 'No errors logged. Good sign.',
  'Admin UDECA · cuentas': 'UDECA admin · accounts',
  'Gestiona las suscripciones de quien paga: entrenadores y atletas.':
    'Manage the subscriptions of those who pay: coaches and athletes.',
  'Cargando…': 'Loading…',
  Quitar: 'Remove',
  'Nuevo código (letras y números)': 'New code (letters and numbers)',
  'Guardar código': 'Save code',
  'Personalizar mi código': 'Customise my code',
  Clasificación: 'Leaderboard',
  '¿Quitar de la clasificación?': 'Remove from the leaderboard?',
  Suscripción: 'Subscription',
  'Nº de días': 'No. of days',
  'Perfil eliminado de la clasificación': 'Profile removed from the leaderboard',
  'Escribe cuántos días': 'Type how many days',
  'No se pudieron cargar las métricas': "Couldn't load the metrics",
  'No se pudieron cargar los errores': "Couldn't load the errors",
  'Suscripción retirada': 'Subscription withdrawn',
  'Cuenta eliminada': 'Account deleted',
  'Código actualizado': 'Code updated',

  // --- Eliminar la cuenta ---
  'ELIMINAR MI CUENTA': 'DELETE MY ACCOUNT',
  'Vas a eliminar tu cuenta': "You're about to delete your account",
  'Esto no se puede deshacer. No hay papelera, ni copia que podamos devolverte después. Antes de seguir, mira lo que desaparece:':
    'This cannot be undone. There is no bin, and no copy we can give you back later. Before you carry on, look at what disappears:',
  'Tus alumnos': 'Your students',
  'Sus cuentas y su historial NO se borran, pero se quedan sin entrenador y tendrán que vincularse a otro con un código nuevo. Avísales antes: para ellos esto llega sin previo aviso.':
    'Their accounts and history are NOT deleted, but they are left without a coach and will have to link to another one with a new code. Tell them first: for them this arrives out of the blue.',
  '¿Seguro que es esto lo que quieres?': 'Are you sure this is what you want?',
  'Casi siempre hay una opción menos definitiva. Si vuelves dentro de un año, tu historial seguirá donde lo dejaste... salvo que lo borres hoy.':
    'There is almost always a less final option. If you come back in a year, your history will still be where you left it... unless you delete it today.',
  '¿Por qué te vas?': 'Why are you leaving?',
  'Nos ayuda a no repetir el mismo error con el siguiente. Puedes saltártelo.':
    'It helps us not repeat the same mistake with the next person. You can skip it.',
  'Escríbelo con tus manos': 'Type it out yourself',
  'Para que no pase por un toque sin querer, escribe exactamente:':
    'So this cannot happen from a stray tap, type exactly:',
  'Lo que no se borra al instante': "What isn't deleted straight away",
  'Último paso': 'Last step',
  'Confirma que eres tú con tu contraseña. Al pulsar el botón, tu cuenta y tus datos se borran inmediatamente.':
    'Confirm it is you with your password. When you press the button, your account and your data are deleted immediately.',
  'La espera está para darte veinte segundos de arrepentimiento. Todavía puedes volver atrás.':
    'The wait is there to give you twenty seconds of second thoughts. You can still turn back.',
  'Lo entiendo, seguir': 'I understand, carry on',
  'Mejor no': 'Never mind',
  'Solo quiero salir de la app': 'I just want to leave the app',
  'Cierra sesión y ya está. Tus datos te esperan.':
    'Just sign out. Your data will be waiting for you.',
  'No quiero seguir con un alumno': "I don't want to keep working with a student",
  'Puedes sacarlo de tu grupo desde su ficha, sin tocar tu cuenta.':
    'You can remove them from your group on their profile, without touching your account.',
  'Quiero cambiar de entrenador': 'I want to change coach',
  'Pídele que te saque de su grupo y entra en otro con su código.':
    'Ask them to remove you from their group and join another one with their code.',
  'Recibo demasiados avisos': 'I get too many notifications',
  'Se apagan uno a uno desde tu perfil.': 'You can turn them off one by one in your profile.',
  'Cerrar sesión y quedarme': 'Sign out and stay',
  'Quiero eliminar mi cuenta igualmente': 'I want to delete my account anyway',
  'Volver atrás': 'Go back',
  'Tu contraseña': 'Your password',
  'No, quiero conservar mi cuenta': 'No, I want to keep my account',
  'Tu cuenta ha sido eliminada': 'Your account has been deleted',

  // --- Páginas legales ---
  'Eliminar tu cuenta de UDECA': 'Delete your UDECA account',
  'Desde la app, tú mismo': 'From the app, yourself',
  'Perfil → Eliminar mi cuenta': 'Profile → Delete my account',
  'Por correo, si prefieres': 'By email, if you prefer',
  'Escríbenos desde la dirección con la que te registraste a:':
    'Write to us from the address you signed up with:',
  'Asunto: "Eliminar cuenta". Procesaremos la solicitud en un máximo de 30 días. Es también la vía para pedir que se borren los restos que la app no puede quitar por sí sola (comidas y hábitos registrados, y los mensajes con tu entrenador, que conserva su copia).':
    'Subject: "Delete account". We will process the request within 30 days at most. This is also the way to ask us to erase what the app cannot remove on its own (logged meals and habits, and the messages with your coach, who keeps their copy).',
  'Qué se elimina': 'What gets deleted',
  'Perfil (nombre, email, foto), rutinas y ejercicios asignados, historial de entrenamientos y estadísticas, registros de peso y nutrición, fotos de progreso, historial de pagos y mensajes con tu entrenador.':
    'Profile (name, email, photo), assigned routines and exercises, workout history and statistics, weight and nutrition logs, progress photos, payment history and messages with your coach.',
  'Qué se conserva': 'What is kept',
  'Ningún dato personal. Podemos conservar registros de facturación durante el tiempo exigido por la ley aplicable.':
    'No personal data. We may keep billing records for as long as applicable law requires.',
  'Falta configurar Firebase': 'Firebase is not configured yet',
  'Crea un archivo .env en la raíz del proyecto (puedes copiar .env.example) con las credenciales de tu proyecto de Firebase y reinicia la app. Consulta el README para más detalles.':
    'Create a .env file at the root of the project (you can copy .env.example) with your Firebase project credentials and restart the app. See the README for details.',
  'Política de privacidad de UDECA': 'UDECA privacy policy',
  'Última actualización: julio 2026': 'Last updated: July 2026',
  'Datos de cuenta:': 'Account data:',
  'Perfil:': 'Profile:',
  'Datos de entrenamiento y forma física:': 'Training and fitness data:',
  'Nutrición:': 'Nutrition:',
  'Comunicación:': 'Communication:',
  'Datos técnicos:': 'Technical data:',
  'UDECA nunca ve ni guarda los datos completos de tu tarjeta':
    'UDECA never sees or stores your full card details',
  'entrenador asignado': 'assigned coach',
  'Firebase (Google):': 'Firebase (Google):',
  'Stripe:': 'Stripe:',
  'Expo:': 'Expo:',
  '1. Datos que recogemos': '1. Data we collect',
  '2. Para qué usamos tus datos': '2. What we use your data for',
  '3. Pagos (Stripe)': '3. Payments (Stripe)',
  '4. Proveedores y con quién se comparten': '4. Providers and who we share with',
  '5. Transferencias internacionales': '5. International transfers',
  '6. Conservación': '6. Retention',
  '7. Tus derechos': '7. Your rights',
  '8. Eliminar tu cuenta y tus datos': '8. Deleting your account and your data',
  '9. Menores': '9. Minors',
  '10. Cambios en esta política': '10. Changes to this policy',
  '11. Contacto': '11. Contact',

  // --- Componentes que salen en muchas pantallas ---
  'Volumen del bloque': 'Block volume',
  'Todavía no hay entrenos ni rutina que medir. En cuanto el alumno entrene, aquí sale el reparto por grupo, semana a semana.':
    'No workouts or routine to measure yet. As soon as your student trains, the split by group shows up here, week by week.',
  Grupo: 'Group',
  'Intensidad · RIR reportado, y debajo el que pediste':
    'Intensity · reported RIR, and below it the one you asked for',
  'Mi peso': 'My weight',
  'Todavía no has apuntado tu peso': "You haven't logged your weight yet",
  'Pésate a la misma hora, mejor en ayunas. Lo que importa no es el número de hoy: es hacia dónde va.':
    "Weigh yourself at the same time, ideally fasted. What matters isn't today's number: it's where it's heading.",
  'Peso en kg (ej. 66,4)': 'Weight in kg (e.g. 66.4)',
  Apuntar: 'Log it',
  'Peso guardado': 'Weight saved',
  'Registro borrado': 'Entry deleted',
  'No se pudo borrar': "Couldn't delete",
  '¿Borrar este registro de peso?': 'Delete this weight entry?',
  'CUOTA PENDIENTE': 'PAYMENT DUE',
  'No pierdes nada: tu plan, tu historial y tus marcas siguen guardados.':
    'You lose nothing: your plan, your history and your PRs are all still saved.',
  'Tu acceso está en pausa': 'Your access is paused',
  'No se pudo abrir el pago. Reinténtalo.': "Couldn't open the payment. Try again.",
  'Avisado. Recuperas el acceso mientras tu entrenador lo confirma.':
    'Notified. You get access back while your coach confirms it.',
  'Tu calendario de siempre': 'The calendar you already use',
  'Cuando tengas tareas con fecha, cobros o bloques programados, aparecerán aquí.':
    'Once you have dated tasks, payments or scheduled blocks, they will show up here.',
  '¿Cómo lo abro?': 'How do I open it?',
  'Todavía no hay nada con fecha que llevarse': 'There is nothing dated to take with you yet',
  'Doble clic en el fichero, o Importar en tu calendario':
    'Double-click the file, or use Import in your calendar',
  'Los de hoy los has escrito tú.': "Today's were typed in by you.",
  'Ej. 9500': 'e.g. 9500',
  'El contador del móvil solo está en la app de iPhone o Android':
    'The phone step counter is only in the iPhone or Android app',
  'Este móvil no tiene contador de pasos': 'This phone has no step counter',
  'Sin permiso de actividad no se pueden leer los pasos':
    'Without activity permission the steps cannot be read',
  'Traídos {0} pasos de tu iPhone': '{0} steps brought over from your iPhone',
  'Tu iPhone no tiene pasos guardados de hoy. Comprueba en Ajustes › Privacidad › Movimiento y forma física.':
    'Your iPhone has no steps saved for today. Check Settings › Privacy › Motion & Fitness.',
  'No se ha podido leer el contador del móvil': "Couldn't read the phone's counter",
  'Escribe cuántos pasos has dado': 'Type how many steps you took',
  'Pasos guardados': 'Steps saved',
  Empieza: 'Starts',
  'Tus plantillas': 'Your templates',
  'Entrenos por semana': 'Workouts per week',
  'Es la meta de cada semana; en las de descarga se resta una.':
    'It is the target for every week; deload weeks get one less.',
  'Última semana de descarga': 'Last week is a deload',
  'Añadir bloque': 'Add block',
  'Ej. Temporada de otoño': 'e.g. Autumn season',
  'Nombre del bloque': 'Block name',
  'Objetivo del plan (opcional)': 'Plan goal (optional)',
  'Ej. Muscle-up estricto por 3': 'e.g. Strict muscle-up for 3',
  'No se pudo crear el plan': "Couldn't create the plan",
  'Día entrenado': 'Day trained',
  Nivel: 'Level',
  'Sin fecha de fin (abierto)': 'No end date (open)',
  'Semana de descarga (deload)': 'Deload week',
  'Ej. Hipertrofia': 'e.g. Hypertrophy',
  'Meta de sesiones': 'Session target',
  'Ej. 16': 'e.g. 16',
  'Objetivo del ciclo': 'Cycle goal',
  'Ej. Dominadas lastradas +25 kg × 5': 'e.g. Weighted pull-ups +25 kg × 5',
  'Notas del coach': 'Coach notes',
  'Notas privadas…': 'Private notes…',
  'Ponle un nombre al ciclo': 'Give the cycle a name',
  'Ciclo actualizado': 'Cycle updated',
  'Ciclo creado': 'Cycle created',
  'No se pudo guardar el ciclo': "Couldn't save the cycle",
  Reps: 'Reps',
  'Guardado en tu progreso · pestaña Entrenos': 'Saved to your progress · Workouts tab',
  'Entrenamiento terminado': 'Workout finished',
  'Guardado en tu progreso · pestaña Entrenos. Vuelve mañana para tu próxima sesión.':
    'Saved to your progress · Workouts tab. Come back tomorrow for your next session.',
  'Hacer otro entrenamiento hoy': 'Do another workout today',
  Isométrico: 'Hold',
  'Compartir récord': 'Share PR',
  'Compartir mi sesión': 'Share my session',
  'Ir a inicio': 'Go home',
  'Me faltan series · corregirlo': "I'm missing sets · fix it",
  'Corregir este entreno': 'Correct this workout',
  'Compartir sesión': 'Share session',
  'Ver mi progreso': 'See my progress',
  'Lo que has dicho': 'What you said',
  'Puedes retocarlo antes de que lo apunte. Si te sale más fácil escribirlo, escríbelo.':
    'You can tweak it before I write it down. If typing is easier for you, type it.',
  'Esto es lo que he entendido': "Here's what I understood",
  'Cuatro series de dominadas: ocho, siete, seis y cinco. Fondos con diez kilos, tres de ocho. Duró unos cuarenta minutos.':
    'Four sets of pull-ups: eight, seven, six and five. Dips with ten kilos, three sets of eight. It took about forty minutes.',
  'Apuntar lo que he dicho': 'Write down what I said',
  'Apuntarlo y registrar el entreno': 'Write it down and log the workout',
  'Solo rellenarlo, ya lo reviso': "Just fill it in, I'll review it",
  Repetirlo: 'Say it again',
  'La miniatura la pone la plataforma del vídeo.':
    'The thumbnail comes from the video platform.',
  'Días que el alumno debe llevar en tu grupo para verla. Vacío: desde el primer día. Alcanza también a sus mini clases.':
    'Days the student must have been in your group to see it. Empty: from day one. It covers its mini lessons too.',
  opcional: 'optional',
  'Trocea la lección en vídeos más cortos. Si no la necesitas, déjala vacía: la lección funciona igual con su propio vídeo.':
    'Split the lesson into shorter videos. If you do not need this, leave it empty: the lesson works fine with its own video.',
  'Duración (ej. 12 min)': 'Length (e.g. 12 min)',
  'Título de la lección': 'Lesson title',
  'Candado (días)': 'Lock (days)',
  'Ej. 30': 'e.g. 30',
  'Título de la mini clase': 'Mini lesson title',
  '+ Añadir mini clase': '+ Add mini lesson',
  'Ya está activa': "It's active now",
  'Todavía no nos consta el pago. Dale un momento y vuelve a intentarlo.':
    "We don't see the payment yet. Give it a moment and try again.",
  'No se pudo comprobar. Inténtalo otra vez.': "Couldn't check. Try again.",
  Reintentar: 'Try again',
  'Algo no ha ido bien': 'Something went wrong',
  'Ha fallado esta pantalla, pero tu sesión y tus entrenamientos siguen a salvo. Vuelve a intentarlo.':
    'This screen failed, but your session and your workouts are safe. Try again.',
  'Día a día': 'Day by day',
  'Cada barra compara ese día con tu mejor marca. Las series, tal y como las hiciste.':
    'Each bar compares that day with your best. The sets, exactly as you did them.',
  'EMOM · cada ronda arranca al minuto': 'EMOM · every round starts on the minute',
  Intervalo: 'Interval',
  Rondas: 'Rounds',
  Actual: 'Current',
  Cambio: 'Change',
  'Mín / Máx': 'Min / Max',
  'Solicitud enviada': 'Request sent',
  'Tu entrenador tiene que aceptarte en su grupo. Cuando lo haga, entrarás automáticamente. Pulsa “Ya me han aceptado” para comprobarlo.':
    'Your coach has to accept you into their group. Once they do, you get in automatically. Press "They accepted me" to check.',
  'Ya me han aceptado': 'They accepted me',
  'Cancelar solicitud': 'Cancel request',
  'Vincúlate con tu entrenador': 'Link up with your coach',
  'Introduce el código que te ha dado tu entrenador. Le llegará una solicitud con tu nombre y foto para aceptarte.':
    'Enter the code your coach gave you. They will get a request with your name and photo to accept you.',
  'Código del entrenador': 'Coach code',
  'Enviar solicitud': 'Send request',
  'Solicitud cancelada': 'Request cancelled',
  'Universidad de Calistenia': 'University of Calisthenics',
  'Tus datos': 'Your details',
  'Nivel de actividad': 'Activity level',
  'Rellena tus datos para ver tus calorías y macros.':
    'Fill in your details to see your calories and macros.',
  Edad: 'Age',
  años: 'years',
  'Altura (cm)': 'Height (cm)',
  'Ej. 178': 'e.g. 178',
  'Peso (kg)': 'Weight (kg)',
  'Ej. 72,5': 'e.g. 72.5',
  Carbos: 'Carbs',
  Suman: 'Total',
  'Mantén el dedo encima y gírala': 'Hold your finger on it and turn it',
  Delante: 'Front',
  Detrás: 'Back',
  Menos: 'Less',
  Más: 'More',
  'Entrena y marca tus series para ver qué músculos trabajas.':
    'Train and tick your sets to see which muscles you work.',
  'Tus macros en 30 segundos': 'Your macros in 30 seconds',
  'Calcula tus calorías y macros y los tendrás listos en Nutrición. Podrás recalcularlos cuando quieras.':
    'Work out your calories and macros and they will be ready in Nutrition. You can recalculate them whenever you like.',
  '¿Cuál es tu objetivo?': 'What is your goal?',
  'Definirlo más tarde': 'Decide later',
  'Mi objetivo': 'My goal',
  'Ej. Conseguir mi primera dominada': 'e.g. Get my first pull-up',
  'Récord personal': 'Personal record',
  'Mientras tu entrenador tenga un plan activo, manda el suyo.':
    "While your coach has an active plan, theirs is the one that counts.",
  'Todavía no has registrado comidas hoy.': "You haven't logged any meals today.",
  'Libretas de tu coach': "Your coach's books",
  'Recetas y ejemplos de platos que ha preparado tu entrenador.':
    'Recipes and example meals your coach has put together.',
  'Sin fotos todavía.': 'No photos yet.',
  'Sube fotos de frente, perfil y espalda. Solo tú y tu entrenador las veréis.':
    'Upload front, side and back photos. Only you and your coach will see them.',
  'Todavía no has subido fotos de progreso.': "You haven't uploaded any progress photos yet.",
  'Mantén pulsada una foto para borrarla.': 'Press and hold a photo to delete it.',
  'Aún no tienes objetivos': 'No targets yet',
  'Calcula tus calorías y macros en 30 segundos, o espera a que tu entrenador te asigne un plan.':
    'Work out your calories and macros in 30 seconds, or wait for your coach to assign you a plan.',
  '+ Añadir comida': '+ Add meal',
  'Registrar comida': 'Log meal',
  'Ej. Desayuno': 'e.g. Breakfast',
  Kcal: 'Kcal',
  'Carbos (g)': 'Carbs (g)',
  'Añadir comida': 'Add meal',
  'Macros actualizados': 'Macros updated',
  'No se pudieron guardar los macros': "Couldn't save the macros",
  'Foto subida': 'Photo uploaded',
  'Foto borrada': 'Photo deleted',
  '¿Borrar esta foto de progreso?': 'Delete this progress photo?',
  'Esta rutina no tiene ningún ejercicio todavía.': 'This routine has no exercises yet.',
  'Que salga fácil: si la última cuesta, has hecho de más.':
    "Keep it easy: if the last one is a grind, you've done too many.",
  'Estos días no se espera ninguna sesión: la racha no se rompe, no llegan avisos y el plan se retoma justo donde se dejó. Entrenar sigue estando permitido: si un día apetece, cuenta como cualquier otro.':
    'No session is expected on these days: the streak does not break, no reminders arrive and the plan picks up right where it left off. Training is still allowed: if you feel like it one day, it counts like any other.',
  Cuánto: 'How long',
  Desde: 'From',
  'Hasta (incluido)': 'Until (inclusive)',
  'El plan está en pausa': 'The plan is paused',
  'Volver al plan hoy': 'Back to the plan today',
  'Pausar el plan': 'Pause the plan',
  'Motivo (opcional)': 'Reason (optional)',
  FUNDADOR: 'FOUNDER',
  'Ese número es tuyo para siempre. Vuelve y la insignia se enciende otra vez, con el mismo número.':
    'That number is yours forever. Come back and the badge lights up again, with the same number.',
  cumplida: 'met',
  fallada: 'missed',
  descarga: 'deload',
  Ejercicio: 'Exercise',
  'Mostrar todos': 'Show all',
  'Ya están todos los del plan.': 'Every exercise in the plan is already here.',
  Mejora: 'Better',
  Baja: 'Worse',
  Igual: 'Same',
  'Marca: más peso y más reps en series distintas':
    'PR: more weight and more reps in different sets',
  'Serie real: reps · reps×lastre · segundos': 'Actual set: reps · reps×weight · seconds',
  'Cuando se registren entrenamientos, aquí aparecerá el progreso por ejercicio.':
    'Once workouts are logged, progress by exercise will show up here.',
  'Añadir al seguimiento': 'Add to tracking',
  'Ejercicios del plan activo.': 'Exercises from the active plan.',
  'No se pudo guardar la selección': "Couldn't save the selection",
  'No se pudo restaurar': "Couldn't restore",
  '¿Te está gustando UDECA?': 'Are you enjoying UDECA?',
  'Una valoración tuya vale más que cualquier anuncio: es lo que hace que otros se atrevan a probarla.':
    'A review from you is worth more than any advert: it is what makes other people dare to try it.',
  'Valorar la app': 'Rate the app',
  'Saltar descanso': 'Skip rest',
  'Descanso terminado · a por la siguiente serie': 'Rest over · on to the next set',
  '¿Cuántas te quedaban?': 'How many did you have left?',
  '¿Para cuándo?': 'For when?',
  'Destacar (prioridad)': 'Highlight (priority)',
  'Detalles, pasos, enlaces…': 'Details, steps, links…',
  'Escribe algo primero': 'Write something first',
  Eliminado: 'Deleted',
  Activar: 'Activate',
  'Ver el plan completo': 'See the full plan',
  'Con todo abierto, sin recortes. Cuando terminen, lo que has registrado te espera intacto.':
    'Everything unlocked, nothing held back. When it ends, what you logged is waiting for you untouched.',
  'Ahora no, gracias': 'Not now, thanks',
  'Verifica tu correo': 'Verify your email',
  'Te hemos enviado un enlace de verificación a:': "We've sent a verification link to:",
  'Ya lo he verificado': "I've verified it",
  'Reenviar correo': 'Resend email',
  'Aún no aparece verificado. Revisa tu correo (y spam).':
    "It still isn't verified. Check your inbox (and spam).",
  'Correo de verificación reenviado': 'Verification email resent',
  'Vídeo no disponible': 'Video not available',
  'No se ha podido cargar el vídeo': 'The video could not be loaded',
  'Ver más grande': 'View larger',
  'Este alumno no tiene rutina activa, así que todavía no hay ejercicios que programar. Créale una y vuelve.':
    'This student has no active routine, so there is nothing to programme yet. Create one and come back.',
  'Sugerir +1 rep': 'Suggest +1 rep',
  'Tu alumno verá estos números en su entreno de esta semana.':
    "Your student will see these numbers in this week's workout.",
  'Aplicar también a': 'Also apply to',
  'Se les copia en la misma semana. A quien no la tenga en su plan, se le salta.':
    "It's copied into the same week for them. Anyone without that week in their plan is skipped.",
  'Quitar la programación de esta semana': "Remove this week's programming",
  'Guardar semana': 'Save week',
  'Una repetición más donde el objetivo era exacto':
    'One more rep wherever the target was an exact number',
  'Esta semana vuelve a la rutina': 'This week goes back to the routine',

  // --- Trozos sueltos ---
  //
  // Cuando una frase lleva un dato dentro, React la parte: `Semana {n} de {m}`
  // llega como ['Semana ', n, ' de ', m]. Cada trozo se busca por su cuenta, así
  // que la clave incluye sus espacios: " de " no es lo mismo que "de", y
  // equivocarse aquí deja la frase pegada ("Week3of8").
  'Hasta (13/02/2027)': 'Until (13/02/2027)',
  día: 'day',
  días: 'days',
  ' de ': ' of ',
  ' series': ' sets',
  ' sesiones': ' sessions',
  ' bloque': ' block',
  ' bloques · ': ' blocks · ',
  ' entrenos': ' workouts',
  ' entreno': ' workout',
  ' entrenamientos': ' workouts',
  ' entrenamiento': ' workout',
  ' ejercicios': ' exercises',
  ' semana': ' week',
  ' semanas · ': ' weeks · ',
  ' semanas ·': ' weeks ·',
  ' sem': ' wk',
  ' día': ' day',
  ' días': ' days',
  ' alumno': ' student',
  ' alumnos.': ' students.',
  ' fotos': ' photos',
  'Serie ': 'Set ',
  'Semana ': 'Week ',
  'Día ': 'Day ',
  'Día:': 'Day:',
  'Paso ': 'Step ',
  ' de 5': ' of 5',
  'Última vez: ': 'Last time: ',
  'Los ': 'The ',
  'Empezar ciclo hoy · actual:': 'Start the cycle today · current:',
  'Todo el día · ': 'All day · ',
  'Has entrado como ': 'You signed in as ',
  '. Solo falta saber cómo vas a usar UDECA.':
    ". We just need to know how you're going to use UDECA.",
  'Tu cuenta ': 'Your account ',
  ' se creó con contraseña. Escríbela una última vez y la dejamos unida a tu cuenta de Google: no perderás nada y a partir de ahora entras de un toque.':
    " was created with a password. Type it one last time and we'll link it to your Google account: you lose nothing, and from now on you get in with one tap.",
  ' Entrar': ' Sign in',
  'Con tu entrenador o por tu cuenta, con ': 'With your coach or on your own, with ',
  ' días abiertos para probarlo. Y si entrenas a otros, empiezas con ':
    ' days open to try it out. And if you train others, you start with ',
  'Se desbloquea en ': 'Unlocks in ',
  'Sigues por: ': "You're up to: ",
  ' ejercicios · Empezar sesión': ' exercises · Start session',
  ' días rotan en ciclo (Día 1 → ': ' days rotate in a cycle (Day 1 → ',
  ' → repite), sin depender del día de la semana. Ajusta la intensidad de cada día abajo.':
    " → repeat), with no tie to the weekday. Adjust each day's intensity below.",
  'Los días que te toca entrenar y no has registrado la sesión, te aviso cada hora desde las ':
    "On the days you are due to train and haven't logged the session, I remind you every hour from ",
  ' hasta las 22:00. En cuanto la registres, paran.':
    ' until 22:00. As soon as you log it, they stop.',
  'Ver los ': 'See the ',
  'Ese día ya tienes ': 'That day already has ',
  '. Si lo registras otra vez, saldrán los dos.': '. If you log it again, both will show up.',
  'Quién más se superó en ': 'Who beat themselves the most in ',
  'entrenos este mes': 'workouts this month',
  'Tu plan está en pausa hasta el ': 'Your plan is paused until ',
  '. Hoy no se espera nada, pero si entrenas cuenta igual.':
    '. Nothing is expected today, but if you train it counts all the same.',
  ' series sueltas, ninguna al fallo': ' single sets, none to failure',
  'Puedes descansar hoy, o reiniciar el ciclo y entrenar el Día 1 ahora. Tú decides.':
    'You can rest today, or restart the cycle and train Day 1 now. Your call.',
  'Descanso ': 'Rest ',
  'Agarre ': 'Grip ',
  'Objetivo: ': 'Target: ',
  'Clúster ': 'Cluster ',
  'BLOQUE ': 'BLOCK ',
  'Descanso entre bloques · ': 'Rest between blocks · ',
  'Apunta lo que quieras sacar adelante ': 'Jot down whatever you want to get done ',
  'Completadas · ': 'Completed · ',
  'Entrenos del ciclo (': 'Workouts in this cycle (',
  ' declaró que ya ha pagado (': ' said they have already paid (',
  '). Confírmalo con "Registrar pago".': '). Confirm it with "Log payment".',
  'Enlace de pago de ': 'Payment link for ',
  ' de entrenamiento': ' of training',
  'Peso objetivo: ': 'Target weight: ',
  'Los que le pides cada día. Los ve en su pestaña de nutrición, y lo que ande le suma calorías al plan del día. Si lo dejas vacío, se le piden':
    "What you ask of them each day. They see it in their nutrition tab, and whatever they walk adds calories to that day's plan. If you leave it empty, they are asked for",
  'g G': 'g F',
  ' · G': ' · F',
  '/7 días esta semana': '/7 days this week',
  ' · toca para aplicar': ' · tap to apply',
  ' días rotan en bucle (1 → ': ' days rotate in a loop (1 → ',
  ' → 1), sin atarse al calendario. Marca uno como “Opcional” y el alumno elige: descansar o volver al Día 1.':
    ' → 1), with no tie to the calendar. Mark one as "Optional" and the student chooses: rest, or go back to Day 1.',
  ' del ciclo': ' of the cycle',
  'Intensidad · ': 'Intensity · ',
  ' · goma': ' · band',
  ' · lastre': ' · added weight',
  'Medida: ': 'Measured in: ',
  ' · lo decide el grupo «': ' · decided by the group «',
  'Crear ejercicio nuevo': 'Create a new exercise',
  'Se saltó ': 'Skipped ',
  ' pago': ' payment',
  ' vencido': ' overdue',
  ' ha': ' has',
  ' entrenado hoy': ' trained today',
  ' en total': ' in total',
  'Pendiente (': 'Pending (',
  'Previsto 30 días (': 'Expected in 30 days (',
  ' pendiente': ' pending',
  Renueva: 'Renews',
  ' · precarga oficial para entrenadores': ' · official preload for coaches',
  ' esta semana · ': ' this week · ',
  ' totales': ' total',
  '% de los del paso anterior': '% of the previous step',
  'Altas por tipo — coach ': 'Sign-ups by type — coach ',
  ' · atleta': ' · athlete',
  ' · alumno': ' · student',
  'Muro de pago visto ': 'Paywall seen ',
  ' · pagos iniciados': ' · payments started',
  ' · altas fallidas': ' · failed sign-ups',
  ' usuario(s) · ': ' user(s) · ',
  ' · versión ': ' · version ',
  'Nada de eso lleva tu nombre ni tu correo una vez desaparece tu perfil. Si quieres que se borre también, escríbenos a ':
    'None of that carries your name or your email once your profile is gone. If you want it deleted too, write to us at ',
  ' y lo hacemos a mano en un máximo de 30 días.':
    ' and we will do it by hand within 30 days at most.',
  'Entra en UDECA y ve a ': 'Open UDECA and go to ',
  ', al final de la pantalla. Son cinco pasos: te explicamos qué se borra, tienes que escribir "ELIMINAR MI CUENTA" y volver a confirmar que eres tú con Google o con Apple, lo mismo con lo que entras. Al terminar, tu cuenta y tus datos desaparecen en el momento. Vale para cualquier tipo de perfil: alumno, atleta y entrenador.':
    ', at the bottom of the screen. It is five steps: we explain what gets deleted, you have to type "DELETE MY ACCOUNT" and confirm it is you with Google or Apple, the same one you sign in with. When you finish, your account and your data disappear straight away. It works for any kind of profile: student, athlete and coach.',
  'UDECA (Universidad de Calistenia) es una aplicación de entrenamiento de calistenia que conecta a entrenadores con sus alumnos y permite a atletas individuales gestionar su propio plan. Esta política explica qué datos tratamos, con qué finalidad y qué derechos tienes. El responsable del tratamiento es el titular de UDECA; puedes contactar en cualquier momento en ':
    'UDECA (University of Calisthenics) is a calisthenics training app that connects coaches with their students and lets individual athletes manage their own plan. This policy explains what data we process, what for, and what rights you have. The data controller is the owner of UDECA; you can get in touch at any time at ',
  'Borrar el último (': 'Delete the last one (',
  ' kcal de gasto, aproximadas': ' kcal burned, approximate',
  'Media de la semana: ': 'Weekly average: ',
  ' pasos al día': ' steps a day',
  'Las semanas van de lunes a domingo, así que el plan arranca el lunes':
    'Weeks run Monday to Sunday, so the plan starts on a Monday',
  ' en el mesociclo': ' in the mesocycle',
  'hasta ': 'until ',
  'Duración: ': 'Length: ',
  'Esto no lo he sabido colocar: ': "I couldn't work out where this goes: ",
  '. Añádelo tú a mano si hace falta.': '. Add it by hand if you need to.',
  ' en': ' in',
  '. Si algo no cuadra, repítelo y lo apunto otra vez.':
    ". If something is off, say it again and I'll write it down again.",
  'Lección ': 'Lesson ',
  'Mini clases': 'Mini lessons',
  'Récord ': 'PR ',
  ' kcal/día': ' kcal/day',
  'Tu marca era ': 'Your best was ',
  'Objetivo por serie: ': 'Target per set: ',
  ' · nunca al fallo': ' · never to failure',
  'Hasta el ': 'Until ',
  ' en pausa · vuelve el': ' paused · back on',
  ' más en el plan': ' more in the plan',
  ' de prueba': ' trial',
  'Tu alta incluye ': 'Your sign-up includes ',
  'quedan ': 'left: ',
  'queda {0}': '{0} left',
  'quedan {0}': '{0} left',

  // --- Palabras sueltas que llegan como dato ---
  //
  // Salen de una variable, no de un `<Text>`: el nivel guardado en la ficha, el
  // estado de una suscripción. Se buscan igual porque la clave sigue siendo la
  // palabra en español.
  Principiante: 'Beginner',
  Intermedio: 'Intermediate',
  Avanzado: 'Advanced',
  'De prueba': 'Trial',
  Activo: 'Active',
  'Un alumno': 'A student',
  'este hábito': 'this habit',
  'día de hoy': 'today',
  ' (descanso)': ' (rest)',
  'día entrenado': 'day trained',
  'días entrenados': 'days trained',
  imagen: 'image',
  imágenes: 'images',
  ' · descarga': ' · deload',
  'No se usa': 'Not used',

  // --- Frases con datos dentro ---
  //
  // La clave la arma `frase` (lib/idioma.ts): el español con los huecos
  // numerados en el orden en que aparecen. Los huecos NO se traducen —son
  // nombres, fechas y cifras—, así que pueden cambiar de sitio en inglés
  // siempre que se conserve su número.
  'Día {0}': 'Day {0}',
  'Día {0} de {1}': 'Day {0} of {1}',
  'Día {0}{1}{2}': 'Day {0}{1}{2}',
  'Semana {0}': 'Week {0}',
  'Semana {0}{1}': 'Week {0}{1}',
  'Semana programada{0}': 'Week programmed{0}',
  'Hoy es el Día {0}': 'Today is Day {0}',
  '{0} series': '{0} sets',
  '{0} series al día': '{0} sets a day',
  '{0} entrenos': '{0} workouts',
  '{0} kg de volumen': '{0} kg of volume',
  '{0} kg de goma': '{0} kg of band',
  '{0} días': '{0} days',
  '{0} días parado': '{0} days idle',
  'Hace {0} días': '{0} days ago',
  'hace {0} días': '{0} days ago',
  // Retomar el ciclo por donde ibas (components/UltimoEntreno.tsx).
  hoy: 'today',
  ayer: 'yesterday',
  'Tu último entreno': 'Your last session',
  // El muro de actualizar (components/ActualizacionObligatoria.tsx).
  'Hay una versión nueva': 'There is a new version',
  // La rutina diaria: lo que se hace todos los días aparte del plan.
  'Rutina diaria': 'Daily routine',
  'Tu rutina diaria': 'Your daily routine',
  'Lo que hará todos los días aparte de su plan: pino, movilidad, lo que se repite. Corto y a diario.':
    'What they will do every day on top of their plan: handstand, mobility, whatever repeats. Short and daily.',
  'Lo que harás todos los días aparte de tu plan: pino, movilidad, lo que se repite. Corto y a diario.':
    'What you will do every day on top of your plan: handstand, mobility, whatever repeats. Short and daily.',
  'Activa: la ve en su Entreno': 'On: they see it in their Training',
  'Activa: la ves en tu Entreno': 'On: you see it in your Training',
  'Apagada. Los ejercicios se guardan igual.': 'Off. The exercises are kept anyway.',
  'Ejercicio (p. ej. Pino contra pared)': 'Exercise (e.g. Wall handstand)',
  'Objetivo (p. ej. 3 series de 30 s)': 'Target (e.g. 3 sets of 30 s)',
  'Hecha. Mañana otra vez.': 'Done. Again tomorrow.',
  '{0} cosas cortas, cuando puedas.': '{0} short things, whenever you can.',
  'Una cosa corta, cuando puedas.': 'One short thing, whenever you can.',
  '{0} de {1}. Lo que caiga suma.': '{0} of {1}. Whatever you get counts.',
  'apagada': 'off',
  'sin ejercicios': 'no exercises',
  // El contador de pasos, que ahora se conecta una sola vez.
  '¿De dónde saco tus pasos?': 'Where do I get your steps from?',
  'Se elige una vez. A partir de ahí aparecen solos cada día.':
    'You choose once. From then on they appear on their own every day.',
  'Este móvil': 'This phone',
  'Los escribo yo': 'I type them in',
  'De mi iPhone': 'From my iPhone',
  'De este móvil': 'From this phone',
  'Se leen solos de tu iPhone': 'Read automatically from your iPhone',
  'Se leen solos de este móvil': 'Read automatically from this phone',
  'Los escribes tú': 'You type them in',
  'Cambiar': 'Change',
  'Puedes cambiarlo cuando quieras. Lo que ya está apuntado no se toca.':
    'You can change it whenever you like. What is already recorded is left alone.',
  'Dejarlo como está': 'Leave it as it is',
  'Esta versión de UDECA ya no está al día. Actualiza para seguir entrenando: tus datos, tus rutinas y tu progreso te esperan intactos.':
    'This version of UDECA is out of date. Update to keep training: your data, your routines and your progress are waiting, untouched.',
  'Actualizar en la App Store': 'Update on the App Store',
  'Actualizar en Google Play': 'Update on Google Play',
  'Tienes la {0}': 'You have {0}',
  'Tu ciclo sigue por el {0}.': 'Your cycle carries on with {0}.',
  'Tu ciclo sigue por el {0}, que es descanso.':
    'Your cycle carries on with {0}, which is a rest day.',
  'Seguir por el {0}': 'Carry on with {0}',
  'Elegir otro día': 'Pick another day',
  'hace {0} semanas': '{0} weeks ago',
  'hace {0} meses': '{0} months ago',
  'Ver los {0} días': 'See all {0} days',
  'de {0}': 'of {0}',
  ' de {0}': ' of {0}',
  '{0} de {1}': '{0} of {1}',
  '{0} de {1} hechas': '{0} of {1} done',
  '{0} de {1} lecciones': '{0} of {1} lessons',
  '{0}% de media': '{0}% on average',
  ' y {0} más': ' and {0} more',
  ' · desde el {0}': ' · from {0}',
  '{0} · desde el {1}': '{0} · from {1}',
  ' · hasta {0}': ' · until {0}',
  '{0} · hasta {1}': '{0} · until {1}',
  '{0}: activo hasta {1}': '{0}: active until {1}',
  'CADUCADO · desde {0}': 'EXPIRED · since {0}',
  ' · lleva {0} días': ' · {0} days in',
  ' día{0} de racha': ' day{0} streak',
  'Racha: {0} días': 'Streak: {0} days',
  'Racha de {0} días\n': '{0}-day streak\n',
  'Racha de {0} días. Sigue así.': '{0}-day streak. Keep it up.',
  '¡{0} días de racha!': '{0}-day streak!',
  'Llevas {0} de {1} sesiones.': "You're at {0} of {1} sessions.",
  '{0} para cerrarla': '{0} to close it',
  'Ahora: Serie {0} · {1}': 'Now: Set {0} · {1}',
  '{0} entreno(s) pendiente(s) subido(s) ✓': '{0} pending workout(s) uploaded ✓',
  '{0}\n\nEntreno con UDECA — Universidad de Calistenia':
    '{0}\n\nTraining with UDECA — University of Calisthenics',
  '{0} ha registrado {1} del {2}.': '{0} logged {1} from {2}.',
  'Registrar el entreno del {0}': "Log the workout from {0}",
  'Aún no hay series de {0} registradas.': 'No {0} sets logged yet.',
  'Todo el día · {0} series': 'All day · {0} sets',
  'Hoy: {0} series repartidas. Ninguna al fallo.':
    'Today: {0} sets spread through the day. None to failure.',
  'Llevas {0}. Quedan {1}, sin prisa y sin apretar.':
    "You've done {0}. {1} to go, no rush and no grinding.",
  'Se desbloquea en {0} día{1}': 'Unlocks in {0} day{1}',
  'Superado x{0} veces': 'Beaten {0} times',
  'Últimas {0} semanas': 'Last {0} weeks',
  '{0} {1} de {2}': '{0} {1} of {2}',
  '{0} · llevas {1} días sin entrenar': "{0} · {1} days without training",
  'Miembro desde {0}': 'Member since {0}',
  'De {0} en tu grupo': 'Of {0} in your group',
  'Estás en tu objetivo de {0} kg.': "You're at your target of {0} kg.",
  'Te faltan perder {0} kg para tu objetivo de {1} kg.':
    'You have {0} kg to lose to reach your target of {1} kg.',
  'Te faltan ganar {0} kg para tu objetivo de {1} kg.':
    'You have {0} kg to gain to reach your target of {1} kg.',
  'Hoy aún no has andado. El objetivo son {0} pasos.':
    "You haven't walked yet today. The target is {0} steps.",
  'Te quedan {0} pasos para el objetivo.': '{0} steps to go to reach your target.',
  '{0} · {1} del plan + {2} por andar': '{0} · {1} from the plan + {2} for walking',
  'El {0} de {1}': '{0} {1}',
  'Del {0} al {1} de {2}': 'From {0} to {1} {2}',
  'Del {0} de {1} al {2} de {3}': 'From {0} {1} to {2} {3}',
  'Hoy tocaba {0}. Si ya lo has hecho, regístralo y queda guardado.':
    '{0} was due today. If you already did it, log it and it stays saved.',
  '{0} sigue sin registrar': '{0} is still not logged',
  'Solo falta apuntar {0}. Tu racha cuenta lo que registras.':
    'All that is left is logging {0}. Your streak counts what you log.',
  '{0} de hoy todavía se puede registrar.': "Today's {0} can still be logged.",
  '{0}, esta clase va marcada con tu nombre: cualquier copia lleva tu cuenta encima. Compartirla es motivo de baja.':
    '{0}, this lesson is watermarked with your name: any copy carries your account on it. Sharing it is grounds for removal.',
  'El curso pesa demasiado para guardarse ({0} KB de ':
    'The course is too heavy to save ({0} KB of ',
  '{0}: quita alguna miniatura y vuelve a guardar.':
    '{0}: remove a thumbnail or two and save again.',
  'Sin enlace, {0} € se cobran por fuera y se confirman a mano. Con enlace, tu alumno paga de un toque.':
    'Without a link, {0} € is collected outside the app and confirmed by hand. With a link, your student pays in one tap.',

  // --- Frases con datos: entrar, alta y suscripción ---
  'No se ha podido entrar con {0}. Inténtalo otra vez.':
    "Couldn't sign in with {0}. Try again.",
  'Entrenas por tu cuenta. Empiezas con {0} días con todo abierto.':
    'You train on your own. You start with {0} days with everything unlocked.',
  'Entrenas por tu cuenta: tus rutinas, tu progreso y tu nutrición. Empiezas con {0} días con todo abierto.':
    'You train on your own: your routines, your progress and your nutrition. You start with {0} days with everything unlocked.',
  'Tus alumnos, tus cobros y tu negocio. El alta incluye {0} alumnos.':
    'Your students, your payments and your business. Signing up includes {0} students.',
  'Tus alumnos, tus cobros y tu negocio. El plan de entrada incluye {0} alumnos.':
    'Your students, your payments and your business. The entry plan includes {0} students.',
  'Con el alta empiezan tus {0} días con todo abierto. Después decides si sigues.':
    'Signing up starts your {0} days with everything unlocked. After that you decide whether to carry on.',
  'El alta incluye {0} alumnos con su propia cuenta. Si tu grupo crece, entonces hablamos.':
    'Signing up includes {0} students with their own account. If your group grows, then we talk.',
  'Hola, quiero activar mi cuenta de UDECA. Mi correo es: {0}':
    'Hello, I would like to activate my UDECA account. My email is: {0}',
  'Te quedan {0} días de prueba': '{0} trial days left',
  'Te quedan {0} días de prueba. Si ya lo tienes claro, pasa al plan completo y olvídate del contador.':
    '{0} trial days left. If you already know this is for you, move to the full plan and forget the countdown.',
  // La tarjeta del plan del entrenador: lo que cambia, y lo que ya tiene.
  'Lo que cambia': 'What changes',
  'Ahora': 'Now',
  'Con el plan': 'With the plan',
  'Sin tope': 'No cap',
  'Sin plazas': 'No places',
  '{0} alumnos': '{0} students',
  'Ya lo tienes con tu alta': 'Already yours with your sign-up',
  'Rutinas, ciclos y calendario': 'Routines, cycles and calendar',
  'Nutrición, macros y pasos': 'Nutrition, macros and steps',
  'Cursos y clases VIP': 'Courses and VIP classes',
  'El plan no desbloquea funciones: las tienes todas desde el primer día. Lo que quita es el tope de alumnos.':
    'The plan does not unlock features: you have them all from day one. What it removes is the cap on students.',
  'Has llenado tus {0} plazas': "You've filled your {0} places",
  'Tu alta incluye {0} alumnos': 'Your sign-up includes {0} students',
  'Tu alta incluye {0} alumnos. Activa la suscripción anual para aceptar a más.':
    'Your sign-up includes {0} students. Activate the annual subscription to accept more.',
  'Para aceptar al alumno {0} hace falta el plan. Los {1} que ya tienes siguen contigo pagues o no.':
    'To accept student {0} you need the plan. The {1} you already have stay with you whether you pay or not.',
  'Ya llevas {0} de {1}, y son tuyos para siempre. Del alumno {2} en adelante hace falta el plan, y el grupo deja de tener tope.':
    "You're at {0} of {1}, and they are yours forever. From student {2} onwards you need the plan, and the group stops having a cap.",
  'Están todas ocupadas. Los {0} que ya tienes siguen contigo pagues o no; para aceptar al {1} hace falta el plan.':
    'They are all taken. The {0} you already have stay with you whether you pay or not; to accept number {1} you need the plan.',
  'Son tuyas para siempre, sin caducidad. Del alumno {0} en adelante hace falta el plan.':
    'They are yours forever, with no expiry. From student {0} onwards you need the plan.',
  'Tu grupo ha superado los {0} alumnos que incluye el alta. Activa la suscripción anual para seguir con todos. Tus datos están a salvo y te esperan.':
    'Your group has gone past the {0} students included with signing up. Activate the annual subscription to keep them all. Your data is safe and waiting for you.',
  '¿Algún problema con tu cuenta? Escríbenos a {0}.':
    'Any trouble with your account? Write to us at {0}.',
  'Aún no: {0}': 'Not yet: {0}',
  'Hoy pierdes la insignia de fundador. El {0} sigue siendo tuyo: vuelve y se enciende otra vez.':
    'Today you lose the founder badge. The {0} is still yours: come back and it lights up again.',
  'Tu insignia de fundador se apaga en {0} {1}. El número no lo pierdes: al renovar vuelve a encenderse.':
    'Your founder badge switches off in {0} {1}. You do not lose the number: it lights up again when you renew.',

  // --- Frases con datos: cobros ---
  'Tu cuota de {0} venció el {1}.{2}': 'Your {0} fee was due on {1}.{2}',
  ' Te quedan {0} días antes de que el acceso se pause.':
    ' You have {0} days before your access is paused.',
  ' Te queda 1 día antes de que el acceso se pause.':
    ' You have 1 day before your access is paused.',
  'Hoy vence tu cuota de {0}. Ponte al día con tu entrenador.':
    'Your {0} fee is due today. Settle up with your coach.',
  'Tu cuota de {0} vence mañana ({1}).': 'Your {0} fee is due tomorrow ({1}).',
  'Tu cuota de {0} vence en {1} días ({2}).': 'Your {0} fee is due in {1} days ({2}).',
  'Tienes un pago pendiente de {0}. Renueva con tu entrenador.':
    'You have a payment of {0} outstanding. Renew with your coach.',
  'Tu entrenador espera el pago de {0}. Ponte al día cuando puedas.':
    'Your coach is waiting for the {0} payment. Settle up when you can.',
  '{0} dice que ya ha pagado su cuota. Revísalo y confírmalo.':
    '{0} says they have already paid their fee. Check it and confirm.',
  'Tienes pendiente la cuota con {0}. En cuanto se resuelva, sigues justo donde lo dejaste.':
    'Your fee with {0} is outstanding. As soon as it is sorted, you carry on right where you left off.',
  'Hola {0}, tienes un pago pendiente de tu suscripción. ¡Gracias!':
    'Hello {0}, you have an outstanding subscription payment. Thank you!',
  'Cobro de {0} confirmado': "{0}'s payment confirmed",
  'Cobro confirmado · a {0} le faltan {1} mensualidad(es)':
    '{0} owes {1} more month(s)',
  'Pagos pendientes ({0})': 'Payments pending ({0})',
  'Previsto 30 días ({0} €)': 'Expected in 30 days ({0} €)',
  '+{0} días · próximo pago {1}': '+{0} days · next payment {1}',
  '{0} € · pagado hasta {1}': '{0} € · paid up to {1}',

  // --- Frases con datos: el coach y su grupo ---
  'Acciones de {0}': 'Actions for {0}',
  'Alumnos en vivo no disponible: {0}': 'Live students unavailable: {0}',
  'Lista en vivo no disponible: {0}': 'Live list unavailable: {0}',
  'Comunidad en vivo no disponible: {0}': 'Live community unavailable: {0}',
  '{0} ya está en tu grupo': '{0} is now in your group',
  '{0} sin entrenar': '{0} not training',
  ' · {0} más que la semana pasada': ' · {0} more than last week',
  ' · {0} menos que la semana pasada': ' · {0} fewer than last week',
  'Para {0}': 'For {0}',
  'Tu entrenador ha actualizado tu plan: {0}': 'Your coach has updated your plan: {0}',
  'Escribe entre {0} y {1} pasos.': 'Type between {0} and {1} steps.',
  '{0} (por defecto)': '{0} (default)',
  '¿Quitar "{0}" de sus hábitos?': 'Remove "{0}" from their habits?',
  '¿Quitar la suscripción de {0}? Verá el muro de pago hasta reactivarla.':
    "Remove {0}'s subscription? They will see the paywall until it is reactivated.",
  '¿ELIMINAR la cuenta de {0} ({1})? Perderá el acceso y desaparecerá de la plataforma. Esta acción no se puede deshacer.':
    "DELETE {0}'s account ({1})? They will lose access and disappear from the platform. This cannot be undone.",
  'Se eliminará a {0} de la tabla. Sus entrenos e historial no se tocan. Si sigue usando la app y entrena, volverá a aparecer.':
    '{0} will be removed from the table. Their workouts and history are untouched. If they keep using the app and train, they will show up again.',
  '2) Regístrate como alumno con mi código: {0}\n\n':
    '2) Sign up as a student with my code: {0}\n\n',
  'Borrador generado (nivel {0}) · revísalo y ajusta':
    'Draft generated ({0} level) · review it and adjust',
  'Máximo {0} fotos por libreta. Crea otra libreta.':
    'Maximum {0} photos per book. Create another book.',
  '¿Borrar la libreta "{0}"? Tus alumnos dejarán de verla.':
    'Delete the book "{0}"? Your students will stop seeing it.',
  '{0} en tu calendario{1}': '{0} in your calendar{1}',

  // --- Frases con datos: ejercicios y plantillas ---
  'los {0} ejercicios': 'the {0} exercises',
  '«{0}» se mide en {1}': '"{0}" is measured in {1}',
  '«{0}» ya no impone medida': '"{0}" no longer forces a measure',
  'Nuevo subgrupo de {0}…': 'New {0} subgroup…',
  'Se mide en · grupo «{0}»': 'Measured in · group "{0}"',
  'Lo que elijas aquí vale para {0} de este grupo y para los que añadas después. No hay que ponerlo uno a uno.':
    'What you choose here applies to {0} in this group and to any you add later. There is no need to set them one by one.',
  'Elige una y se aplicará a {0} de «{1}» y a todos los que metas ahí a partir de ahora.':
    'Pick one and it will apply to {0} in "{1}" and to every one you put there from now on.',
  'Se actualizarán también los ejercicios que ya están en «{0}».':
    'The exercises already in "{0}" will be updated too.',
  '{0} ejercicios añadidos a tu biblioteca': '{0} exercises added to your library',
  '{0} ejercicios añadidos desde tu cuenta': '{0} exercises added from your account',
  'Añadir el pack UDECA ({0} ejercicios)': 'Add the UDECA pack ({0} exercises)',
  'Sustituir por {0} ejercicios': 'Replace with {0} exercises',

  // --- Frases con datos: planificación y bloques ---
  'Plan creado · {0} semanas': 'Plan created · {0} weeks',
  'Plantilla aplicada · {0} semanas': 'Template applied · {0} weeks',
  ' · {0} entrenos': ' · {0} workouts',
  'Del {0} al {1} · {2} entrenos previstos': 'From {0} to {1} · {2} workouts planned',
  'Traer de {0}': 'Bring from {0}',
  ' · {0} alumno{1} más ({2} sin esa semana)':
    ' · {0} more student{1} ({2} without that week)',
  ' · y {0} alumno{1} más': ' · and {0} more student{1}',
  '{0} ejercicios con números propios esta semana. Tu alumno los ve en su entreno.':
    '{0} exercises with their own numbers this week. Your student sees them in their workout.',
  'Se borran también los {0} ciclos que cuelgan de él (bloques y semanas). ':
    'The {0} cycles hanging off it (blocks and weeks) are deleted too. ',
  'Series hechas de previstas · {0} de {1} hasta hoy':
    'Sets done out of planned · {0} of {1} so far',
  'Series hechas · {0} en el bloque. La rutina va a sensaciones, así que no hay previsión que comparar.':
    'Sets done · {0} in the block. The routine goes by feel, so there is no plan to compare against.',
  '{0}: de {1} a {2}': '{0}: from {1} to {2}',
  'Estaban previstas {0} en el bloque y no ha hecho ninguna.':
    '{0} were planned in the block and they did none.',
  'El plan pide mucho más {0} que {1}': 'The plan asks for far more {0} than {1}',
  '{0} series previstas contra {1}.': '{0} sets planned against {1}.',
  '{0} muy por encima del {1}': '{0} well above {1}',
  '{0} series contra {1} en todo el bloque.': '{0} sets against {1} across the whole block.',
  'Se salta el {0}': 'Skips {0}',
  'El plan está equilibrado, pero ha hecho {0} series contra {1}.':
    'The plan is balanced, but they did {0} sets against {1}.',
  '{0}: {1} series, y la semana anterior {2}.': '{0}: {1} sets, and {2} the week before.',
  '{0}: {1} de {2} entrenos': '{0}: {1} of {2} workouts',
  ' Se muestran las últimas {0} semanas del periodo.':
    ' Showing the last {0} weeks of the period.',

  // --- Frases con datos: nutrición y dictado ---
  '{0} kcal por encima de las {1} que has puesto arriba.':
    '{0} kcal above the {1} you set above.',
  '{0} kcal por debajo de las {1} que has puesto arriba.':
    '{0} kcal below the {1} you set above.',

  // --- Lo que no sale de un <Text> literal ---
  //
  // Frases que viven en una constante, un array de opciones o el `return` de
  // una función: llegan a la pantalla igual, así que se traducen igual. Lo que
  // NO está aquí a propósito es lo que se GUARDA —los ejercicios de la
  // biblioteca base, los nombres de las plantillas que el entrenador edita—,
  // porque eso deja de ser texto de la app en cuanto alguien lo toca.
  'Entrenas con tu entrenador, que te manda el plan. Hace falta su código.':
    'You train with your coach, who sends you the plan. You need their code.',
  'Entrenas con tu entrenador, que te manda el plan. Necesitas su código.':
    'You train with your coach, who sends you the plan. You need their code.',
  'Pon tu nombre para que tu entrenador sepa quién eres.':
    'Put your name in so your coach knows who you are.',
  'Hace falta el código de tu entrenador.': "Your coach's code is required.",
  'No se ha podido crear la cuenta.': "Couldn't create the account.",
  'tu cuenta de Google': 'your Google account',
  'tu cuenta': 'your account',
  'No se ha podido enlazar la cuenta.': "Couldn't link the account.",
  'Te hemos enviado un correo para restablecerla. Revisa tu bandeja (y el spam).':
    "We've sent you an email to reset it. Check your inbox (and spam).",
  'elige una': 'pick one',
  'Usar otra cuenta de Google': 'Use another Google account',
  'Usar otra cuenta de Apple': 'Use another Apple account',
  'Continuar con Apple': 'Continue with Apple',
  'Tu cuerpo es el gimnasio': 'Your body is the gym',
  'Calistenia de verdad: dominar tu propio peso. Sin máquinas, sin excusas y desde donde estés.':
    'Real calisthenics: mastering your own bodyweight. No machines, no excuses, from wherever you are.',
  'Método, no improvisación': 'Method, not improvisation',
  'Planes con progresión medida. Cada serie, cada segundo de isométrico y cada récord quedan registrados.':
    'Plans with measured progression. Every set, every second of a hold and every PR is logged.',
  'Solo o acompañado': 'Alone or with others',
  'Entrena con tu entrenador y tu grupo, o crea tú mismo tu plan como atleta independiente.':
    'Train with your coach and your group, or build your own plan as an independent athlete.',

  // --- Cursos ---
  sección: 'section',
  vídeo: 'video',
  vídeos: 'videos',
  Lección: 'Lesson',
  lección: 'lesson',
  'Vista · ir a la siguiente': 'Watched · go to the next one',
  'Sin título': 'Untitled',
  'No se pudo cargar la imagen': "Couldn't load the image",
  'El título del curso es obligatorio.': 'The course title is required.',
  'El curso no cabe.': "The course doesn't fit.",
  'este curso': 'this course',

  // --- Inicio del alumno ---
  'Sube tu foto de perfil': 'Upload your profile photo',
  'Registra tu peso inicial': 'Log your starting weight',
  'Crea tu plan de entreno': 'Create your training plan',
  'Completa tu primer entrenamiento': 'Complete your first workout',
  'Pago declarado': 'Payment reported',
  'tu cuota': 'your fee',
  ' Tu acceso queda en pausa hasta que se resuelva.':
    ' Your access is paused until this is sorted.',
  'Cobro pendiente': 'Payment due',
  'Cobro próximo': 'Payment coming up',
  'Último día. Mañana vuelves al plan.': 'Last day. Tomorrow you are back on the plan.',
  'Días sueltos': 'Standalone days',
  'Tu entrenamiento': 'Your training',
  'Semana cerrada': 'Week closed',
  'Objetivo cumplido. Lo que venga es de propina.':
    'Target hit. Anything else is a bonus.',
  'Crea tu plan para ver aquí tu semana y tu objetivo de sesiones.':
    'Create your plan to see your week and your session target here.',
  'Cuando tengas rutina asignada verás aquí tu plan y objetivo semanal.':
    'Once you have a routine assigned you will see your plan and weekly target here.',
  'Sin registrar': 'Not logged',
  'Sin inicio': 'Not started',
  'Sin empezar': 'Not started',

  // --- Perfil del alumno ---
  'No se pudo actualizar la foto.': "Couldn't update the photo.",
  'Foto de perfil': 'Profile photo',
  'Miembro desde': 'Member since',
  'recordatorio de entreno': 'training reminder',
  ' (Suena en la app de móvil.)': ' (It rings in the phone app.)',

  // --- Progreso ---
  'Tu bloque en curso': 'Your current block',
  'Cómo se te reparte el trabajo': 'How your work is spread out',
  'La mejor serie de cada ejercicio, semana a semana.':
    'The best set of each exercise, week by week.',
  'La misma tabla que ve tu entrenador.': 'The same table your coach sees.',
  sesión: 'session',
  'No se pudo registrar': "Couldn't log it",
  'Registrar entreno': 'Log workout',
  'un entreno': 'a workout',
  'Récords de la semana': 'PRs of the week',
  'Últimos récords': 'Latest PRs',
  'en línea': 'online',

  // --- Entrenar ---
  'Última serie hecha · guarda la sesión': 'Last set done · save the session',
  'Fijar el día de hoy': "Set today's day",
  'Cancelar este entreno': 'Cancel this workout',
  'Dejar el entreno como estaba': 'Leave the workout as it was',
  'Sesión completada': 'Session completed',
  'No se pudo guardar la sesión.': "Couldn't save the session.",
  ' · descanso opcional': ' · optional rest',
  ' · descanso': ' · rest',
  ' · isométrico': ' · hold',
  'Se añade solo a la sesión de hoy. Tu plan se queda como está.':
    "It is only added to today's session. Your plan stays as it is.",
  'Si pospusiste un entreno o el plan va desfasado, elige el día que te toca hoy y toda la programación se recoloca desde ahí.':
    'If you postponed a workout or the plan has drifted, pick the day you are on today and the whole schedule shifts from there.',
  'Movilidad con gomas y activación': 'Band mobility and activation',
  'Aproximaciones (series progresivas hacia tu peso de trabajo)':
    'Ramp-up sets (progressive sets towards your working weight)',
  'Guardar corrección': 'Save correction',
  'Terminar (sin apuntar)': 'Finish (without logging)',
  '¡Completado!': 'Completed!',
  '4 o más': '4 or more',
  '¡Descanso terminado!': 'Rest over!',
  'A por la siguiente serie.': 'On to the next set.',

  // --- Agenda del coach ---
  'Añade algo para hoy…': 'Add something for today…',
  'Algo para esta semana…': 'Something for this week…',
  'Algo para este mes…': 'Something for this month…',
  'Nuevo objetivo de negocio…': 'New business goal…',
  'Sin tareas': 'No tasks',
  Renovación: 'Renewal',
  'Tarea · toca para mover de día': 'Task · tap to move it to another day',
  'Sin eventos': 'No events',
  'Cobros, ciclos y tus tareas, todo a la vista.':
    'Payments, cycles and your tasks, all in one view.',
  'Cobros, ciclos y tareas de tu grupo, día a día.':
    "Payments, cycles and your group's tasks, day by day.",
  'Tus recordatorios y objetivos como coach.': 'Your reminders and goals as a coach.',
  'Editar objetivo': 'Edit goal',
  'Ej. Llegar a 20 alumnos': 'e.g. Reach 20 students',
  'Ej. Grabar reel de técnica': 'e.g. Film a technique reel',

  // --- Ciclos y semanas ---
  'del bloque': 'of the block',
  'Esta semana se hace la rutina tal cual. Prográmala si quieres subir series, repeticiones o apretar el RIR.':
    'This week the routine is done as it is. Programme it if you want to raise sets, reps or tighten the RIR.',
  'Editar la semana': 'Edit the week',
  'Programar la semana': 'Programme the week',
  '¿Eliminar el plan entero?': 'Delete the whole plan?',
  '¿Eliminar este ciclo?': 'Delete this cycle?',
  'Se borra solo el ciclo. ': 'Only the cycle is deleted. ',
  'Nuevo ciclo': 'New cycle',
  'Copiado de la semana anterior': 'Copied from the previous week',
  'Copiado de la rutina': 'Copied from the routine',
  'Semana de descarga. Baja series o sube el RIR; lo que no toques se queda como en la rutina.':
    'Deload week. Lower the sets or raise the RIR; anything you leave alone stays as in the routine.',
  'Los números de esta semana. Lo que no toques se queda como en la rutina.':
    "This week's numbers. Anything you leave alone stays as in the routine.",
  'Traer de la rutina': 'Bring from the routine',
  ' · semana de descarga': ' · deload week',
  'Desde el inicio': 'Since the start',
  'la plantilla': 'the template',
  'Elige una estructura, ajústala y la app crea el macrociclo con sus bloques y sus semanas.':
    'Pick a structure, adjust it and the app creates the macrocycle with its blocks and weeks.',
  ' · con los números': ' · with the numbers',
  'O empezar de cero': 'Or start from scratch',

  // --- Ficha del alumno, desde el coach ---
  'No se pudo guardar.': "Couldn't save.",
  'No se pudo registrar el pago.': "Couldn't log the payment.",
  'Recordatorio de pago': 'Payment reminder',
  'No se pudo enviar': "Couldn't send it",
  'No se pudo sacar al alumno': "Couldn't remove the student",
  'Sin fecha establecida': 'No date set',
  'añadir días': 'add days',
  'Recordar pago al alumno': 'Remind the student to pay',
  'Pausar el plan unos días': 'Pause the plan for a few days',
  ' · la puso el alumno': ' · set by the student',
  'Lesión, viaje o una semana imposible: no se le pide nada, no pierde la racha y el plan le espera donde lo dejó.':
    'Injury, travel or an impossible week: nothing is asked of them, they keep their streak and the plan waits where they left it.',
  'Sin notas': 'No notes',
  'Sin plan': 'No plan',
  'Sin registros': 'No entries',
  'Sin entrenamientos con peso registrados todavía.': 'No weighted workouts logged yet.',
  'Sin ejercicios isométricos (por segundos) registrados todavía.':
    'No timed (hold) exercises logged yet.',
  Vacío: 'Empty',
  'Confirmar: sacar del grupo': 'Confirm: remove from group',
  'Sacar del grupo': 'Remove from group',
  'Indica un nombre y las calorías diarias objetivo.':
    'Give it a name and the daily calorie target.',
  'No se pudo guardar el plan.': "Couldn't save the plan.",
  'Sin entrenos': 'No workouts',
  Pago: 'Payment',
  'Ver mi código': 'See my code',
  'Sin objetivo definido': 'No goal set',
  'No se pudo crear la libreta': "Couldn't create the book",
  'No se pudo subir la foto.': "Couldn't upload the photo.",
  'Añadir foto': 'Add photo',

  // --- Rutina, desde el coach ---
  'El borrador reemplazará los días actuales. ¿Continuar?':
    'The draft will replace the current days. Continue?',
  'Borrador automático': 'Automatic draft',
  'Reemplazará los días actuales. ¿Continuar?': 'It will replace the current days. Continue?',
  'No se pudo crear el ejercicio': "Couldn't create the exercise",
  'Nueva rutina asignada': 'New routine assigned',
  'No se pudo guardar la rutina.': "Couldn't save the routine.",
  'Este es el día que se entrena. Pon uno o dos ejercicios y, en repeticiones, el objetivo de CADA serie suelta (la mitad de lo que el alumno podría hacer).':
    'This is the day that gets trained. Put one or two exercises in and, in reps, the target for EACH single set (half of what the student could do).',
  'En grease the groove solo se usa el primer día. Este no se le muestra al alumno.':
    'In grease the groove only the first day is used. This one is not shown to the student.',
  'sin poner': 'not set',
  'Ej. 20 segundos con 5 kg': 'e.g. 20 seconds with 5 kg',
  'Ej. 3x10 con 5 kg': 'e.g. 3x10 with 5 kg',
  'Añadir objetivo': 'Add goal',
  'Series en clúster': 'Cluster sets',
  'Superserie con el anterior': 'Superset with the previous one',
  Sesión: 'Session',

  // --- Inicio del coach ---
  'Panel del entrenador': 'Coach dashboard',
  'No se pudo aprobar': "Couldn't approve",
  'Tu entrenador te ha aceptado en su grupo. ¡A entrenar!':
    'Your coach has accepted you into their group. Time to train!',
  'No se pudo rechazar': "Couldn't reject",
  'No se pudo actualizar': "Couldn't update",
  'No se pudo confirmar': "Couldn't confirm",
  '¿quién me debe?': 'who owes me?',
  'acéptalas más abajo': 'accept them below',
  'Invita a tu primer alumno': 'Invite your first student',
  'Comparte tu código desde tu perfil.': 'Share your code from your profile.',
  'Crea tu primer ejercicio': 'Create your first exercise',
  'Tu biblioteca de ejercicios con vídeo.': 'Your exercise library, with video.',
  'Crea un curso': 'Create a course',
  'Comparte tu conocimiento en vídeo.': 'Share what you know on video.',
  'Han entrenado todos': 'Everyone has trained',
  'Dice que ya pagó · confirma': 'Says they already paid · confirm',
  'Este mes': 'This month',
  Histórico: 'All time',
  'Total ingresado hasta la fecha': 'Total collected to date',

  // --- Ejercicios ---
  'El nombre del ejercicio es obligatorio.': 'The exercise name is required.',
  'Ya tienes un ejercicio con ese nombre.': 'You already have an exercise with that name.',
  'el ejercicio': 'the exercise',
  'este ejercicio': 'this exercise',
  'Editar categorías': 'Edit categories',
  'Solo para este ejercicio. Si lo metes en un grupo, la medida la decide el grupo.':
    'For this exercise only. If you put it in a group, the group decides the measure.',
  'Aguante por lado': 'Hold per side',
  'Reps por lado': 'Reps per side',
  'Terminar de editar categorías': 'Finish editing categories',
  'Importar una biblioteca': 'Import a library',
  'Empieza con el pack UDECA o crea el primero con «+ Nuevo».':
    'Start with the UDECA pack or create the first one with "+ New".',
  'Prueba con otra búsqueda o categoría.': 'Try another search or category.',
  'Sí, sustituirlo todo': 'Yes, replace everything',
  "Carga el pack base o crea el primer ejercicio con '+ Nuevo'.":
    'Load the base pack or create the first exercise with "+ New".',
  ' · sin músculos': ' · no muscles',
  Nuevo: 'New',

  // --- Perfil del coach ---
  'No se pudo cargar': "Couldn't load",
  'No se pudo retirar': "Couldn't withdraw it",
  'No se pudo guardar el código.': "Couldn't save the code.",
  'Copiar código': 'Copy code',
  'Compartir código': 'Share code',
  'Cuenta administradora de UDECA: acceso completo sin caducidad.':
    'UDECA admin account: full access with no expiry.',
  'Todavía no hay ningún atleta registrado.': 'No athlete has signed up yet.',
  'Todavía no hay ningún entrenador registrado.': 'No coach has signed up yet.',
  'Cuenta de la casa': 'House account',
  'SIN ACTIVAR': 'NOT ACTIVATED',
  '+1 año': '+1 year',
  'Nueva versión disponible': 'New version available',
  'Abren la app': 'Open the app',
  'Terminan la intro': 'Finish the intro',
  'Ven el registro': 'See the sign-up',
  'Ven el alta': 'See the checkout',

  // --- Eliminar la cuenta ---
  'Ya no entreno': "I don't train any more",
  'Uso otra aplicación': 'I use another app',
  'Me parece cara': 'I find it expensive',
  'Le falta algo que necesito': 'It is missing something I need',
  'Prefiero no decirlo': "I'd rather not say",
  'Borrando tus datos...': 'Deleting your data...',
  'Cerrando tu cuenta...': 'Closing your account...',
  'La contraseña no es correcta.': 'That password is not correct.',
  'Demasiados intentos. Espera unos minutos y vuelve a probar.':
    'Too many attempts. Wait a few minutes and try again.',
  'No se ha podido completar. Inténtalo de nuevo o escríbenos.':
    "Couldn't complete it. Try again or write to us.",
  'Tu perfil, tu foto y tu código de entrenador': 'Your profile, your photo and your coach code',
  'Tu biblioteca de ejercicios, rutinas y plantillas':
    'Your exercise library, routines and templates',
  'Tus cursos, tus notas y tus tareas': 'Your courses, your notes and your tasks',
  'El historial de cobros de tus alumnos': "Your students' payment history",
  'Tu perfil, tu foto y tus objetivos': 'Your profile, your photo and your goals',
  'Todos tus entrenamientos y tus marcas': 'All your workouts and your PRs',
  'Tu peso, tus fotos de progreso y tus tests de nivel':
    'Your weight, your progress photos and your level tests',
  'Tu plan y tu nutrición': 'Your plan and your nutrition',
  'Tu sitio en la clasificación del grupo': "Your place in the group's leaderboard",
  'Eliminar mi cuenta para siempre': 'Delete my account forever',
  'Alumnos desvinculados': 'Students unlinked',
  'Código de entrenador liberado': 'Coach code released',
  'Ficha de la clasificación': 'Leaderboard entry',
  'Comidas y hábitos registrados (sin nombre ni correo)':
    'Logged meals and habits (with no name or email)',
  'Mensajes con tu entrenador, que conserva su copia':
    'Messages with your coach, who keeps their copy',
  'Facturas, si hubo un pago: la ley obliga a guardarlas':
    'Invoices, if there was a payment: the law requires us to keep them',

  // --- Componentes ---
  'Ver por ejercicio': 'See by exercise',
  'Escribe tu peso en kg (por ejemplo, 66,4).': 'Type your weight in kg (for example, 66.4).',
  'Esta semana': 'This week',
  'esta semana': 'this week',
  'este mes': 'this month',
  'No se pudo generar la imagen': "Couldn't generate the image",
  'Ya se está generando otra imagen': 'Another image is already being generated',
  'La imagen tardó demasiado': 'The image took too long',
  'Tienes la cuota pendiente. En cuanto se resuelva, sigues justo donde lo dejaste.':
    'Your fee is outstanding. As soon as it is sorted, you carry on right where you left off.',
  'Si has pagado por otra vía, avisa a tu entrenador y recuperas el acceso mientras lo confirma.':
    'If you paid another way, tell your coach and you get access back while they confirm it.',
  'Agenda descargada. Ábrela con Google Calendar o Apple Calendar.':
    'Schedule downloaded. Open it with Google Calendar or Apple Calendar.',
  'No se pudo generar el fichero': "Couldn't generate the file",
  'Tu calendario ya estaba al día': 'Your calendar was already up to date',
  'Descarga tu agenda y ábrela con Google Calendar o Apple Calendar. Tus cobros, tus bloques y tus tareas, donde ya miras cada mañana.':
    'Download your schedule and open it with Google Calendar or Apple Calendar. Your payments, your blocks and your tasks, where you already look every morning.',
  'Lleva tus cobros, tus bloques y tus tareas al calendario del móvil. Puedes volver a pulsarlo cuando quieras: actualiza lo que hay, no lo duplica.':
    "Take your payments, your blocks and your tasks to your phone's calendar. You can press it again whenever you like: it updates what is there, it does not duplicate it.",
  'Nada con fecha todavía': 'Nothing dated yet',
  'Sumados {0} pasos andados con la app abierta':
    '{0} steps walked with the app open have been added',
  'Android solo cuenta los pasos con la app abierta. Escríbelos a mano si llevas reloj o usas otra app.':
    'Android only counts steps while the app is open. Type them in by hand if you wear a watch or use another app.',
  'Una semana seguida entrenando.': 'A full week of training.',
  '¡Un mes entero de racha!': 'A whole month of streak!',
  'Un año. Trescientos sesenta y cinco días.': 'A year. Three hundred and sixty-five days.',
  'Nuevo récord personal': 'New personal record',
  'Nuevos récords personales': 'New personal records',
  'esta acción...': 'this action...',
  'El navegador no me deja usar el micrófono. Puedes escribirlo abajo.':
    "The browser won't let me use the microphone. You can type it below.",
  'Este navegador no sabe escuchar. Escríbelo abajo y lo apunto igual.':
    "This browser can't listen. Type it below and I'll write it down all the same.",
  'Cuéntame primero qué hiciste.': 'Tell me what you did first.',
  'Sin ejercicios que reconocer': 'No exercises to recognise',
  'No he podido apuntarlo': "I couldn't write it down",
  'No he sacado ninguna serie de ahí. Prueba a decir el ejercicio y las repeticiones.':
    "I didn't get any sets out of that. Try saying the exercise and the reps.",
  'Dale al micro y dime qué hiciste: el ejercicio, las series y las marcas. Lo apunto yo.':
    "Hit the mic and tell me what you did: the exercise, the sets and the numbers. I'll write it down.",
  'Toca el micrófono de tu teclado y dime qué hiciste: el ejercicio, las series y las marcas. Lo apunto yo.':
    "Tap the microphone on your keyboard and tell me what you did: the exercise, the sets and the numbers. I'll write it down.",
  'Dejar de escuchar': 'Stop listening',
  'Te escucho. Toca otra vez cuando acabes.': "I'm listening. Tap again when you're done.",
  'Toca para hablar': 'Tap to speak',
  'Toca aquí y luego el micro de tu teclado': 'Tap here and then the mic on your keyboard',
  '1 serie': '1 set',
  "Objetivos del ciclo": "Cycle goals",
  "Ponte uno o dos: un ejercicio y un número. La app te dirá cuánto te falta.": "Set one or two: an exercise and a number. The app will tell you how far you are.",
  "Ponle uno o dos: un ejercicio y un número. Verá cuánto le falta sin preguntarte.": "Set one or two: an exercise and a number. They will see how far they are without asking you.",
  "Conseguido. Súbete el listón o cámbialo por el siguiente.": "Done. Raise the bar or swap it for the next one.",
  "Conseguido. Súbele el listón o cámbialo por el siguiente.": "Done. Raise their bar or swap it for the next one.",
  "Ejercicio del plan": "Exercise from the plan",
  "Meta": "Target",
  "Conseguido: {0}": "Done: {0}",
  "Sin marcas todavía. Objetivo: {0}": "No marks yet. Target: {0}",
  "{0} de {1} · te faltan {2}": "{0} of {1} · {2} to go",
  "{0} s": "{0} s",
  "{0} kg": "{0} kg",
  "1 repetición": "1 rep",
  "{0} repeticiones": "{0} reps",
  'Objetivo (p. ej. 30 s)': 'Target (e.g. 30 s)',
  'Objetivo (p. ej. 30 s por lado)': 'Target (e.g. 30 s per side)',
  'Enlace del vídeo (YouTube o Vimeo)': 'Video link (YouTube or Vimeo)',
  'Con series, se marcan de una en una a lo largo del día.': 'With sets, they are ticked one at a time through the day.',
  'Mover de sitio': 'Move',
  'Solo alumnos VIP': 'VIP students only',
  'Para todos tus alumnos': 'For all your students',
  'Solo la ven los alumnos que hayas marcado como VIP en su ficha. Para el resto no existe.':
    'Only students you marked as VIP on their profile see it. For everyone else it does not exist.',
  'Toca para reservarla a tus alumnos VIP.': 'Tap to reserve it for your VIP students.',
  'Enlace de Drive, Dropbox o URL .pdf': 'Drive or Dropbox link, or a .pdf URL',
  'Enlace de Vimeo o URL .mp4': 'Vimeo link or .mp4 URL',
  'Quitar miniatura': 'Remove thumbnail',
  'Activa tu cuenta': 'Activate your account',
  'Tu cuenta está sin activar': 'Your account is not activated',
  'Activar mi cuenta en la web': 'Activate my account on the web',
  'Contactar para activar': 'Get in touch to activate',
  'Comprueba tu conexión e inténtalo de nuevo.': 'Check your connection and try again.',
  'desde que empezaste': 'since you started',
  'última vez': 'last time',
  'Necesitas al menos dos sesiones con este ejercicio.':
    'You need at least two sessions with this exercise.',
  'Introduce el código de tu entrenador.': "Enter your coach's code.",
  'Ese código no es válido. Revísalo con tu entrenador.':
    'That code is not valid. Check it with your coach.',
  'No se pudo enviar la solicitud.': "Couldn't send the request.",
  'Guardar mis macros': 'Save my macros',
  'Revisa tus datos: edad (10+), altura en cm (100+) y peso en kg (30+).':
    'Check your details: age (10+), height in cm (100+) and weight in kg (30+).',
  'Ganar músculo': 'Build muscle',
  'Más resistencia': 'More endurance',
  Definición: 'Cutting',
  'Aquí diriges tú: crea tu plan, registra tu progreso y controla tu nutrición, todo en un mismo sitio.':
    "You're in charge here: create your plan, log your progress and manage your nutrition, all in one place.",
  'Este es tu campo base. Vamos a verlo en 20 segundos.':
    "This is your base camp. Let's look around in 20 seconds.",
  'Diseña tu propio plan': 'Design your own plan',
  'En Mi plan eliges el método: por días de la semana, días sueltos en ciclo o a sensaciones.':
    'In My plan you choose the method: by weekday, standalone days in a cycle, or by feel.',
  'Añade tus ejercicios con series, reps, descansos y superseries. Tú mandas.':
    "Add your exercises with sets, reps, rests and supersets. You're in charge.",
  'Entrena con el modo enfocado': 'Train in focused mode',
  'En Entreno, dale al día que toca: un ejercicio por pantalla, marca cada serie con ✓ y el crono de descanso arranca solo.':
    'In Training, hit the day you are on: one exercise per screen, tick each set with ✓ and the rest timer starts by itself.',
  'Apunta reps o segundos según el ejercicio y deja notas para ti.':
    'Log reps or seconds depending on the exercise, and leave notes for yourself.',
  'Mide tu progreso': 'Measure your progress',
  'Peso, fotos y tus entrenos quedan guardados en Progreso, mes a mes.':
    'Weight, photos and your workouts are saved in Progress, month by month.',
  'Tus récords y tu racha se actualizan solos para que veas tu evolución.':
    'Your PRs and your streak update by themselves so you can see how you evolve.',
  'Tu entrenador te acompaña desde aquí: rutina, progreso y comunicación en un solo sitio.':
    'Your coach is with you from here: routine, progress and communication in one place.',
  'Apunta reps o segundos según el ejercicio; si algo cambia, deja una nota al coach.':
    'Log reps or seconds depending on the exercise; if something changes, leave a note for your coach.',
  'Registra tu progreso': 'Log your progress',
  'Tu coach ve cómo va tu semana y ajusta tu plan sin que tengas que pedírselo.':
    'Your coach sees how your week is going and adjusts your plan without you having to ask.',
  'Instálala como app': 'Install it as an app',
  'En Safari: toca el botón Compartir (cuadrado con flecha, abajo).':
    'In Safari: tap the Share button (the square with an arrow, at the bottom).',
  'Elige “Añadir a pantalla de inicio” y confirma. UDECA quedará como una app más.':
    'Choose "Add to Home Screen" and confirm. UDECA will sit there like any other app.',
  'En Chrome: toca el menú ⋮ (arriba a la derecha).':
    'In Chrome: tap the ⋮ menu (top right).',
  'Elige “Instalar aplicación” o “Añadir a pantalla de inicio”. UDECA quedará como una app más.':
    'Choose "Install app" or "Add to Home screen". UDECA will sit there like any other app.',
  'Guardar y empezar': 'Save and start',
  'Defínelo para tenerlo siempre presente y medir tu avance. Podrás cambiarlo cuando quieras desde tu perfil.':
    'Set it so you always have it in mind and can measure your progress. You can change it whenever you like from your profile.',
  'Defínelo para que tu entrenador lo tenga presente. Podrás cambiarlo cuando quieras desde tu perfil.':
    'Set it so your coach has it in mind. You can change it whenever you like from your profile.',
  'Definir mi objetivo': 'Set my goal',
  'Indica un nombre y las calorías de la comida.': 'Give it a name and the calories of the meal.',
  'Foto de progreso': 'Progress photo',
  'kcal de más': 'kcal over',
  'Unos días sin entrenar que no rompen nada. Al terminar, el plan sigue donde se quedó.':
    'A few days off that break nothing. When it ends, the plan carries on where it stopped.',
  'Ej. Lesión de hombro': 'e.g. Shoulder injury',
  'Ej. Viaje de trabajo': 'e.g. Work trip',
  'Alumnos ilimitados con tu código de coach': 'Unlimited students with your coach code',
  'Rutinas, plantillas y programaciones a medida':
    'Routines, templates and programming made to measure',
  'Gestión de cobros y pagos de tus alumnos': "Managing your students' fees and payments",
  'Progreso, estadísticas y informes PDF': 'Progress, statistics and PDF reports',
  'Tus cursos y vídeos de técnica propios': 'Your own courses and technique videos',
  'Tus rutinas, a tu medida y sin límite': 'Your routines, made to measure and without limits',
  'Cada serie, cada récord y cada progresión, registrados':
    'Every set, every PR and every progression, logged',
  'Tu evolución por ejercicio, con números que no mienten':
    'Your progress exercise by exercise, with numbers that do not lie',
  'Nutrición y macros alineados con tu objetivo':
    'Nutrition and macros lined up with your goal',
  'Racha y logros para no soltar la barra': 'Streak and achievements so you never let go of the bar',
  'Aún no consta el pago': 'The payment is not showing yet',
  'Tu cuenta no está activa': 'Your account is not active',
  'Has terminado la prueba': 'Your trial is over',
  'Tus datos, tus rutinas y todo tu progreso siguen intactos. En cuanto tu cuenta vuelva a estar activa, la app lo reconoce sola.':
    'Your data, your routines and all your progress are untouched. As soon as your account is active again, the app picks it up by itself.',
  'Este mes ya has hecho la parte difícil: empezar. Todo tu progreso sigue aquí, intacto, esperándote. Este es el siguiente nivel.':
    "This past month you've already done the hard part: starting. All your progress is still here, untouched, waiting for you. This is the next level.",
  'Esta cuenta no incluye alumnos: el alta de su tarjeta ya se usó en otra cuenta de entrenador. Con la suscripción anual tienes alumnos ilimitados. Tus datos están a salvo y te esperan.':
    'This account includes no students: that card was already used to sign up another coach account. With the annual subscription you get unlimited students. Your data is safe and waiting for you.',
  'Se abre la web para activarla. Al volver, tu cuenta se enciende sola en unos segundos; si tardara, pulsa "Ya he pagado · Actualizar".':
    'The web opens to activate it. When you come back, your account switches on by itself in a few seconds; if it takes longer, press "I\'ve already paid · Refresh".',
  'Continuar en la web': 'Continue on the web',
  'Ya he pagado · Actualizar': "I've already paid · Refresh",
  'Ya está activa · Actualizar': "It's active · Refresh",
  'Registra al menos dos pesajes para ver tu gráfica de evolución.':
    'Log at least two weigh-ins to see your progress chart.',
  'Último día de prueba': 'Last day of the trial',
  'Actívala y sigue con todo tu progreso y tus alumnos.':
    'Activate it and carry on with all your progress and your students.',
  'Tu progreso se queda contigo pase lo que pase.':
    'Your progress stays with you whatever happens.',
  'Sin permanencia. Se cancela cuando quieras.': 'No lock-in. Cancel whenever you like.',
  'Tus rutinas y tu progreso, sin límite de tiempo':
    'Your routines and your progress, with no time limit',
  'Nutrición, macros y libreta de comidas': 'Nutrition, macros and meal book',
  'Informes en PDF y récords guardados para siempre':
    'PDF reports and PRs saved forever',
  'Cobros, avisos de impago y control de cuotas':
    'Payments, overdue notices and fee tracking',
  'Informes de progreso con tu marca': 'Progress reports with your branding',
  'Esta cuenta no incluye alumnos': 'This account includes no students',
  'El alta de tu tarjeta ya se usó en otra cuenta de entrenador, así que esta entra sin plazas. Con el plan tienes alumnos ilimitados.':
    'Your card was already used to sign up another coach account, so this one comes with no places. With the plan you get unlimited students.',
  'Cuando quieras, sin esperar': 'Whenever you like, no waiting',
  'Pasa al plan completo cuando quieras.': 'Move to the full plan whenever you like.',
  'Tu alta no incluye alumnos': 'Your sign-up includes no students',
  'El alta de tu tarjeta ya se usó en otra cuenta de entrenador.':
    'Your card was already used to sign up another coach account.',
  'Activar el plan anual': 'Activate the annual plan',

  // Las dos formas de pagar del atleta (components/ElegirPlan.tsx). Sin
  // importes: la app no dice precios en ningún idioma.
  'Un año por delante': 'A full year ahead',
  'Lo pagas una vez y te olvidas del contador hasta el año que viene.':
    'Pay once and forget the countdown until next year.',
  'Mes a mes': 'Month to month',
  'Sin permanencia. Lo dejas el mes que quieras, sin dar explicaciones.':
    'No commitment. Stop any month you want, no explanations.',
  'Ahorras un {0}%': 'Save {0}%',
  'Se abre la web para completarlo. Al volver, tu cuenta se enciende sola.':
    'The web opens to finish it. When you come back, your account switches on by itself.',
  'Elijas como elijas, la app es la misma y entera.':
    'Whichever you pick, you get the same app, all of it.',
  'Si prefieres esperar, no pasa nada: te avisaremos antes de que termine la prueba.':
    'If you would rather wait, that is fine: we will let you know before the trial ends.',
  'Se cobra una vez al año. Mientras no lo actives no se te cobra nada, y tus alumnos actuales siguen igual.':
    'Charged once a year. Until you activate it you are charged nothing, and your current students carry on as they are.',
  'Tu plan de atleta': 'Your athlete plan',
  'Tu plan de entrenador': 'Your coach plan',
  'Así funciona tu prueba': 'How your trial works',
  'Te queda un día de prueba': 'You have one day of trial left',
  'Así funciona tu grupo': 'How your group works',
  'No se pudo reenviar': "Couldn't resend it",

  // --- Textos que arma lib/ ---
  'Apple no ha devuelto la identidad de la cuenta.':
    'Apple did not return the account identity.',
  'Google no ha devuelto la identidad de la cuenta.':
    'Google did not return the account identity.',
  'Sin sesión': 'No session',
  'No se pudo apuntar el dictado': "Couldn't write down what you said",
  'Sin conexión con el servidor': 'No connection to the server',
  'No hay ninguna sesión abierta.': 'There is no session open.',
  'Sin nombre': 'No name',
  'El código de entrenador no es válido. Revísalo con tu entrenador.':
    'That coach code is not valid. Check it with your coach.',
  'Tu entrenador ha alcanzado el límite de alumnos de su plan. Pídele que active su suscripción para poder entrar.':
    'Your coach has reached the student limit on their plan. Ask them to activate their subscription so you can get in.',
  'No hay sesión activa': 'No active session',
  'Elige hasta qué día queda pagado.': 'Choose the day it is paid up to.',
  'Esa fecha ya ha pasado: elige una futura.': 'That date has passed: choose a future one.',
  'Escribe cuánto ha pagado.': 'Type how much they paid.',
  'Es la mejor progresión del bloque.': 'It is the best progression of the block.',
  tirón: 'pull',
  empuje: 'push',
  'La descarga no descargó': 'The deload did not deload',
  'Esa semana se cayó; el resto del bloque va aparte.':
    'That week fell through; the rest of the block is separate.',
  'Entrena más duro de lo que le pides': 'They train harder than you ask them to',
  'Sesión UDECA': 'UDECA session',
  'Récord UDECA': 'UDECA PR',
  'Mi carné UDECA': 'My UDECA card',
  ALUMNO: 'STUDENT',
  FORMACIÓN: 'COURSE',
  ATLETA: 'ATHLETE',
  ENTRENADOR: 'COACH',
  'SESIÓN COMPLETADA': 'SESSION COMPLETED',
  'NUEVO RÉCORD PERSONAL': 'NEW PERSONAL RECORD',
  'RÉCORDS PERSONALES': 'PERSONAL RECORDS',
  'Racha de {0} días': '{0}-day streak',
  Horas: 'Hours',
  'MEJORES MARCAS': 'BEST NUMBERS',
  'INFORME DE PROGRESO': 'PROGRESS REPORT',
  'Isométrico empuje': 'Push hold',
  'Isométrico tirón': 'Pull hold',
  'Aún sin marcas registradas': 'No PRs logged yet',
  'Miembro fundador · el número no se reasigna':
    'Founding member · the number is never reassigned',
  'Alumno a tu cargo': 'Student in your care',
  'Alumnos a tu cargo': 'Students in your care',
  'Días seguidos': 'Days in a row',
  'Tu primer entreno': 'Your first workout',
  'Forma a otros dentro de UDECA': 'Trains others inside UDECA',
  'Se entrena a sí mismo': 'Trains themselves',
  'Entrena con su entrenador': 'Trains with their coach',
  'Estudia en la Universidad de Calistenia': 'Studies at the University of Calisthenics',
  'Tu comunidad': 'Your community',
  Borrar: 'Delete',
  'Aún no has entrenado en este bloque.': "You haven't trained in this block yet.",
  'Aún no has entrenado estas semanas.': "You haven't trained these weeks.",
  '3 bloques de 4 semanas, con descarga al final de cada uno':
    '3 blocks of 4 weeks, with a deload at the end of each',
  Acumulación: 'Accumulation',
  'Volumen y técnica': 'Volume and technique',
  Intensificación: 'Intensification',
  'Más carga, menos series': 'More load, fewer sets',
  Realización: 'Realisation',
  'Máximos y skills': 'Maxes and skills',
  '2 bloques de 4 semanas': '2 blocks of 4 weeks',
  'Cerca del fallo': 'Close to failure',
  '4 bloques de 4 semanas para una progresión larga':
    '4 blocks of 4 weeks for a long progression',
  Preparación: 'Preparation',
  'Progresión I': 'Progression I',
  'Progresión II': 'Progression II',
  Consolidación: 'Consolidation',
  'Sin bloque': 'No block',
  'no he pillado nada': "I didn't catch anything",
  'Pega aquí el enlace con el que paga ESTE alumno. Cada uno puede tener el suyo, con su precio.':
    'Paste here the link THIS student pays with. Each one can have their own, with their own price.',
  'Eso no parece una dirección. Tiene que empezar por https://':
    'That does not look like an address. It has to start with https://',
  'Enlace de Stripe: al pagar, el cobro se confirma solo.':
    'Stripe link: when they pay, the payment confirms itself.',
  'Enlace guardado. Al pagar por fuera de Stripe, tendrás que confirmar el cobro a mano.':
    'Link saved. When they pay outside Stripe, you will have to confirm the payment by hand.',
  'esta cuenta ya existe, pero con otro método':
    'this account already exists, but with another method',
  'Escribe tu contraseña de siempre.': 'Type your usual password.',
  'Esa contraseña no es. Si no te acuerdas, pide restablecerla desde abajo.':
    "That's not the password. If you can't remember it, ask to reset it below.",
  'No hay ninguna cuenta con ese correo.': 'There is no account with that email.',
  'Demasiados intentos seguidos. Espera un momento y vuelve a probar.':
    'Too many attempts in a row. Wait a moment and try again.',
  'Sin conexión. Inténtalo de nuevo.': 'No connection. Try again.',
  'Ese correo ya está en otra cuenta.': 'That email is already on another account.',
  'La contraseña necesita al menos 6 caracteres.':
    'The password needs at least 6 characters.',
  'Ese correo no parece válido.': 'That email does not look valid.',
  'Tu navegador ha bloqueado la ventana de acceso. Permítela y vuelve a probar.':
    'Your browser blocked the sign-in window. Allow it and try again.',
  'Este sitio no está autorizado para entrar. Avisa a UDECA.':
    'This site is not authorised for sign-in. Let UDECA know.',
  'Esa forma de entrar no está disponible ahora mismo. Prueba con la otra.':
    'That sign-in method is not available right now. Try the other one.',
  'No se ha podido entrar. Inténtalo otra vez en un momento.':
    "Couldn't sign in. Try again in a moment.",
  'Error no identificado': 'Unidentified error',
  'Ya existe una cuenta con ese correo electrónico.':
    'An account with that email already exists.',
  'El correo electrónico no es válido.': 'That email is not valid.',
  'La contraseña debe tener al menos 6 caracteres.':
    'The password must be at least 6 characters.',
  'Correo electrónico o contraseña incorrectos.': 'Wrong email or password.',
  'Demasiados intentos. Inténtalo de nuevo en unos minutos.':
    'Too many attempts. Try again in a few minutes.',
  'Error de conexión. Comprueba tu internet e inténtalo de nuevo.':
    'Connection error. Check your internet and try again.',
  'Ha ocurrido un error inesperado. Inténtalo de nuevo.':
    'An unexpected error occurred. Try again.',
  'El código debe tener entre 3 y 16 letras o números.':
    'The code must be between 3 and 16 letters or numbers.',
  'Ese código ya está en uso. Prueba con otro.':
    'That code is already in use. Try another one.',
  'Objetivo del día hecho. Descansa y mañana otra vez.':
    "Today's target is done. Rest, and again tomorrow.",
  'Queda una. Que salga tan fácil como la primera.':
    'One to go. Make it as easy as the first.',
  'Necesitamos permiso para acceder a tus fotos.':
    'We need permission to access your photos.',
  Máximo: 'Maximum',
  'Clase protegida: sin descargas, sin menú y con tu nombre marcado encima. No la compartas ni la grabes.':
    'Protected lesson: no downloads, no menu, and your name watermarked on top. Do not share or record it.',
  'Clase protegida: no se puede grabar la pantalla ni hacer capturas, y lleva tu nombre marcado encima.':
    'Protected lesson: screen recording and screenshots are blocked, and your name is watermarked on top.',
  'Esta clase va marcada con tu nombre: cualquier copia lleva tu cuenta encima. Compartirla es motivo de baja.':
    'This lesson is watermarked with your name: any copy carries your account on it. Sharing it is grounds for removal.',
  'Sin marcas nuevas': 'No new PRs',
  Bíceps: 'Biceps',
  Tríceps: 'Triceps',
  Glúteos: 'Glutes',
  Cuádriceps: 'Quads',
  'Sedentario · poco o ningún ejercicio': 'Sedentary · little or no exercise',
  'Ligero · 1-3 días/semana': 'Light · 1-3 days/week',
  'Moderado · 3-5 días/semana': 'Moderate · 3-5 days/week',
  'Activo · 6-7 días/semana': 'Active · 6-7 days/week',
  'Muy activo · dobles sesiones o trabajo físico':
    'Very active · double sessions or physical work',
  'Te falta subir el entreno': 'You still need to upload the workout',
  'Un minuto ahora y tu progreso queda completo.':
    'One minute now and your progress is complete.',
  '¿Lo dejamos hecho?': 'Shall we get it done?',
  'Aún estás a tiempo': 'There is still time',
  'Objetivo del día cumplido. Todo lo que venga es de más.':
    "Today's target hit. Anything else is a bonus.",
  'No se pudo preparar el informe': "Couldn't prepare the report",
  'Se mantiene': 'Holding steady',
  'Pago pendiente': 'Payment due',
  Cortesía: 'Complimentary',
  Élite: 'Elite',
  'Segundos (isométrico)': 'Seconds (hold)',
  'Reps por lado (izq. y der.)': 'Reps per side (left and right)',
  'Aguante por lado (izq. y der.)': 'Hold per side (left and right)',
  'Error de red': 'Network error',
  'Sin perfil': 'No profile',
  'Tus ejercicios, tus rutinas y tus notas se quedan como las escribiste.':
    'Your exercises, your routines and your notes stay exactly as you wrote them.',
  'Bienvenido a UDECA': 'Welcome to UDECA',
  'Bienvenido a UDECA, {0}': 'Welcome to UDECA, {0}',
  'Empieza {0}': '{0} starts',
  'Termina {0}': '{0} ends',
  'Semana {0} · descarga': 'Week {0} · deload',
  'Miembro fundador': 'Founding member',
  'En UDECA': 'In UDECA',
  mes: 'month',
  meses: 'months',
  Entrenamiento: 'Workout',
  Entrenamientos: 'Workouts',
  'Empieza hoy': 'Start today',
  'Entrenos dirigidos': 'Sessions coached',
  'La IA no está disponible ahora mismo. Escríbelo y lo apunto igual.':
    "The AI isn't available right now. Type it out and I'll log it all the same.",
};

/**
 * Traduce, o devuelve el español tal cual si esa frase aún no está.
 *
 * Con `partes` se sustituyen los huecos `{algo}` DESPUÉS de traducir, para que
 * un nombre o una cifra no dependan del idioma.
 */
export function traducir(
  texto: string,
  idioma: Idioma,
  partes?: Record<string, string | number>
): string {
  const base = idioma === 'en' ? (EN[texto] ?? texto) : texto;
  if (!partes) return base;
  return base.replace(/\{(\w+)\}/g, (todo, clave) =>
    partes[clave] === undefined ? todo : String(partes[clave])
  );
}

/**
 * El idioma que le toca a alguien: el que haya elegido y, si no ha elegido, el
 * de su teléfono.
 *
 * Cualquier idioma que no sea inglés cae en español, que es la lengua de la
 * app: un francés entiende antes el español de una app de calistenia española
 * que un inglés a medias.
 */
export function idiomaDe(elegido: string | undefined, delSistema: string | undefined): Idioma {
  if (elegido === 'en' || elegido === 'es') return elegido;
  return (delSistema ?? '').toLowerCase().startsWith('en') ? 'en' : 'es';
}

/**
 * Si lo escrito es la palabra que pide un diálogo de confirmación.
 *
 * Los borrados serios piden escribir una palabra a mano ("CONFIRMAR",
 * "ELIMINAR MI CUENTA"). Esa palabra se enseña traducida, así que comparar solo
 * contra el español dejaría a un inglés escribiendo exactamente lo que se le
 * pide y viendo el botón apagado, sin ninguna pista de por qué. Se aceptan las
 * dos, que además resuelve el caso de cambiar de idioma con el diálogo abierto.
 */
export function esLaPalabra(escrito: string, palabra: string): boolean {
  const limpio = escrito.trim().toUpperCase();
  return limpio === palabra.toUpperCase() || limpio === (EN[palabra] ?? palabra).toUpperCase();
}

/** Cuánto del producto está ya en inglés, para saber por dónde va esto. */
export function cuantasTraducidas(): number {
  return Object.keys(EN).length;
}
