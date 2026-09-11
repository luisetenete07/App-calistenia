/**
 * Los precios de UDECA, y solo los precios.
 *
 * POR QUÉ ESTÁN EN SU PROPIO FICHERO
 *
 * Por lo mismo que `planBase.ts` y `enlacesDeCobro.ts`: `subscription.ts` lee
 * `Platform.OS` en cuanto se carga, así que cualquier cosa que lo importe
 * arrastra React Native entera y no se puede ejecutar en Node pelado. Eso
 * dejaba sin comprobar los cuatro números que la web copia a mano en su HTML
 * —y una copia que nadie compara es una copia que un día dice otra cosa.
 *
 * Aquí no se importa nada, así que `scripts/check-precios.mjs` los lee de
 * verdad y comprueba que la web diga exactamente estos.
 *
 * Se reexporta todo desde `lib/subscription.ts`, así que nada de lo que ya los
 * importaba de allí tiene que cambiar.
 */

/**
 * LOS PRECIOS, EN UN SOLO SITIO.
 *
 * EL MODELO, EN TRES FRASES
 *
 *  - Se entra pagando el PRIMER AÑO ENTERO, una sola vez: 27 € el entrenador,
 *    17 € el atleta. Doce meses por delante, sin nada más que decidir.
 *  - Al terminar ese año hay que renovar: 180 € el entrenador, 95 € el atleta.
 *    Sin renovar, la cuenta de entrenador no se puede usar.
 *  - El entrenador puede pasarse al plan de 180 € cuando quiera, también
 *    durante el primer año: es el que quita el tope de cinco alumnos.
 *
 * POR QUÉ UN AÑO Y NO UNA PRUEBA
 *
 * Antes había 28 días de prueba y un alta de 1 €. Una prueba corta obliga a
 * decidir justo cuando el trabajo empieza a dar resultados —en calistenia, el
 * primer mes es casi todo aprender a colocarse— y esa decisión se toma con las
 * manos vacías. Un año por delante cambia la pregunta: ya no es "¿me servirá?"
 * sino "¿me ha servido?", y esa se responde mirando doce meses de progreso.
 *
 * Y el precio de entrada no es un descuento: es el año de trabajo que hace
 * falta para que el producto demuestre lo que vale.
 *
 * DÓNDE SE ENSEÑAN Y DÓNDE NO
 *
 * En la WEB, siempre por mes y con el total anual debajo: 2,25 €/mes se
 * compara con lo que cuesta una hora de entrenador, y 27 € de golpe no se
 * compara con nada. Pero el total va SIEMPRE visible, porque enseñar el
 * mensual y cobrar el anual sin decirlo es lo que hace que la gente pida la
 * devolución y se vaya.
 *
 * En la APP, nunca (ver el bloque de "LA APP NO DICE PRECIOS" más abajo).
 */

/** Entrenador: el primer año entero, pago único. */
export const COACH_FIRST_YEAR_EUR = 27;

/** Atleta: el primer año entero, pago único. */
export const ATHLETE_FIRST_YEAR_EUR = 17;

/**
 * Entrenador: la cuota anual.
 *
 * Es dos cosas a la vez, y por eso hay un solo número: el plan que quita el
 * tope de alumnos durante el primer año, y la única forma de seguir a partir
 * del segundo.
 */
export const ANNUAL_PRICE_EUR = 180;

/**
 * Atleta: la cuota anual a partir del segundo año.
 *
 * NOVENTA Y SEIS Y NO NOVENTA Y CINCO, a propósito: 96 entre 12 son 8,00 €
 * exactos, y "8 € al mes pagando el año" se lee de un vistazo. 95 salen a 7,92,
 * que ni se recuerda ni cabe en un titular. El euro de diferencia no lo nota
 * nadie; el titular sí.
 */
export const ATHLETE_ANNUAL_EUR = 96;

/**
 * Lo que sale al mes cada precio.
 *
 * CALCULADO, NUNCA ESCRITO A MANO. Un mensual escrito aparte se queda viejo el
 * día que cambie el anual, y entonces la web promete un número y la pasarela
 * cobra otro. Se redondean a dos decimales porque 27/12 son 2,25 exactos pero
 * 17/12 son 1,4166…, y en un escaparate eso es 1,42.
 */
const alMes = (anual: number): number => Math.round((anual / 12) * 100) / 100;

export const COACH_FIRST_YEAR_MONTHLY_EUR = alMes(COACH_FIRST_YEAR_EUR);
export const ATHLETE_FIRST_YEAR_MONTHLY_EUR = alMes(ATHLETE_FIRST_YEAR_EUR);
export const COACH_MONTHLY_EQUIV_EUR = alMes(ANNUAL_PRICE_EUR);
export const ATHLETE_MONTHLY_EQUIV_EUR = alMes(ATHLETE_ANNUAL_EUR);

/**
 * Lo que se ahorra el primer año frente a lo que costará después.
 *
 * CALCULADO, NUNCA ESCRITO A MANO, por lo mismo de siempre: es una proporción
 * entre dos precios, y mientras los dos cambien juntos sigue siendo verdad.
 * Escribir "85 %" a mano sería una cifra que se queda vieja en la versión que
 * el usuario no ha actualizado.
 */
export const AHORRO_PRIMER_ANO_COACH_PCT = Math.round(
  (1 - COACH_FIRST_YEAR_EUR / ANNUAL_PRICE_EUR) * 100
);
export const AHORRO_PRIMER_ANO_ATLETA_PCT = Math.round(
  (1 - ATHLETE_FIRST_YEAR_EUR / ATHLETE_ANNUAL_EUR) * 100
);
