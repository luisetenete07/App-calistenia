import { diasEntre, inicioDelDia, masDias } from './fechas';
import { cubre, type PausaPlan } from './pausa';

/**
 * La aritmética del plan por ciclos (días sueltos), en un solo sitio.
 *
 * QUÉ ES UN CICLO
 *
 * Un plan por ciclos no va por días de la semana: va por una rueda de días
 * —"empuje, tirón, piernas, descanso"— que gira sin parar desde el día en que
 * empezó. Para saber qué toca hoy hacen falta tres cosas: dónde empezó la rueda
 * (el ANCLA), cuántos días tiene y cuántos días de pausa no han contado.
 *
 * POR QUÉ ESTÁ TODO AQUÍ Y NO REPARTIDO
 *
 * Estaba repartido, y por eso fallaba. La cuenta vivía en tres sitios que no se
 * hablaban —`lib/schedule.ts` para qué toca hoy, `lib/stats.ts` para la racha y
 * `lib/pausa.ts` para el congelado— y cada uno la hacía a su manera. El
 * resultado eran cuatro fallos distintos que el alumno vive como uno solo:
 * toca al día que quiere y la app le pone otro.
 *
 * LOS CUATRO FALLOS QUE ESTO CIERRA
 *
 *  1. LA PAUSA SE COBRABA DOS VECES. El congelado se hacía moviendo el ancla
 *     hacia delante tantos días como pausa se llevara ACUMULADA DESDE SIEMPRE.
 *     Así que un alumno que hubiera tenido dos días de pausa el mes pasado, al
 *     pulsar "reiniciar el ciclo" no se ponía en el Día 1: se ponía dos días más
 *     allá. Con un ciclo de siete días, pedía el Día 1 y le salía el Día 6.
 *     Aquí la pausa solo congela los días que caen DENTRO del ciclo en curso,
 *     que es lo único que significa "esos días no han pasado".
 *
 *  2. EL ANCLA ERA UNA FECHA FUTURA. Para fijar "hoy es el Día 4" se guardaba
 *     una fecha de dentro de cuatro días, porque quien decidía entre el ancla
 *     del alumno y la del coach era un `Math.max`: ganaba la fecha más grande.
 *     Eso hacía imposible distinguir "lo más reciente" de "lo más lejano", y una
 *     elección vieja podía tumbar a una nueva. Ahora el ancla es lo que dice
 *     ser —el día en que el ciclo empezó por su Día 1, nunca en el futuro— y
 *     quién manda se decide por CUÁNDO se decidió, no por qué fecha salió.
 *
 *  3. UNA FECHA DE INICIO FUTURA DEL COACH TUMBABA AL ALUMNO. Un coach que el
 *     viernes programa el plan "para el lunes" dejaba una fecha mayor que la de
 *     hoy, y con `Math.max` ganaba siempre: el alumno pulsaba "reiniciar" y no
 *     pasaba nada. Un botón que no hace nada es peor que no tenerlo.
 *
 *  4. EL DÍA DEL CICLO SOLO ERA CORRECTO HOY. El congelado se calculaba para
 *     HOY y luego se usaba para mirar hacia atrás (la racha) y hacia delante
 *     (los avisos de entreno). Un día del pasado tenía menos pausa consumida y
 *     uno del futuro más, así que las dos cuentas salían movidas. Aquí el día
 *     se pide siempre para una fecha concreta y la pausa se cuenta en ese
 *     tramo.
 */

/**
 * Lo que el alumno ha decidido sobre su ciclo, con la fecha en que lo decidió.
 *
 * La fecha no es decorativa: es lo único que permite saber qué gana cuando el
 * mismo alumno toca el ciclo desde el móvil y desde la tablet, o cuando el
 * coach reprograma el plan por su lado.
 */
export interface AnclaDelAlumno {
  /** El día (medianoche) en que su ciclo empieza por el Día 1. */
  ancla: number;
  /** Cuándo lo decidió. 0 en datos de versiones anteriores, que no lo guardaban. */
  decididaEn: number;
}

/** Lo que hace falta saber de la rutina para situar su ciclo. */
export interface CicloDeLaRutina {
  cycleStartDate?: number;
  /** Cuándo puso el coach esa fecha. Sin esto no se sabe si es más nueva que la del alumno. */
  cycleStartDateSetAt?: number;
}

/**
 * Tope de días que se recorren hacia atrás. Las pausas se podan a medio año
 * (`podarPausas`), así que un año es de sobra y evita que un dato corrupto
 * —una pausa con fechas al revés, por ejemplo— cuelgue la app.
 */
const TOPE_DIAS = 400;

/**
 * Días de pausa que caen entre el ancla y `dia`, los dos incluidos.
 *
 * Las pausas ANTERIORES al ancla no cuentan. Ese es el fallo nº 1: una pausa de
 * la que ya se volvió no puede seguir moviendo un ciclo que empezó después de
 * ella.
 *
 * El día del ancla SÍ cuenta si es de pausa. Suena raro —¿no es ese el Día 1?—
 * y es lo correcto: si el plan arranca el lunes y el alumno está de baja el
 * lunes, ese lunes no ha entrenado el Día 1, así que el Día 1 le espera al
 * volver. Cuando es el propio alumno quien dice "reinicia hoy",
 * `anclaParaIndice` retrocede el ancla lo que haga falta para que hoy le salga
 * el Día 1 igualmente.
 */
export function diasCongeladosEntre(
  ancla: number,
  pausas: PausaPlan[] | undefined,
  dia: number
): number {
  if (!pausas || pausas.length === 0) return 0;
  const desde = inicioDelDia(ancla);
  const hasta = inicioDelDia(dia);
  if (hasta < desde) return 0;

  // Un conjunto de días y no una suma de duraciones: dos pausas que se pisen
  // congelarían el doble, y el alumno repetiría entrenos sin entender por qué.
  const congelados = new Set<number>();
  for (const p of pausas) {
    let d = Math.max(inicioDelDia(p.desde), desde);
    const fin = Math.min(inicioDelDia(p.hasta), hasta);
    for (let i = 0; d <= fin && i < TOPE_DIAS; d = masDias(d, 1), i++) congelados.add(d);
  }
  return congelados.size;
}

/**
 * Qué día del ciclo (0-based) toca en `dia`.
 *
 * Se le pasa el día a propósito, en vez de dar por hecho que es hoy: la racha
 * pregunta por días del pasado y los avisos de entreno por días del futuro, y
 * las dos cosas tienen que salir bien (fallo nº 4).
 */
export function indiceDelCiclo(
  ancla: number,
  largo: number,
  dia: number,
  pausas?: PausaPlan[]
): number {
  if (largo <= 0) return 0;
  const transcurridos = diasEntre(ancla, dia) - diasCongeladosEntre(ancla, pausas, dia);
  return ((transcurridos % largo) + largo) % largo;
}

/**
 * El ancla que hay que guardar para que `dia` sea el día `indice` del ciclo.
 *
 * Es la vuelta de `indiceDelCiclo`, y no basta con restar: si en medio hay días
 * de pausa, esos días no cuentan, así que hay que retroceder uno más por cada
 * uno de ellos. Sin esto, un alumno que acaba de volver de una pausa pide el
 * Día 4 y la app le pone el Día 2 (fallo nº 1, por el otro lado).
 *
 * Se busca probando, y no con una resta, porque cada día que se retrocede puede
 * traer otro día de pausa consigo. La búsqueda avanza seguro: fuera de una
 * pausa, cada paso atrás suma un día que sí cuenta.
 *
 * El ancla que sale es SIEMPRE de hoy o de antes: es el día en que el ciclo
 * empezó, no un truco para ganar una comparación (fallo nº 2).
 */
export function anclaParaIndice(
  indice: number,
  pausas?: PausaPlan[],
  dia: number = Date.now()
): number {
  const hoy = inicioDelDia(dia);
  const objetivo = Math.max(0, Math.round(indice));
  for (let atras = objetivo; atras <= objetivo + TOPE_DIAS; atras++) {
    const candidata = masDias(hoy, -atras);
    if (atras - diasCongeladosEntre(candidata, pausas, hoy) === objetivo) return candidata;
  }
  // Inalcanzable con pausas sanas; si los datos vienen rotos, más vale un ciclo
  // desplazado que un bucle infinito.
  return masDias(hoy, -objetivo);
}

/**
 * De dos anclas del alumno, la que manda: la que decidió DESPUÉS.
 *
 * Sirve para juntar lo que hay en este móvil con lo que hay en la cuenta. Antes
 * se quedaba la fecha más grande, y como fijar un día guardaba una fecha futura,
 * una elección de la semana pasada podía tumbar un reinicio de hace un minuto.
 */
export function anclaQueManda(
  a: AnclaDelAlumno | null | undefined,
  b: AnclaDelAlumno | null | undefined
): AnclaDelAlumno | null {
  if (!a?.ancla) return b?.ancla ? b : null;
  if (!b?.ancla) return a;
  if (a.decididaEn !== b.decididaEn) return a.decididaEn > b.decididaEn ? a : b;
  // Las dos sin fecha de decisión: son datos de una versión anterior y no hay
  // forma de saber cuál es más nueva. Se conserva lo que hacía aquella versión.
  return a.ancla >= b.ancla ? a : b;
}

/**
 * El ancla que de verdad rige el ciclo: la del alumno o la del coach.
 *
 * MANDA EL ÚLTIMO QUE HABLÓ, NO LA FECHA MÁS GRANDE
 *
 * El alumno reinicia su ciclo o fija qué día es hoy sin tocar la rutina, que es
 * del coach. El coach reprograma la fecha de inicio cuando le hace falta. Gana
 * quien lo haya hecho más tarde, que es lo que espera cualquiera de los dos.
 *
 * Cuando el coach no ha dejado fecha de cuándo lo puso —rutinas guardadas por
 * versiones anteriores— gana el alumno. Es la elección segura: lo suyo es
 * siempre un gesto explícito y reciente dentro de la app, y el ciclo se
 * autocorrige en cuanto el coach vuelva a guardar la rutina.
 */
export function anclaEfectiva(
  rutina: CicloDeLaRutina | null | undefined,
  alumno: AnclaDelAlumno | null | undefined
): number {
  const delCoach = rutina?.cycleStartDate ?? 0;
  const puestaPorElCoach = rutina?.cycleStartDateSetAt ?? 0;
  const suya = alumno?.ancla ?? 0;
  if (!suya) return delCoach;
  if (!delCoach) return suya;
  return puestaPorElCoach > (alumno?.decididaEn ?? 0) ? delCoach : suya;
}

/** ¿Cae este día dentro de alguna pausa? (atajo para no importar `pausa` por esto). */
export function esDiaDePausa(pausas: PausaPlan[] | undefined, dia: number): boolean {
  return (pausas ?? []).some((p) => cubre(p, dia));
}
