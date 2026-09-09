import { esMismoDia, inicioDelDia, masDias } from './fechas';
import { frase } from './idioma';
import { conMiles } from './texto';

/**
 * El contador de pasos, dentro de Nutrición.
 *
 * Está aquí y no en Progreso a propósito: los pasos no son entrenamiento, son
 * el gasto del resto del día, y es en Nutrición donde esa cifra significa algo.
 * Alguien que entrena cuatro horas a la semana y pasa las otras ciento sesenta
 * y cuatro sentado no tiene un problema de entrenamiento.
 *
 * DE DÓNDE SALEN LOS PASOS
 *
 * - En iPhone se leen del contador del propio teléfono (el mismo que alimenta
 *   Salud), incluido lo andado con la app cerrada.
 * - En Android los cuenta el sensor MIENTRAS LA APP ESTÁ DELANTE, y por eso la
 *   cifra se SUMA a lo que ya hubiera del día en vez de sustituirlo: si se
 *   contara solo lo de la app abierta, abrir UDECA a las ocho de la tarde
 *   borraría el día entero. Los pasos del día completo en Android viven en
 *   Health Connect, que exige un permiso de datos de salud que Google revisa a
 *   mano; se implementó, la revisión no lo aceptó, y se quitó entero antes que
 *   tener la app parada por él (ver components/ContadorDePasos.tsx).
 * - Y siempre se puede escribir a mano, que es lo que hace que esto funcione
 *   para quien lleva un reloj o usa otra app.
 */

/**
 * Pasos al día cuando nadie ha elegido.
 *
 * Lo normal es que lo ponga el ENTRENADOR en la ficha de cada alumno: no es lo
 * mismo el que trabaja de repartidor que el que está ocho horas sentado, y una
 * cifra igual para los dos no la cumple ninguno de los dos por motivos
 * distintos. Esta es la que se usa mientras no lo haya decidido.
 */
export const OBJETIVO_POR_DEFECTO = 10000;

/** Lo que se puede pedir sin que sea un disparate: de 1.000 a 40.000. */
export const OBJETIVO_MINIMO = 1000;
export const OBJETIVO_MAXIMO = 40000;

/**
 * El objetivo escrito a mano, en número, o nada si no vale.
 *
 * Nada, y no la cifra por omisión: quien borra el campo está quitando el
 * objetivo que puso, y devolverle 10.000 sería no dejarle deshacerlo.
 */
export function objetivoDeTexto(texto: string): number | undefined {
  const n = Number.parseInt(String(texto ?? '').replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < OBJETIVO_MINIMO || n > OBJETIVO_MAXIMO) return undefined;
  return n;
}

/** De dónde vino la cifra. Importa para saber si se puede pisar. */
export type OrigenDePasos = 'telefono' | 'mano';

export interface RegistroDePasos {
  /** Día (a medianoche). */
  date: number;
  steps: number;
  source: OrigenDePasos;
}

export interface ProgresoDePasos {
  pasos: number;
  objetivo: number;
  /** 0..1, sin pasarse de 1. */
  ratio: number;
  cumplido: boolean;
  quedan: number;
}

export function progresoDePasos(pasos: number, objetivo = OBJETIVO_POR_DEFECTO): ProgresoDePasos {
  const meta = Math.max(1, Math.round(objetivo));
  const n = Math.max(0, Math.round(pasos));
  return {
    pasos: n,
    objetivo: meta,
    ratio: Math.min(1, n / meta),
    cumplido: n >= meta,
    quedan: Math.max(0, meta - n),
  };
}

/** Los pasos de hoy, si ya hay registro. */
export function pasosDeHoy(registros: RegistroDePasos[], ahora = Date.now()): RegistroDePasos | null {
  return registros.find((r) => esMismoDia(r.date, ahora)) ?? null;
}

/**
 * Los últimos siete días, de más antiguo a más reciente, con hueco a cero en
 * los días sin registro.
 *
 * Los ceros van a propósito: una barra vacía es un día sin andar, y verlo es
 * justo lo que hace que la semana signifique algo. Saltárselos dibujaría una
 * semana perfecta hecha de tres días.
 */
export function ultimosSieteDias(
  registros: RegistroDePasos[],
  ahora = Date.now()
): { date: number; steps: number }[] {
  const porDia = new Map<number, number>();
  for (const r of registros) porDia.set(inicioDelDia(r.date), r.steps);
  return Array.from({ length: 7 }, (_, i) => {
    const date = masDias(ahora, -(6 - i));
    return { date, steps: porDia.get(date) ?? 0 };
  });
}

/** Media diaria de la semana, contando los días en blanco. */
export function mediaSemanal(registros: RegistroDePasos[], ahora = Date.now()): number {
  const dias = ultimosSieteDias(registros, ahora);
  return Math.round(dias.reduce((n, d) => n + d.steps, 0) / dias.length);
}

/**
 * Calorías aproximadas de andar esos pasos.
 *
 * Es una estimación y se presenta como tal: depende del peso, del terreno y
 * del ritmo, y ninguna app del mundo la sabe de verdad. Sirve para lo que
 * tiene que servir —ver que andar mueve la aguja del día— y no para cuadrar
 * una dieta al gramo.
 *
 * Sin peso no se inventa nada: se devuelve 0 y no se enseña.
 */
export function caloriasDePasos(pasos: number, pesoKg?: number): number {
  if (!pesoKg || pesoKg <= 0 || pasos <= 0) return 0;
  return Math.round(pasos * pesoKg * 0.0005);
}

/**
 * EL PASO FANTASMA DE ANDROID
 *
 * El sensor de Android (`TYPE_STEP_COUNTER`) cuenta desde que se encendió el
 * teléfono, y suelta un primer aviso con ese total en cuanto alguien se pone a
 * escuchar. Para que ese número no salga por la pantalla, el módulo de Expo
 * toma como origen `total - 1`... y el resultado es que **el primer aviso
 * siempre vale exactamente 1**, se haya andado o no.
 *
 * Ese 1 es el que llegaba a la app y se guardaba como los pasos del día. Quien
 * pulsaba "traer los pasos del móvil" sentado en el sofá veía "1 paso", y con
 * razón pensaba que el contador estaba roto: lo estaba, pero no por su móvil.
 *
 * Aquí se descuenta. Lo que queda son los pasos andados DE VERDAD mientras la
 * app escuchaba, que puede ser cero — y cero es una respuesta honesta.
 */
export function sinElPasoFantasma(lectura: number): number {
  return Math.max(0, Math.round(lectura) - 1);
}

/**
 * Qué cifra guardar cuando llega una lectura del teléfono.
 *
 * En iPhone la lectura es la del día entero, así que manda. En Android solo
 * cuenta lo andado con la app abierta, así que se suma a lo que ya había: si
 * se sustituyera, abrir UDECA por la tarde borraría la mañana.
 *
 * UNA LECTURA NUNCA BAJA EL CONTADOR DEL DÍA
 *
 * Los pasos de un día solo pueden subir. Así que si la lectura viene por
 * debajo de lo que ya había apuntado, no es que se haya andado menos: es que
 * la lectura ha salido mal. Guardarla sería cambiar un dato bueno por uno malo.
 *
 * Antes esto solo protegía lo escrito a mano, y dejaba que una lectura
 * defectuosa —un 1, un 0— se llevara por delante los 8.000 pasos que el propio
 * teléfono había dado dos horas antes. Ahora protege las dos cosas: lo que se
 * teclea desde un reloj y lo que ya había leído el móvil.
 */
export function pasosAGuardar(
  previo: RegistroDePasos | null,
  lectura: number,
  { acumulativo }: { acumulativo: boolean }
): number {
  const n = Math.max(0, Math.round(lectura));
  if (!previo) return n;
  if (!acumulativo) return Math.max(n, previo.steps);
  return previo.steps + n;
}

/** La frase que acompaña al anillo. Ni felicita de más ni riñe. */
export function textoDePasos(p: ProgresoDePasos): string {
  if (p.pasos === 0) return frase`Hoy aún no has andado. El objetivo son ${conMiles(p.objetivo)} pasos.`;
  if (p.cumplido) return 'Objetivo del día cumplido. Todo lo que venga es de más.';
  return frase`Te quedan ${conMiles(p.quedan)} pasos para el objetivo.`;
}

/**
 * El balance del día: lo que puedes comer, lo que has comido y lo que queda.
 *
 * Los pasos SUMAN al presupuesto en vez de restarse de lo comido. Es la misma
 * resta, pero dicha al derecho: "hoy tienes 2.320" se entiende; "has comido
 * 1.450 menos 320" no lo entiende nadie a las once de la noche con hambre.
 *
 * `restantes` puede salir negativo a propósito. Enseñar un cero cuando alguien
 * se ha pasado 600 kcal es esconder justo el dato por el que ha entrado.
 */
export interface BalanceDelDia {
  /** Las del plan, sin tocar. */
  objetivo: number;
  /** Las que ha ganado andando (0 si no hay peso con el que estimarlo). */
  ganadas: number;
  /** Objetivo + ganadas: el presupuesto de hoy. */
  disponibles: number;
  consumidas: number;
  /** Negativo si se ha pasado. */
  restantes: number;
  pasado: boolean;
}

export function balanceDelDia(
  objetivo: number,
  consumidas: number,
  ganadas = 0
): BalanceDelDia {
  const obj = Math.max(0, Math.round(objetivo));
  const gan = Math.max(0, Math.round(ganadas));
  const com = Math.max(0, Math.round(consumidas));
  const disponibles = obj + gan;
  const restantes = disponibles - com;
  return {
    objetivo: obj,
    ganadas: gan,
    disponibles,
    consumidas: com,
    restantes,
    pasado: restantes < 0,
  };
}

/** La línea de debajo de la cifra grande. Dice de dónde sale el presupuesto. */
export function textoDelBalance(b: BalanceDelDia): string {
  const base = `${conMiles(b.consumidas)} / ${conMiles(b.disponibles)} kcal`;
  return b.ganadas > 0
    ? frase`${base} · ${conMiles(b.objetivo)} del plan + ${conMiles(b.ganadas)} por andar`
    : base;
}
