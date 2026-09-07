import { inicioDelDia } from './fechas';
import { frase } from './idioma';
import { cubre, type PausaPlan } from './pausa';
import { resolveSessionFor, type ContextoDelCiclo } from './schedule';
import type { Routine } from './types';

/**
 * "Se te ha olvidado subir el entreno": el aviso que se repite cada hora.
 *
 * La regla es sencilla de decir y tiene tres partes que conviene no mezclar:
 * QUÉ DÍAS avisar (los que toca entrenar y no se ha registrado nada), DESDE QUÉ
 * HORA (no antes de que se le haya podido olvidar) y HASTA CUÁNDO (no a las
 * tres de la mañana). Aquí están las tres, sin tocar el móvil, para poder
 * comprobarlas moviendo el reloj.
 *
 * POR QUÉ EMPIEZA A LA HORA DEL RECORDATORIO Y NO ANTES
 *
 * El alumno ya elige a qué hora quiere su aviso diario de "hora de entrenar"
 * (18:00 por defecto). Antes de esa hora no se le ha olvidado nada: todavía no
 * le tocaba. Empezar ahí es lo que separa un recordatorio útil de una app
 * pesada, y de paso hace que el número de avisos dependa de una decisión que ya
 * había tomado él: si entrena a las 18:00 recibe cuatro, y si madruga a las
 * 7:00 recibe los que ha pedido.
 *
 * POR QUÉ SE PROGRAMAN CON DÍAS DE ANTELACIÓN
 *
 * Un aviso local solo se puede programar con la app abierta, y el día que hace
 * falta avisar es justo aquel en que el alumno NO la abre. Así que cada vez que
 * entra se programan también los próximos días de entreno. Al registrar la
 * sesión se cancelan los de ese día.
 */

/** Última hora a la que se avisa. Más tarde es despertar a alguien. */
export const ULTIMA_HORA = 22;

/**
 * Tope de avisos que se dejan programados a la vez.
 *
 * iOS no admite más de 64 notificaciones locales pendientes y descarta las que
 * sobran sin decir nada. Con este tope caben estas y las demás (el descanso,
 * el recordatorio diario) sin pisarse.
 */
export const TOPE_AVISOS = 24;

/** Cuántos días hacia delante se miran al programar. */
export const DIAS_VISTA = 4;

/**
 * Las horas en punto a las que avisar ESE día.
 *
 * Solo las que aún no han pasado: reprogramar a media tarde no debe resucitar
 * las de la mañana.
 */
export function horasDeAviso(
  dia: number,
  desdeHora: number,
  ahora: number,
  ultimaHora = ULTIMA_HORA
): number[] {
  const salida: number[] = [];
  const base = inicioDelDia(dia);
  const primera = Math.max(0, Math.min(23, Math.floor(desdeHora)));
  for (let h = primera; h <= ultimaHora; h++) {
    const cuando = new Date(base);
    cuando.setHours(h, 0, 0, 0);
    if (cuando.getTime() > ahora) salida.push(cuando.getTime());
  }
  return salida;
}

/** Un día de entreno pendiente de avisar. */
export interface DiaPendiente {
  /** Las 00:00 de ese día. */
  dia: number;
  /** Nombre del día de rutina ("Empuje"), para decirlo en el aviso. */
  nombre: string;
}

/**
 * Los próximos días en los que toca entrenar, mirando `dias` hacia delante.
 *
 * Se salta HOY si ya hay un entreno registrado hoy: no se le recuerda a nadie
 * algo que acaba de hacer. Los días futuros van siempre, porque nadie ha
 * entrenado todavía un día que no ha llegado.
 *
 * Los días de pausa se saltan enteros. Es la mitad de la promesa de una pausa:
 * si el alumno está lesionado o de viaje y aun así le llega un aviso cada hora
 * de un entreno que no puede hacer, la pausa no sirve de nada.
 */
export function diasPendientes(
  routine: Routine | null,
  yaEntrenoHoy: boolean,
  ahora = Date.now(),
  dias = DIAS_VISTA,
  ciclo?: ContextoDelCiclo
): DiaPendiente[] {
  if (!routine) return [];
  const salida: DiaPendiente[] = [];
  const hoy = inicioDelDia(ahora);
  for (let i = 0; i < dias; i++) {
    const dia = inicioDelDia(hoy + i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
    if (i === 0 && yaEntrenoHoy) continue;
    if ((ciclo?.pausas ?? []).some((p) => cubre(p, dia))) continue;
    /*
     * El día se resuelve PARA ESE DÍA, con las pausas incluidas. Antes se le
     * pasaba un ancla ya desplazada por la pausa acumulada HOY, y para un día
     * de dentro de tres el desplazamiento era otro: el aviso anunciaba un día
     * del ciclo distinto del que el alumno se iba a encontrar al abrir la app.
     */
    const sesion = resolveSessionFor(routine, dia + 12 * 60 * 60 * 1000, ciclo);
    // Sin día programado no hay nada que se le pueda olvidar: ni descanso, ni
    // "a sensaciones" (ahí elige él si entrena y qué), ni un hueco del ciclo.
    if (!sesion.day || sesion.isRest) continue;
    salida.push({ dia, nombre: sesion.day.name });
  }
  return salida;
}

/**
 * Qué dice el aviso número `i`.
 *
 * Doce veces el mismo texto se lee una vez y se silencia; lo que cambia se
 * sigue leyendo. Y ninguno riñe: el que no ha entrenado ya lo sabe, y una app
 * que regaña se desinstala antes que una que acompaña.
 */
export function textoDeAviso(i: number, nombreDelDia: string): { titulo: string; cuerpo: string } {
  const textos = [
    {
      titulo: 'Te falta subir el entreno',
      cuerpo: frase`Hoy tocaba ${nombreDelDia}. Si ya lo has hecho, regístralo y queda guardado.`,
    },
    {
      titulo: frase`${nombreDelDia} sigue sin registrar`,
      cuerpo: 'Un minuto ahora y tu progreso queda completo.',
    },
    {
      titulo: '¿Lo dejamos hecho?',
      cuerpo: frase`Solo falta apuntar ${nombreDelDia}. Tu racha cuenta lo que registras.`,
    },
    {
      titulo: 'Aún estás a tiempo',
      cuerpo: frase`${nombreDelDia} de hoy todavía se puede registrar.`,
    },
  ];
  return textos[i % textos.length];
}
