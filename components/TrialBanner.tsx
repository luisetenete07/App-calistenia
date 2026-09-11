import React from 'react';
import { frase } from '../lib/idioma';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { CAN_LINK_TO_PAYMENT, subscriptionCheckoutUrl, subscriptionState } from '../lib/subscription';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * Días con antelación con los que se avisa de que se acaba el año pagado.
 *
 * Los mismos que usa la tarea diaria del servidor (TRIAL_NUDGE_DAYS empieza en
 * 14, en payments-webhook/api/cron-daily.js). Que coincidan no es casualidad:
 * el correo y la app tienen que contar lo mismo el mismo día, o parece que una
 * de las dos se ha equivocado.
 */
const AVISO_DIAS = 14;

/**
 * Aviso de que el acceso se acaba. No bloquea nada: informa de los días que
 * quedan y deja el pago a un toque, para que la decisión se tome habiendo
 * usado ya la app y sin tener que ir a buscarla. Desaparece al renovar.
 *
 * Cubre DOS casos, y la diferencia importa al leerlo:
 *  - La prueba de una cuenta antigua: se avisa desde el primer día, porque el
 *    plazo entero es corto y el contador es parte de lo que se contrató.
 *  - El año pagado del modelo nuevo: solo en las dos últimas semanas. Enseñar
 *    "te quedan 300 días" a alguien que acaba de pagar su año es recordarle
 *    todos los días que esto se acaba, y no hay nada que decidir todavía.
 *
 * Quien tiene suscripción recurrente en Stripe no ve nada: a ese le renueva la
 * tarjeta sola, y avisarle de que se queda fuera sería falso.
 */
export function TrialBanner({ profile }: { profile: UserProfile | null }) {
  const sub = subscriptionState(profile);
  if (!sub.active || sub.daysLeft === null) return null;
  if (profile?.stripeSubscriptionId) return null;

  const days = sub.daysLeft;
  if (!sub.trial && days > AVISO_DIAS) return null;
  // El botón depende de si se puede enlazar a pagar (ver CAN_LINK_TO_PAYMENT):
  // el aviso se queda en informar de los días que quedan.
  const url = CAN_LINK_TO_PAYMENT ? subscriptionCheckoutUrl(profile) : null;
  // El último día se avisa con más énfasis (es cuando se decide).
  const urgent = days <= 2;

  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <Ionicons
        name={urgent ? 'alarm-outline' : 'sparkles-outline'}
        size={18}
        color={urgent ? colors.warning : colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {sub.trial
            ? days <= 1
              ? 'Último día de prueba'
              : frase`Te quedan ${days} días de prueba`
            : days <= 1
              ? 'Hoy se te acaba el año'
              : frase`Te quedan ${days} días de acceso`}
        </Text>
        <Text style={styles.subtitle}>
          {url
            ? sub.trial
              ? 'Actívala y sigue con todo tu progreso y tus alumnos.'
              : 'Renueva y sigue con todo tu progreso y tus alumnos.'
            : 'Tu progreso se queda contigo pase lo que pase.'}
        </Text>
      </View>
      {url ? (
        <Pressable onPress={() => Linking.openURL(url)} style={styles.action} hitSlop={6}>
          <Text style={styles.actionText}>{sub.trial ? 'Activar' : 'Renovar'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUrgent: { borderColor: colors.warningMuted },
  title: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  action: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  actionText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
