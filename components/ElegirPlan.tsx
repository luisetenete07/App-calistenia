import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { track } from '../lib/analytics';
import {
  CAN_LINK_TO_PAYMENT,
  subscriptionCheckoutUrl,
} from '../lib/subscription';
import type { UserProfile } from '../lib/types';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Cómo se paga un año de UDECA.
 *
 * POR QUÉ ES UN COMPONENTE Y NO UN BOTÓN SUELTO
 *
 * Sale en dos sitios —el muro de cuando se acaba el acceso y la tarjeta del
 * plan en el perfil— y son los dos únicos momentos en los que se le pide
 * dinero a un atleta. Duplicar los textos era garantizar que un día se
 * mejorara uno y el otro se quedara diciendo otra cosa.
 *
 * POR QUÉ NO HAY NINGÚN PRECIO AQUÍ
 *
 * La app no dice precios en ninguna plataforma; el porqué está entero en
 * lib/subscription.ts. El importe se ve en la página de pago, que es donde
 * está al día siempre.
 *
 * POR QUÉ YA NO HAY DOS OPCIONES
 *
 * Había mensual y anual, y el anual salía marcado con su ahorro. Con el modelo
 * del primer año eso sobra: se entra pagando un año entero y se sigue pagando
 * por años. No hay nada que elegir, así que no se finge una elección.
 *
 * Una pantalla que ofrece dos caminos cuando solo hay uno no es más amable:
 * es más lenta, y deja al que la lee buscando la diferencia entre dos cosas
 * que son la misma.
 */

interface Props {
  profile: UserProfile | null;
  /**
   * Texto del pie. `null` lo quita: en el muro, la propia pantalla ya dice
   * abajo qué pasa al pagar, y repetirlo dos veces en el mismo scroll queda
   * como un formulario mal montado.
   */
  nota?: string | null;
}

export function ElegirPlan({ profile, nota }: Props) {
  /*
   * La comprobación de iOS va AQUÍ DENTRO, no en quien lo usa.
   *
   * Los dos sitios actuales ya la hacían por su cuenta, así que esto no cambia
   * nada hoy. Pero este componente es justo el que alguien reutilizará en una
   * pantalla nueva, y ahí es donde se olvidaría: en el navegador y en Android
   * se vería perfecto, y el botón solo aparecería en el iPhone del revisor de
   * Apple. Rechazo por la norma 3.1.1, cuarenta minutos de compilación y una
   * semana de espera después.
   *
   * Con la guarda dentro, el componente es seguro se use donde se use.
   */
  const anual = CAN_LINK_TO_PAYMENT ? subscriptionCheckoutUrl(profile) : null;

  // Sin enlace configurado no se enseña nada: un botón de pagar que no lleva a
  // ninguna parte es peor que no tener botón.
  if (!anual) return null;

  const esEntrenador = profile?.role === 'trainer';

  const abrir = (url: string | null) => {
    if (!url) return;
    void track('checkout_start_anual');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.caja}>
      <Pressable style={[styles.opcion, styles.destacada]} onPress={() => abrir(anual)}>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Un año por delante</Text>
            <Text style={styles.detalle}>
              {esEntrenador
                ? 'Tu grupo sin tope de alumnos y la app entera, doce meses. Se paga una vez.'
                : 'Lo pagas una vez y te olvidas del contador hasta el año que viene.'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </View>
      </Pressable>

      {nota !== null ? (
        <Text style={styles.pie}>
          {nota ?? 'Se abre la web para completarlo. Al volver, tu cuenta se enciende sola.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginTop: spacing.md, gap: spacing.sm },
  opcion: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  // Se distingue por el borde y nada más: el resto de la app es negra y
  // sobria, y un bloque de color aquí se leería como publicidad metida con
  // calzador.
  destacada: { borderColor: colors.primary },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  pie: { ...typography.small, color: colors.textFaint, marginTop: spacing.xs },
});
