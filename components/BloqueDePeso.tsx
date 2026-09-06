import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { TextField } from './TextField';
import { WeightChart } from './WeightChart';
import { showToast } from './Toast';
import { confirmar } from '../lib/confirmar';
import { fechaNumerica } from '../lib/fechas';
import { createWeightLog, deleteWeightLog } from '../lib/firestore/weightLogs';
import { conSigno, kgCorto, pesoDeTexto, resumenDePeso, textoDelObjetivo } from '../lib/peso';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { UserProfile, WeightLog } from '../lib/types';

/**
 * El peso: cuánto pesa, cómo va, cómo ha ido y apuntar el de hoy. TODO en una
 * tarjeta.
 *
 * Eran tres: "Mi peso" con la cifra y el formulario, "Evolución" con la
 * gráfica, e "Historial" con la lista de registros. Tres tarjetas para una
 * cifra, y las tres decían lo mismo con distinta forma: el número de hoy, el
 * número de hoy dibujado y el número de hoy en una fila. La lista, además, era
 * la más larga y la que menos aportaba —quien se pesa a diario tiene ahí
 * trescientas filas que no va a leer nunca—, así que se ha ido entera.
 *
 * Lo único que hacía falta de la lista era poder deshacer un peso mal escrito:
 * un 667 en vez de 67 estropea la gráfica para siempre. Eso se queda, pero
 * como una línea bajo la cifra, no como una sección.
 */
export function BloqueDePeso({
  profile,
  logs,
  onCambio,
  /** En Progreso el título sobra: ya lo dice la pestaña. */
  conTitulo = true,
}: {
  profile: UserProfile | null | undefined;
  logs: WeightLog[];
  /** Se llama tras guardar o borrar, para que el padre recargue lo suyo. */
  onCambio: () => void | Promise<void>;
  conTitulo?: boolean;
}) {
  const [peso, setPeso] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resumen = resumenDePeso(logs, profile?.targetWeightKg);
  const delObjetivo = textoDelObjetivo(resumen, profile?.targetWeightKg);

  const guardar = async () => {
    if (!profile) return;
    const kg = pesoDeTexto(peso);
    if (kg === undefined) {
      setError('Escribe tu peso en kg (por ejemplo, 66,4).');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await createWeightLog({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        weightKg: kg,
        notes: notas.trim() || undefined,
      });
      setPeso('');
      setNotas('');
      await onCambio();
      showToast('Peso guardado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id: string) => {
    if (!(await confirmar('¿Borrar este registro de peso?'))) return;
    try {
      await deleteWeightLog(id);
      await onCambio();
      showToast('Registro borrado');
    } catch {
      showToast('No se pudo borrar');
    }
  };

  // El último apuntado, que es el único que se puede deshacer. Deshacer el de
  // hace tres semanas no lo pide nadie; deshacer el que acabas de escribir mal,
  // todo el mundo.
  const ultimo = [...logs].sort((a, b) => b.date - a.date)[0];

  return (
    <>
      <Card style={styles.tarjeta}>
        {conTitulo ? <Text style={styles.titulo}>Mi peso</Text> : null}

        {resumen.actual === undefined ? (
          <EmptyState
            icon="scale-outline"
            title="Todavía no has apuntado tu peso"
            subtitle="Pésate a la misma hora, mejor en ayunas. Lo que importa no es el número de hoy: es hacia dónde va."
          />
        ) : (
          <>
            <View style={styles.cifraFila}>
              <Text style={styles.cifra}>{kgCorto(resumen.actual)}</Text>
              <Text style={styles.unidad}>kg</Text>
            </View>
            <View style={styles.cambios}>
              <Cambio etiqueta="Esta semana" kg={resumen.semana} />
              <Cambio etiqueta="Este mes" kg={resumen.mes} />
            </View>
            {delObjetivo ? (
              <View style={styles.objetivo}>
                <Ionicons
                  name={resumen.enObjetivo ? 'checkmark-circle' : 'flag-outline'}
                  size={15}
                  color={resumen.enObjetivo ? colors.success : colors.primaryBright}
                />
                <Text style={styles.objetivoTexto}>{delObjetivo}</Text>
              </View>
            ) : null}

            {/* La gráfica, aquí mismo y no en una tarjeta aparte: la cifra sin
                la línea no dice nada, y la línea sin la cifra tampoco. */}
            {logs.length > 1 ? (
              <View style={styles.grafica}>
                <WeightChart logs={logs} />
              </View>
            ) : null}
          </>
        )}

        <View style={styles.apuntar}>
          <TextField
            /*
             * Corto a propósito. "Peso en kg (ej. 66,4)" no cabía en el hueco
             * que deja el botón de al lado y se leía "Peso en kg (ej. 66,4",
             * sin cerrar. Y sobraba: la tarjeta se llama "Mi peso" y el botón
             * dice "Apuntar", así que lo único que falta por decir es la unidad
             * y que se puede usar coma. Mismo formato que el de los pasos.
             */
            placeholder="Ej. 66,4 kg"
            keyboardType="decimal-pad"
            value={peso}
            onChangeText={setPeso}
            containerStyle={{ flex: 1 }}
            style={{ marginBottom: 0 }}
          />
          <Button title="Apuntar" onPress={guardar} loading={guardando} style={styles.boton} />
        </View>
        <TextField
          placeholder="Notas (opcional)"
          value={notas}
          onChangeText={setNotas}
          style={{ marginBottom: 0 }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* La red de seguridad de escribir un número mal. */}
        {ultimo ? (
          <Pressable onPress={() => borrar(ultimo.id)} style={styles.deshacer} hitSlop={8}>
            <Ionicons name="arrow-undo-outline" size={13} color={colors.textFaint} />
            <Text style={styles.deshacerTexto}>
              Borrar el último ({kgCorto(ultimo.weightKg)} kg, {fechaNumerica(ultimo.date)})
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </>
  );
}

/**
 * Un cambio de peso. Sin dato no se pinta un cero: quien lleva dos días
 * apuntándose no ha ganado ni perdido nada este mes, es que no hay mes.
 */
function Cambio({ etiqueta, kg }: { etiqueta: string; kg?: number }) {
  return (
    <View style={styles.cambio}>
      <Text style={styles.cambioEtiqueta}>{etiqueta}</Text>
      <Text style={styles.cambioValor}>{kg === undefined ? '—' : conSigno(kg)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  grafica: { marginTop: spacing.lg },
  cifraFila: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cifra: { ...typography.h1, color: colors.text, fontSize: 40, ...tabularNums },
  unidad: { ...typography.body, color: colors.textMuted },
  cambios: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  cambio: { gap: 2 },
  cambioEtiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
  },
  cambioValor: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  objetivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  objetivoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 18 },
  apuntar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  boton: { minWidth: 104 },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
  deshacer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingTop: spacing.md,
  },
  deshacerTexto: { ...typography.small, color: colors.textFaint, fontSize: 11 },
});
