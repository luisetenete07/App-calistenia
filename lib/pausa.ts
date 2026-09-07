import { inicioDelDia, nombreDelMes } from './fechas';
import { frase } from './idioma';

/**
 * Pausa del plan: unos días en los que la programación no exige nada.
 *
 * El caso real es siempre el mismo: alguien se lesiona, se va de viaje o le
 * cae una semana imposible. Hasta ahora la app no tenía forma de decir eso, y
 * el alumno pagaba el silencio por partida triple —perdía la racha, le
 * llegaban avisos de un entreno que no podía hacer, y en "días sueltos" el
 * ciclo seguía rodando sin él, así que al volver le tocaba un día que nunca
 * llegó a entrenar.
 *
 * Una pausa arregla las tres cosas a la vez:
 *
 *  - Esos días NO rompen la racha (van como días de descanso).
 *  - No se avisa de nada.
 *  - El ciclo se CONGELA: los días de pausa no cuentan, así que al volver se
 *    retoma exactamente donde se dejó. Esto es lo que hace que "a la semana
 *    siguiente vuelve al plan con normalidad" sea verdad y no una frase.
 *
 * Nada impide entrenar durante la pausa: si un día se encuentra bien y
 * registra una sesión, cuenta como cualquier otra. Una pausa quita
 * obligaciones, no permisos.
 *
 * POR QUÉ SE GUARDAN LAS PAUSAS PASADAS
 *
 * El congelado del ciclo se calcula sumando los días de pausa ya consumidos.
 * Si al terminar se borrara la pausa, esa suma volvería a cero y el ciclo daría
 * un salto hacia delante justo el día de volver — el fallo que la pausa venía a
 * evitar. Por eso quedan guardadas, y se podan solas al cabo de medio año
 * (`podarPausas`): a esas alturas ya no caen dentro del ciclo en curso —solo
 * cuentan las pausas posteriores a su Día 1—, así que quitarlas no mueve nada.
 */

export interface PausaPlan {
  /** Primer día de la pausa, a las 00:00. */
  desde: number;
  /** Último día INCLUIDO, a las 00:00. */
  hasta: number;
  /** "Lesión de hombro", "Viaje". Se le enseña al alumno. */
  motivo?: string;
  /** Quién la puso. El alumno ve de quién viene. */
  porQuien: 'coach' | 'alumno';
  creadaEn: number;
}

const DIA = 24 * 60 * 60 * 1000;

/** Días que ocupa una pausa, contando el primero y el último. */
export function duracionEnDias(p: PausaPlan): number {
  return Math.max(1, Math.round((inicioDelDia(p.hasta) - inicioDelDia(p.desde)) / DIA) + 1);
}

/** ¿Cae este día dentro de la pausa? */
export function cubre(p: PausaPlan, dia: number): boolean {
  const d = inicioDelDia(dia);
  return d >= inicioDelDia(p.desde) && d <= inicioDelDia(p.hasta);
}

/** La pausa que cubre hoy, si hay alguna. */
export function pausaActiva(pausas: PausaPlan[] | undefined, ahora = Date.now()): PausaPlan | null {
  return (pausas ?? []).find((p) => cubre(p, ahora)) ?? null;
}

/** Días que quedan de pausa contando hoy. 0 si no hay pausa activa. */
export function diasQueQuedan(p: PausaPlan | null, ahora = Date.now()): number {
  if (!p) return 0;
  return Math.max(0, Math.round((inicioDelDia(p.hasta) - inicioDelDia(ahora)) / DIA) + 1);
}

/**
 * Todos los días de pausa, a las 00:00, para dárselos a la racha.
 *
 * `currentStreak` ya sabe tratar días que "no cuentan ni rompen" —los usa el
 * modo Sensaciones—, así que una pausa entra por esa misma puerta en vez de
 * inventar un caso nuevo dentro del cálculo de la racha.
 */
export function diasDePausa(pausas: PausaPlan[] | undefined, hasta = Date.now()): number[] {
  const salida: number[] = [];
  const tope = inicioDelDia(hasta);
  for (const p of pausas ?? []) {
    const fin = Math.min(inicioDelDia(p.hasta), tope);
    for (let d = inicioDelDia(p.desde); d <= fin; d += DIA) salida.push(d);
  }
  return salida;
}

/*
 * EL CONGELADO DEL CICLO VIVE EN lib/ciclo.ts
 *
 * Aquí hubo un `anclaConPausas(ancla, pausas)` que movía el ancla hacia delante
 * tantos días como pausa se llevara ACUMULADA DESDE SIEMPRE. Tenía dos fallos
 * grandes:
 *
 *  - Cobraba pausas que ya no venían al caso. Un alumno que reiniciaba su ciclo
 *    hoy arrastraba los días de una pausa del mes pasado: pedía el Día 1 y le
 *    salía el Día 6.
 *  - Solo valía para HOY. La racha mira días del pasado y los avisos de entreno
 *    días del futuro, y a esos días se les aplicaba el congelado de hoy.
 *
 * `indiceDelCiclo` lo hace bien: cuenta los días de pausa del tramo que va del
 * ancla al día por el que se pregunta, y ni uno más.
 */

/**
 * Guarda una pausa nueva quitando las que se solapen.
 *
 * Dos pausas sobre los mismos días congelarían el ciclo el doble, así que la
 * nueva manda: cualquier pausa anterior que toque sus días desaparece.
 */
export function conPausaNueva(
  pausas: PausaPlan[] | undefined,
  nueva: PausaPlan
): PausaPlan[] {
  const desde = inicioDelDia(nueva.desde);
  const hasta = inicioDelDia(nueva.hasta);
  const limpia = { ...nueva, desde, hasta };
  const resto = (pausas ?? []).filter(
    (p) => inicioDelDia(p.hasta) < desde || inicioDelDia(p.desde) > hasta
  );
  return [...resto, limpia].sort((a, b) => a.desde - b.desde);
}

/**
 * Termina la pausa activa HOY.
 *
 * No se borra: se recorta para que acabe ayer. Borrarla devolvería al ciclo los
 * días que ya se saltó y le haría dar un salto hacia delante justo al volver.
 * Si se corta el mismo día que empezó, entonces sí desaparece: no llegó a
 * congelar nada.
 */
export function terminadaHoy(
  pausas: PausaPlan[] | undefined,
  ahora = Date.now()
): PausaPlan[] {
  const hoy = inicioDelDia(ahora);
  return (pausas ?? []).flatMap((p) => {
    if (!cubre(p, hoy)) return [p];
    if (inicioDelDia(p.desde) >= hoy) return [];
    return [{ ...p, hasta: hoy - DIA }];
  });
}

/**
 * Quita las pausas de hace más de medio año.
 *
 * Congelan días que ya no afectan a ninguna semana en curso, y el perfil no
 * puede crecer sin fin. Medio año es de sobra: el ciclo más largo que monta
 * nadie no llega.
 */
export function podarPausas(pausas: PausaPlan[] | undefined, ahora = Date.now()): PausaPlan[] {
  const limite = inicioDelDia(ahora) - 180 * DIA;
  return (pausas ?? []).filter((p) => inicioDelDia(p.hasta) >= limite);
}

/** "Del 10 al 14 de agosto", para contarlo en una línea. */
export function textoRango(p: PausaPlan): string {
  const a = new Date(p.desde);
  const b = new Date(p.hasta);
  const mismoMes = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (inicioDelDia(p.desde) === inicioDelDia(p.hasta)) {
    return frase`El ${a.getDate()} de ${nombreDelMes(a)}`;
  }
  return mismoMes
    ? frase`Del ${a.getDate()} al ${b.getDate()} de ${nombreDelMes(b)}`
    : frase`Del ${a.getDate()} de ${nombreDelMes(a)} al ${b.getDate()} de ${nombreDelMes(b)}`;
}
