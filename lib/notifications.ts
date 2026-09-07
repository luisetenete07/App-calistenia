import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { t } from './idioma';
import { getUserProfile } from './firestore/users';
import { DIAS_VISTA, diasPendientes, horasDeAviso, textoDeAviso, TOPE_AVISOS } from './olvido';
import type { ContextoDelCiclo } from './schedule';
import type { Routine } from './types';

/**
 * Esto se ejecuta AL CARGAR EL MÓDULO, o sea antes de que se pinte nada.
 *
 * Va envuelto por el mismo motivo que la inicialización de Firebase: lo que
 * lanza al cargar un módulo no lo recoge nadie, y en el móvil eso no es un
 * error en pantalla, es una app que se cierra sola al abrirla. Aquí se llama a
 * un módulo nativo, y la forma de este objeto ha cambiado entre versiones del
 * SDK (`shouldShowAlert` pasó a `shouldShowBanner`/`shouldShowList`).
 *
 * Si fallara, lo que se pierde es cómo se ven los avisos con la app abierta.
 * La app entra igual.
 */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  /* los avisos se verán como los ponga el sistema; entrar es más importante */
}

/**
 * Pide permiso y registra el dispositivo para notificaciones push, guardando
 * el token en el perfil del usuario. No hace nada en web (no soportado) ni
 * en simuladores. Requiere haber configurado un proyecto EAS
 * (`extra.eas.projectId` en app.json, generado con `npx eas init`) para
 * poder generar el token — si falta, falla en silencio.
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    await updateDoc(doc(db, 'users', uid), { pushToken });
  } catch {
    // Sin projectId de EAS configurado, o dispositivo sin Play/App Store
    // services: nos degradamos a solo notificaciones locales.
  }
}

/** Envía una notificación push a través de la API de Expo (sin backend propio). */
export async function sendPushNotification(
  pushToken: string | undefined | null,
  title: string,
  body: string
): Promise<void> {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body }),
    });
  } catch {
    // Si falla el envío (sin conexión, token inválido...) lo ignoramos:
    // la notificación es un extra, nunca debe romper la acción principal.
  }
}

/** Busca el push token de un usuario por su uid y le envía una notificación. */
export async function notifyUser(uid: string, title: string, body: string): Promise<void> {
  const profile = await getUserProfile(uid);
  await sendPushNotification(profile?.pushToken, title, body);
}


const REST_END_ID = 'rest-timer-end';

/**
 * Programa una notificación local que suena cuando termina el descanso entre
 * series. Así la cuenta atrás "sigue viva" aunque el móvil se bloquee o la app
 * pase a segundo plano: el sistema avisa igualmente al llegar a cero. Si aún no
 * hay permiso de notificaciones, lo pide una vez. En web no está soportado.
 */
export async function scheduleRestEndNotification(seconds: number): Promise<void> {
  if (Platform.OS === 'web' || seconds <= 0) return;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted && existing.status !== 'denied') {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;
    await Notifications.cancelScheduledNotificationAsync(REST_END_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: REST_END_ID,
      content: {
        title: t('¡Descanso terminado!'),
        body: t('A por la siguiente serie.'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        repeats: false,
      },
    });
  } catch {
    // No crítico: la cuenta atrás en pantalla sigue funcionando igualmente.
  }
}

export async function cancelRestEndNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_END_ID);
  } catch {
    // Si no existía, no pasa nada.
  }
}

const WORKOUT_REMINDER_ID = 'daily-workout-reminder';

/**
 * Apaga el aviso diario a hora fija.
 *
 * Programarlo ya no se puede: avisaba todos los días a la misma hora
 * entrenara uno o no, y quien había entrenado a las siete recibía a las siete
 * y media un recordatorio para hacer lo que acababa de hacer. Lo que queda es
 * cancelarlo, para los móviles que aún lo tengan puesto de antes: sin esto
 * seguiría sonando cada día sin ningún interruptor en la app que lo callara.
 */
export async function cancelWorkoutReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(WORKOUT_REMINDER_ID);
  } catch {
    // Si no existía, no pasa nada.
  }
}

const OLVIDO_PREFIJO = 'entreno-olvidado-';

/**
 * Programa los avisos de "se te ha olvidado subir el entreno".
 *
 * Se borran los anteriores y se vuelven a poner enteros: es idempotente, así
 * que se puede llamar cada vez que el alumno abre la app sin acumular nada.
 *
 * Devuelve cuántos quedaron puestos (0 en web, sin permiso o sin días que
 * avisar), que es lo que permite comprobarlo desde fuera.
 */
export async function programarAvisosOlvido(
  routine: Routine | null,
  yaEntrenoHoy: boolean,
  desdeHora: number,
  ciclo?: ContextoDelCiclo,
  ahora = Date.now()
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return 0;

    await cancelarAvisosOlvido();

    // El ancla y las pausas van hasta el final: sin ellas los avisos hablarían
    // de un día de ciclo que no es el que el alumno se va a encontrar.
    const pendientes = diasPendientes(
      routine,
      yaEntrenoHoy,
      ahora,
      DIAS_VISTA,
      ciclo
    );
    let puestos = 0;
    for (const { dia, nombre } of pendientes) {
      // El primer aviso del día va a la hora que el alumno eligió para su
      // recordatorio; antes de eso todavía no se le ha olvidado nada.
      for (const cuando of horasDeAviso(dia, desdeHora, ahora)) {
        if (puestos >= TOPE_AVISOS) return puestos;
        const { titulo, cuerpo } = textoDeAviso(puestos, nombre);
        await Notifications.scheduleNotificationAsync({
          identifier: `${OLVIDO_PREFIJO}${cuando}`,
          content: { title: t(titulo), body: t(cuerpo) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(cuando),
          },
        });
        puestos++;
      }
    }
    return puestos;
  } catch {
    return 0;
  }
}

/**
 * Quita todos los avisos de olvido pendientes.
 *
 * Se llama al registrar un entreno: el aviso de las 20:00 no puede saltar si a
 * las 19:40 ya se ha subido la sesión. Se recorren los programados y se borran
 * los que llevan nuestro prefijo, para no tocar los demás recordatorios.
 */
export async function cancelarAvisosOlvido(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const puestos = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      puestos
        .filter((n) => n.identifier.startsWith(OLVIDO_PREFIJO))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {
    // Si no había ninguno, no pasa nada.
  }
}
