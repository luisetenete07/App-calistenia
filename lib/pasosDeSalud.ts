/**
 * Los pasos del móvil en Android, con la app cerrada incluida.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * En iPhone la app pregunta al teléfono por el día entero y se acabó. En
 * Android no había forma: `expo-sensors` contesta literalmente
 *
 *   "Getting step count for date range is not supported on Android yet"
 *
 * y lo único que queda es escuchar el sensor mientras la app está delante. O
 * sea, que quien abría UDECA a las ocho de la tarde había andado, para la app,
 * los pasos de esos cuatro segundos.
 *
 * QUÉ ES HEALTH CONNECT
 *
 * El almacén de salud oficial de Android. Ahí guarda el propio teléfono sus
 * pasos —los cuenta el sistema, con la app cerrada y con el móvil en el
 * bolsillo— y ahí guardan los suyos el reloj, Samsung Health, Google Fit y
 * cualquier otra app. Nosotros solo LEEMOS, y leemos una cosa: los pasos.
 *
 * Esa es también la razón de fondo para elegirlo: la cifra que enseñamos
 * coincide con la que el alumno ya ve en su móvil. Una app de entrenamiento que
 * dice 6.000 cuando el teléfono dice 9.200 no tiene un problema de precisión,
 * tiene un problema de credibilidad.
 *
 * AQUÍ NO SE IMPORTA NADA NATIVO
 *
 * Este fichero es la parte que se puede probar en Node pelado: qué hacer con
 * el estado del SDK, con los permisos y con lo que devuelve la consulta. Las
 * llamadas de verdad viven en components/ContadorDePasos.tsx, que es quien
 * puede cargar el módulo nativo.
 */

/**
 * Estados del SDK, tal y como los numera Health Connect.
 *
 * No es un enum nuestro: son sus constantes, y se repiten aquí para poder
 * razonar sobre ellas sin cargar el módulo nativo.
 */
export const SALUD_NO_DISPONIBLE = 1;
export const SALUD_HAY_QUE_ACTUALIZARLA = 2;
export const SALUD_DISPONIBLE = 3;

/** Lo único que se pide: leer los pasos. Ni escribir, ni nada más. */
export const PERMISO_DE_PASOS = { accessType: 'read', recordType: 'Steps' } as const;

/** ¿Se puede usar Health Connect en este móvil? */
export function saludUtilizable(estado: unknown): boolean {
  return estado === SALUD_DISPONIBLE;
}

/**
 * Qué decirle a alguien cuyo móvil no puede usarlo.
 *
 * Un "no se han podido leer los pasos" a secas deja a la persona sin saber si
 * el fallo es suyo, del móvil o nuestro. Cada estado tiene una salida distinta
 * y hay que decir cuál es.
 */
export function porQueNoHaySalud(estado: unknown): string {
  if (estado === SALUD_HAY_QUE_ACTUALIZARLA) {
    return 'Actualiza Health Connect desde Google Play para leer tus pasos.';
  }
  return 'Este móvil no tiene Health Connect. Puedes escribir tus pasos a mano.';
}

/** ¿Nos han dejado leer los pasos? */
export function hayPermisoDePasos(concedidos: unknown): boolean {
  if (!Array.isArray(concedidos)) return false;
  return concedidos.some(
    (p) =>
      p &&
      typeof p === 'object' &&
      (p as { recordType?: unknown }).recordType === 'Steps' &&
      (p as { accessType?: unknown }).accessType === 'read'
  );
}

/**
 * El rango del día de hoy, en el formato que pide Health Connect.
 *
 * Las horas van en ISO y en UTC, que es como las quiere; los límites del día
 * son los LOCALES, porque el día de alguien empieza a su medianoche y no a la
 * de Greenwich.
 */
export function rangoDelDia(desde: number, hasta: number) {
  return {
    operator: 'between' as const,
    startTime: new Date(desde).toISOString(),
    endTime: new Date(hasta).toISOString(),
  };
}

/**
 * Los pasos que trae la respuesta.
 *
 * Devuelve `null`, y no cero, cuando no hay dato. La diferencia importa: cero
 * es "hoy no has andado" y se puede guardar; nada es "no me lo han dicho", y
 * guardarlo pondría el día a cero por un fallo de lectura.
 */
export function pasosDelResultado(res: unknown): number | null {
  const total = (res as { COUNT_TOTAL?: unknown })?.COUNT_TOTAL;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return null;
  return Math.round(total);
}
