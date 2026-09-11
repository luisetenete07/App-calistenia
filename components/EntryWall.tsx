import React from 'react';
import { frase } from '../lib/idioma';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Button } from './Button';
import { GateScreen, GateText } from './GateScreen';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { track, trackOnce } from '../lib/analytics';
import {
  CAN_LINK_TO_PAYMENT,
  CONTACT_EMAIL,
  FREE_CLIENT_LIMIT,
  claimEntryNow,
  entryCheckoutUrl,
} from '../lib/subscription';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * Alta de la cuenta: el primer año, pagado una vez.
 *
 * Lo que se compra aquí es el año entero, no una prueba: 27 € el entrenador,
 * 17 € el atleta. Se paga con tarjeta y queda una huella que es la misma para
 * la misma tarjeta en cualquier cuenta, y eso es lo que impide que un
 * entrenador se reparta en cuentas de cinco alumnos para no pagar el plan sin
 * tope. El que va de frente no nota nada: mete la tarjeta una vez y entra.
 *
 * EN iOS NO SE VENDE NADA. Las normas de la App Store prohíben cobrar por fuera
 * lo que se usa dentro, e incluso enlazar a la web para pagarlo; un muro con
 * precio y botón a Stripe es rechazo directo. Así que en iPhone esta pantalla
 * solo dice que la cuenta está sin activar, sin precio y sin enlace, igual que
 * hacen los servicios multiplataforma. La solución definitiva ahí son las
 * compras integradas de Apple, que son otro proyecto.
 */
export function EntryWall() {
  const { firebaseUser, profile, signOut, refreshProfile } = useAuth();
  const [comprobando, setComprobando] = React.useState(false);
  const esAtleta = profile?.role === 'athlete';
  const url = entryCheckoutUrl(profile);
  // iOS: ni precio ni enlace de pago (ver comentario de arriba).
  const puedeCobrarAqui = CAN_LINK_TO_PAYMENT;

  /**
   * Al pagar. Si aún no hay enlace de Stripe configurado, en vez de dejar al
   * usuario en un callejón sin salida se abre un correo: alguien que quiere
   * pagar y no puede es el peor sitio donde tener un hueco.
   */
  const pagar = () => {
    void track('checkout_start');
    const destino =
      url ??
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Alta en UDECA')}&body=${encodeURIComponent(
        frase`Hola, quiero activar mi cuenta de UDECA. Mi correo es: ${profile?.email ?? ''}`
      )}`;
    Linking.openURL(destino).catch(() => {});
  };

  React.useEffect(() => {
    void trackOnce('entry_wall_view');
  }, []);

  // Evita comprobaciones solapadas (sondeo + volver a la app + botón a la vez).
  const ocupado = React.useRef(false);

  /**
   * Vuelve a leer el perfil: si el pago ha entrado, el webhook ya habrá escrito
   * `entryPaidAt` y la puerta del layout deja pasar sola en el siguiente render.
   */
  const comprobar = React.useCallback(
    async (silencioso: boolean) => {
      if (ocupado.current) return false;
      ocupado.current = true;
      if (!silencioso) setComprobando(true);
      try {
        const fresco = await refreshProfile();
        if (fresco?.entryPaidAt) return true;
        // Puede haber pagado en la WEB, antes de tener cuenta: entonces el pago
        // está apuntado a su correo y hay que ir a recogerlo. Es el camino
        // normal de quien llega por udeca.app, no un caso raro.
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          const reclamado = await claimEntryNow(token);
          if (reclamado.activa) {
            await refreshProfile();
            return true;
          }
          if (!silencioso) {
            showToast(
              reclamado.motivo ??
                'Todavía no nos consta el pago. Dale un momento y vuelve a intentarlo.'
            );
            return false;
          }
        }
        if (!silencioso) {
          showToast('Todavía no nos consta el pago. Dale un momento y vuelve a intentarlo.');
        }
      } catch {
        if (!silencioso) showToast('No se pudo comprobar. Inténtalo otra vez.');
      } finally {
        ocupado.current = false;
        if (!silencioso) setComprobando(false);
      }
      return false;
    },
    [firebaseUser, refreshProfile]
  );

  // Al volver a la app desde el navegador de Stripe, se comprueba solo: nadie
  // debería tener que pulsar "ya he pagado" después de haber pagado.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void comprobar(true);
    });
    return () => sub.remove();
  }, [comprobar]);

  // Red de seguridad: el webhook de Stripe tarda unos segundos en escribir el
  // alta, y en web volver de la pestaña de pago no siempre dispara AppState.
  React.useEffect(() => {
    const id = setInterval(() => void comprobar(true), 5000);
    return () => clearInterval(id);
  }, [comprobar]);

  return (
    <GateScreen
      icono="key-outline"
      titulo={puedeCobrarAqui ? 'Activa tu cuenta' : 'Tu cuenta está sin activar'}
      nota={`¿Algún problema? Escríbenos a ${CONTACT_EMAIL}`}
      onSalir={signOut}
    >
      {puedeCobrarAqui ? (
        <>
          {/* Sin precio (ver lib/subscription.ts): el pago se completa en la
              web, que es donde el importe está siempre al día. Aquí solo se
              dice qué se lleva quien lo haga. */}
          <GateText>
            {esAtleta
              ? 'Entras con un año entero por delante. Al terminarlo decides si sigues.'
              : frase`Tu primer año incluye ${FREE_CLIENT_LIMIT} alumnos con su propia cuenta. Si tu grupo crece, pasas al plan sin tope.`}
          </GateText>
          <Button
            title={url ? 'Activar mi cuenta en la web' : 'Contactar para activar'}
            onPress={pagar}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Ya he pagado"
            variant="secondary"
            onPress={() => comprobar(false)}
            loading={comprobando}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : (
        <>
          <GateText>
            Esta cuenta todavía no está activa. Puedes activarla desde tu cuenta de UDECA y volver
            aquí: al entrar de nuevo, la app la reconoce sola.
          </GateText>
          <Button
            title="Ya está activa"
            onPress={() => comprobar(false)}
            loading={comprobando}
            style={{ marginTop: spacing.lg }}
          />
        </>
      )}
    </GateScreen>
  );
}

const styles = StyleSheet.create({
});
