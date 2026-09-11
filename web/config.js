/*
 * Todo lo que hay que rellenar de la web pública está AQUÍ, en un solo sitio.
 * Cambiar un enlace no debería obligar a tocar el HTML ni a saber programar.
 *
 * Cuando algo esté vacío, la web se comporta sola: los botones de descarga
 * salen como "Próximamente" y no llevan a ninguna parte rota.
 */
window.UDECA = {
  /** Dónde vive la app mientras no está en las tiendas. */
  appUrl: 'https://app.udeca.app',

  /**
   * Enlaces de pago del primer año.
   *
   * AHORA MISMO LLEVAN A /proximamente, Y ESO ES A PROPÓSITO.
   *
   * Los precios han cambiado —17 € el atleta y 27 € el entrenador, el primer
   * año entero— y los Payment Links de Stripe con esos importes todavía no
   * existen. Dejar aquí los antiguos habría sido lo peligroso: la página dice
   * 17 € y la pasarela cobra 1 €, sin dar ningún error a nadie. Un enlace
   * equivocado no se nota al probarlo —se abre, la tarjeta pasa, la cuenta se
   * activa— y se descubre mirando las cuentas del mes.
   *
   * CUANDO ESTÉN LOS ENLACES NUEVOS
   *
   * Se crean dos Payment Links en Stripe (Payments → Payment Links), uno por
   * rol para saber quién entra, y se pegan aquí los de PRODUCCIÓN
   * (`buy.stripe.com/…`, sin `test_`). Son los MISMOS dos que van en
   * lib/enlacesDeCobro.ts: si cambias uno, cambia el otro —
   * scripts/check-stripe.mjs se queja si se separan.
   *
   * Lo que viene después (los 180 €/año del entrenador sin tope de alumnos y
   * los 95 €/año del atleta al renovar) se cobra DESDE LA APP, cuando toca, no
   * aquí: nadie renueva un año antes de haberlo usado.
   */
  pagos: {
    altaAtleta: '/proximamente',
    altaCoach: '/proximamente',
  },

  /**
   * Descargas. Deja el valor vacío mientras la ficha no esté publicada: el
   * botón se queda en "Próximamente" en vez de llevar a un 404.
   *
   * NO hay descarga directa de APK, y no es un olvido: un APK repartido fuera
   * de la tienda tendría que traer su propio actualizador —Google prohíbe que
   * una app publicada en Play se actualice por su cuenta—, y eso es mantener
   * dos versiones distintas de Android para siempre. Con Play cubriendo el
   * móvil y la app web instalable en el ordenador, no compensa.
   */
  descargas: {
    appStore: 'https://apps.apple.com/app/id6794591283',
    playStore: 'https://play.google.com/store/apps/details?id=entrenadores.app',
  },

  /**
   * Comunidad privada y redes.
   *
   * `comunidad` es la PUERTA (acceso.udeca.app): pide nombre y correo antes de
   * dar el enlace, y es la que se enseña a quien todavía no es cliente.
   * `discord` es el enlace directo al servidor, y solo se usa donde ya no hace
   * falta filtrar a nadie: en la página de gracias, con el pago hecho.
   */
  comunidad: 'https://acceso.udeca.app',
  discord: 'https://discord.gg/Mhnx5DNdY7',
  instagram: 'https://www.instagram.com/udeca.app/',
  contacto: 'luistenaf@gmail.com',
};
