import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import * as Haptics from 'expo-haptics';
import {
  opcionesDeEsfuerzo,
  preguntaDeEsfuerzo,
  type EsfuerzoDelPlan,
} from '../lib/planPersonalizado';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Cómo de cerca del fallo se ha quedado, en la escala que use este plan.
 *
 * ES EL MISMO SELECTOR DE SIEMPRE, CON OTRAS ETIQUETAS. Antes solo sabía de
 * RIR —cinco fichas de 0 a 4+— y esa era la única forma de preguntar que
 * existía en la app. Ahora las fichas salen de la escala del plan: las mismas
 * cinco si se mide en RIR, porcentajes si se mide así, o las etiquetas que haya
 * escrito el entrenador si trabaja con las suyas.
 *
 * Lo que NO cambia, porque es lo que hace que la gente conteste:
 *
 *  - Una sola pregunta, de un toque, y por ejercicio (o una al terminar, si el
 *    entrenador lo ha puesto así). Preguntar por serie es más exacto y se paga
 *    en abandono.
 *  - Se puede desmarcar volviendo a pulsar. Un dato que no se puede quitar
 *    cuando te has equivocado es un dato que la gente deja de meter.
 */
export function SelectorDeEsfuerzo({
  esfuerzo,
  value,
  onChange,
  etiqueta,
}: {
  /** La escala de este plan. Sin ella, RIR, que es lo de siempre. */
  esfuerzo?: EsfuerzoDelPlan;
  /** La etiqueta elegida ('Fallo', '80 %', 'B'…), no un número. */
  value?: string;
  onChange: (v: string) => void;
  /** Sustituye a la pregunta por defecto (el resumen final la cambia). */
  etiqueta?: string;
}) {
  const opciones = opcionesDeEsfuerzo(esfuerzo);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{etiqueta ?? preguntaDeEsfuerzo(esfuerzo)}</Text>
      <View style={styles.row}>
        {opciones.map((op) => {
          const activo = value === op;
          // La primera de la escala de RIR es "al fallo": se marca distinta
          // porque no es un grado más, es el extremo.
          const esFallo = (esfuerzo?.escala ?? 'rir') === 'rir' && op === 'Fallo';
          return (
            <Pressable
              key={op}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.selectionAsync().catch(() => {});
                }
                onChange(op);
              }}
              style={[styles.chip, activo && styles.chipActive, esFallo && styles.chipFail]}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={op}
            >
              <Text
                style={[styles.chipText, activo && styles.chipTextActive]}
                numberOfLines={1}
              >
                {op}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, gap: spacing.xs },
  label: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipFail: { borderColor: colors.hairlineFaint },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  chipTextActive: { color: colors.primaryBright },
});
