import React from 'react';
import { frase } from '../lib/idioma';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { GateScreen, GateText } from './GateScreen';
import { ElegirPlan } from './ElegirPlan';
import { useAuth } from '../lib/auth-context';
import { track, trackOnce } from '../lib/analytics';
import {
  CAN_LINK_TO_PAYMENT,
  CONTACT_EMAIL,
  clientSlotsOf,
  PAGOS_ACTIVOS,
  subscriptionCheckoutUrl,
  verifySubscriptionNow,
} from '../lib/subscription';
import { showToast } from './Toast';
import { estadoInsignia, numeroFundador } from '../lib/fundador';
import { colors, fonts, radius, shadows, spacing, tabularNums, typography } from '../lib/theme';

const BENEFITS = [
  'Alumnos ilimitados con tu código de coach',
  'Rutinas, plantillas y programaciones a medida',
  'Gestión de cobros y pagos de tus alumnos',
  'Progreso, estadísticas y informes PDF',
  'Tus cursos y vídeos de técnica propios',
];

/**
 * Muro de suscripción: aparece cuando se acaba el año pagado (o la prueba de
 * una cuenta antigua). Los datos no se tocan nunca; solo se bloquea el acceso
 * hasta renovar.
 */
const ATHLETE_BENEFITS = [
  'Tus rutinas, a tu medida y sin límite',
  'Cada serie, cada récord y cada progresión, registrados',
  'Tu evolución por ejercicio, con números que no mienten',
  'Nutrición y macros alineados con tu objetivo',
  'Racha y logros para no soltar la barra',
];

export function Paywall() {
  const { profile, signOut, refreshProfile } = useAuth();
  const isAthlete = profile?.role === 'athlete';
  // Plazas de alumno de ESTA cuenta: normalmente las del plan de entrada, pero
  // cero si el servidor detectó que se pagó con la misma tarjeta que ya las
  // gastó en otra cuenta. El texto tiene que decir la verdad en los dos casos.
  const plazas = clientSlotsOf(profile);
  // Si llegó pronto, tiene un número de fundador. Este es el único sitio donde
  // se ve apagado —el perfil ya no se abre— y también el único momento en que
  // decírselo sirve de algo: "vuelve y recuperas tu #0028" pesa mucho más que
  // cualquier lista de ventajas, y es verdad, que es lo que lo hace funcionar.
  const fundador = estadoInsignia(profile).numero;
  // Cuánta gente llega al muro de pago frente a cuánta lo cruza.
  React.useEffect(() => {
    void trackOnce('paywall_view');
  }, []);
  const [checking, setChecking] = React.useState(false);
  // Evita comprobaciones solapadas (sondeo + volver a la app + botón a la vez).
  const busyRef = React.useRef(false);

  // Comprueba en Stripe si ya consta el pago y, si es así, activa la cuenta.
  // `silent`: en las comprobaciones automáticas no molestamos con avisos; solo
  // el botón manual informa del motivo cuando aún no consta.
  const checkNow = React.useCallback(
    async (silent: boolean): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      try {
        const result = await verifySubscriptionNow(profile);
        if (result.active) {
          // Al refrescar el perfil, la puerta del layout deja pasar sola.
          await refreshProfile();
          return true;
        }
        if (!silent) {
          showToast(result.reason ? frase`Aún no: ${result.reason}` : 'Aún no consta el pago');
        }
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [profile, refreshProfile]
  );

  // 1) Al volver a la app tras pagar en el navegador (AppState → active, que en
  //    web cubre también volver a la pestaña): comprueba solo, en silencio.
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNow(true);
    });
    return () => sub.remove();
  }, [checkNow]);

  // 2) Sondeo periódico mientras el muro está visible, como red de seguridad
  //    (por si el pago tarda en confirmarse o AppState no dispara).
  React.useEffect(() => {
    const id = setInterval(() => checkNow(true), 5000);
    return () => clearInterval(id);
  }, [checkNow]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await checkNow(false);
    } finally {
      setChecking(false);
    }
  };

  const checkoutUrl = subscriptionCheckoutUrl(profile);
  const handlePay = () => {
    void track('checkout_start');
    if (checkoutUrl) {
      // Stripe activa la cuenta sola tras pagar (webhook + client_reference_id).
      Linking.openURL(checkoutUrl).catch(() => {});
    } else {
      const plan = isAthlete ? 'Atleta' : 'Pro';
      Linking.openURL(
        `mailto:${CONTACT_EMAIL}?subject=Suscripción UDECA ${plan}&body=Hola, quiero activar mi suscripción de UDECA (${plan}). Mi correo es: ${profile?.email ?? ''}`
      ).catch(() => {});
    }
  };

  /*
   * Tres situaciones distintas, y decir la verdad en cada una importa.
   *
   *  - Todavía no se cobra (PAGOS_ACTIVOS apagado): no es que esta persona no
   *    pueda pagar, es que AÚN NO SE PUEDE. Decirle "tu cuenta no está activa"
   *    y callarse la sonaría a que el fallo es suyo y se pondría a buscar el
   *    botón de pagar hasta rendirse. Se le dice lo que hay y a dónde escribir.
   *  - Se cobra, pero no desde aquí (iPhone): texto neutro a propósito, sin
   *    mandar a pagar fuera, que es justo lo que prohíbe la norma 3.1.1.
   *  - Se cobra desde aquí: el muro de siempre.
   */
  const titulo = !PAGOS_ACTIVOS
    ? 'Las suscripciones todavía no están abiertas'
    : !CAN_LINK_TO_PAYMENT
      ? 'Tu cuenta no está activa'
      : isAthlete
        ? 'Tu año ha terminado'
        : 'Renueva tu cuenta de entrenador';

  const explicacion = !PAGOS_ACTIVOS
    ? 'Se te ha acabado el plazo, pero todavía no hemos abierto los pagos. Escríbenos y te ampliamos el acceso a mano. Tus datos, tus rutinas y todo tu progreso siguen intactos.'
    : !CAN_LINK_TO_PAYMENT
    ? 'Tus datos, tus rutinas y todo tu progreso siguen intactos. En cuanto tu cuenta vuelva a estar activa, la app lo reconoce sola.'
    : isAthlete
      ? 'Ya has hecho la parte difícil: un año entrenando. Todo tu progreso sigue aquí, intacto, esperándote. Renueva y sigue donde lo dejaste.'
      : plazas === 0
        ? 'Esta cuenta no incluye alumnos: su tarjeta ya gastó las plazas en otra cuenta de entrenador. Con el plan anual tienes alumnos ilimitados. Tus datos están a salvo y te esperan.'
        : 'Para seguir llevando a tu grupo hace falta el plan anual, con alumnos ilimitados y la app entera. Tus alumnos, sus rutinas y su historial están a salvo y te esperan.';

  return (
    <GateScreen
      icono={isAthlete ? 'flame-outline' : 'trending-up-outline'}
      titulo={titulo}
      texto={explicacion}
      nota={
        !PAGOS_ACTIVOS
          ? frase`Escríbenos a ${CONTACT_EMAIL} y te ampliamos el acceso.`
          : CAN_LINK_TO_PAYMENT
            ? 'Se abre la web para activarla. Al volver, tu cuenta se enciende sola en unos segundos; si tardara, pulsa "Ya he pagado · Actualizar".'
            : frase`¿Algún problema con tu cuenta? Escríbenos a ${CONTACT_EMAIL}.`
      }
      onSalir={signOut}
    >
      {/* La insignia, apagada pero con su número intacto. Sin oro: encendida
          se la ha ganado quien está dentro. */}
      {fundador ? (
        <View style={styles.fundadorCaja}>
          <View style={styles.fundadorFila}>
            <Ionicons name="shield-outline" size={17} color={colors.textMuted} />
            <Text style={styles.fundadorNumero}>{numeroFundador(fundador)}</Text>
            <Text style={styles.fundadorEtiqueta}>FUNDADOR</Text>
          </View>
          <Text style={styles.fundadorTexto}>
            Ese número es tuyo para siempre. Vuelve y la insignia se enciende otra vez, con el mismo
            número.
          </Text>
        </View>
      ) : null}

      {(isAthlete ? ATHLETE_BENEFITS : BENEFITS).map((b) => (
        <View key={b} style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.benefitText}>{b}</Text>
        </View>
      ))}

      {/* Un solo camino para los dos: se paga por años. Al atleta se le
          enseña con ElegirPlan porque ahí está contado qué se lleva; al
          entrenador, el botón de siempre. */}
      {CAN_LINK_TO_PAYMENT && isAthlete && checkoutUrl ? (
        <ElegirPlan profile={profile} nota={null} />
      ) : CAN_LINK_TO_PAYMENT ? (
        <Button
          // Sin precio y diciendo a dónde lleva: el importe se ve en la web,
          // que es donde está al día (ver lib/subscription.ts).
          title={checkoutUrl ? 'Continuar en la web' : 'Contactar para activar'}
          onPress={handlePay}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
      <Button
        title={
          checking
            ? 'Comprobando...'
            : CAN_LINK_TO_PAYMENT
              ? 'Ya he pagado · Actualizar'
              : 'Ya está activa · Actualizar'
        }
        variant={CAN_LINK_TO_PAYMENT ? 'secondary' : 'primary'}
        onPress={handleCheck}
        loading={checking}
        style={{ marginTop: spacing.sm }}
      />

      {CAN_LINK_TO_PAYMENT && !isAthlete && plazas > 0 ? (
        <GateText>
          ¿Prefieres no activarlo? Puedes volver a {plazas} alumnos o menos y
          recuperas el acceso al instante, sin perder nada.
        </GateText>
      ) : null}
    </GateScreen>
  );
}

const styles = StyleSheet.create({
  fundadorCaja: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fundadorFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fundadorNumero: {
    fontSize: 20,
    color: colors.text,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },
  fundadorEtiqueta: {
    ...typography.label,
    color: colors.textFaint,
    letterSpacing: 1.5,
    fontSize: 10,
  },
  fundadorTexto: { ...typography.small, color: colors.textFaint, lineHeight: 17, marginTop: 2 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    alignSelf: 'stretch',
  },
  benefitText: { ...typography.small, color: colors.text, flex: 1 },
});
