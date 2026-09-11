import type { UserProfile } from './types';

/**
 * Los enlaces de Stripe y las direcciones que se abren para pagar.
 *
 * POR QUÉ ESTÁN AQUÍ Y NO EN lib/subscription.ts
 *
 * Por lo mismo que `planBase.ts`: `subscription.ts` lee `Platform.OS` al
 * cargarse, así que todo lo que lo importe arrastra React Native entera y no se
 * puede ejecutar en Node pelado. Eso dejaba SIN PROBAR justo la parte que
 * decide a qué producto de Stripe se manda a cada persona.
 *
 * Y esa es la parte cara. Un enlace equivocado no da error: la pasarela se
 * abre, la tarjeta pasa y se cobra otra cosa. Un enlace sin `client_reference_id`
 * tampoco: el dinero entra y la cuenta no se activa nunca, sin un solo aviso.
 * Los dos se descubren mirando las cuentas del mes.
 *
 * Aquí no se importa nada de React Native, así que
 * `scripts/check-cadena-cobro.mjs` recorre la cadena entera de verdad, llamando
 * a estas funciones con cada rol y cada plan.
 *
 * Se reexporta todo desde `lib/subscription.ts` para no tocar ni un import de
 * los que ya había.
 */

/**
 * Payment Links de Stripe. COBRAN DE VERDAD.
 *
 * LOS CUATRO DEL MODELO
 *
 *   - Primer año de entrenador:   27 €  (pago único)
 *   - Primer año de atleta:       17 €  (pago único)
 *   - Cuota anual de entrenador: 180 €/año  (el plan que quita el tope)
 *   - Cuota anual de atleta:      96 €/año
 *
 * SON DE PRODUCCIÓN, Y ESO HAY QUE MIRARLO CADA VEZ
 *
 * NUNCA los de prueba (`buy.stripe.com/test_…`): abren la pasarela, aceptan la
 * tarjeta, dan las gracias y no cobran nada, así que quien pulsara se quedaría
 * convencido de haber pagado. Ya estuvieron publicados una vez, de ahí el
 * guardián en scripts/check-pago-ios.mjs.
 *
 * Y cada producto al suyo: un enlace equivocado no se nota al probar —la
 * pasarela se abre, la tarjeta pasa, la cuenta se activa— y se descubre
 * mirando las cuentas del mes. Lo comprueba scripts/check-stripe.mjs.
 *
 * Si alguno hubiera que quitarlo, se deja VACÍO (''), nunca con el de otro
 * importe: vacío se comporta solo —`entryCheckoutUrl` y
 * `subscriptionCheckoutUrl` devuelven null y el botón no se enseña— y nadie
 * puede pagar el importe que no es.
 *
 * Los dos del primer año son los MISMOS que van en `web/config.js`: la web los
 * usa para quien llega de fuera y la app para quien se registró sin pasar por
 * ella. Si cambias uno, cambia el otro — check-stripe.mjs se queja si se
 * separan.
 *
 * La app les añade `?client_reference_id=<uid>` para que el webhook active la
 * cuenta correcta sola, y `prefilled_email` para no hacer escribir el correo.
 */
export const COACH_ENTRY_LINK: string =
  'https://buy.stripe.com/28E4gy8ezcCT70I43a3sI07';
export const ATHLETE_ENTRY_LINK: string =
  'https://buy.stripe.com/00w14mamH9qHetafLS3sI06';
/**
 * La cuota anual del entrenador (180 €). Sigue siendo la de siempre: el precio
 * no ha cambiado, así que el enlace tampoco.
 */
export const COACH_PAYMENT_LINK: string =
  'https://buy.stripe.com/eVqcN4cuP9qH70IgPW3sI02';
/**
 * La cuota anual del atleta (96 €). También es la de siempre: el producto ya
 * existía en Stripe con ese importe, y 96 es mejor titular que 95 porque son
 * 8,00 € al mes exactos (ver lib/precios.ts).
 */
export const ATHLETE_ANNUAL_LINK: string =
  'https://buy.stripe.com/3cIdR866rcCT98Q9nu3sI05';

/**
 * Le pega al enlace el uid y el correo.
 *
 * El uid es lo que hace que el webhook sepa a quién activar. Sin él el pago
 * entra igual y la cuenta se queda muerta, así que va aquí, en un solo sitio,
 * y no en cada llamada.
 */
function conQuienPaga(base: string, profile: UserProfile): string {
  const sep = base.includes('?') ? '&' : '?';
  return (
    `${base}${sep}client_reference_id=${encodeURIComponent(profile.uid)}` +
    `&prefilled_email=${encodeURIComponent(profile.email)}`
  );
}

/** Enlace del alta con el uid dentro, para que el webhook sepa a quién activar. */
export function entryCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_ENTRY_LINK : COACH_ENTRY_LINK;
  if (!base) return null;
  return conQuienPaga(base, profile);
}

/**
 * URL de la cuota anual, con su uid para la activación automática.
 *
 * Ya no hay nada que elegir: se paga por años. Antes el atleta tenía mensual o
 * anual y había que decirle a esta función cuál; ahora el atleta renueva a 95 €
 * al año y el entrenador a 180 €, y cada rol tiene un único enlace.
 */
export function subscriptionCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_ANNUAL_LINK : COACH_PAYMENT_LINK;
  if (!base) return null;
  return conQuienPaga(base, profile);
}
