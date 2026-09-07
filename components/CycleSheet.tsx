import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { DateField, startOfToday } from './DateField';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { createCycle, updateCycle } from '../lib/firestore/cycles';
import { getActiveRoutineForClient } from '../lib/firestore/routines';
import { getWorkoutLogsForClient } from '../lib/firestore/workoutLogs';
import { ObjetivosDeCiclo } from './ObjetivosDeCiclo';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { fechaLegible, masDias } from '../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import {
  CYCLE_DEFAULT_WEEKS,
  CYCLE_LEVEL_LABEL,
  type CycleLevel,
  type ObjetivoDeCiclo,
  type TrainingCycle,
  type WorkoutLog,
} from '../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVELS: CycleLevel[] = ['macro', 'meso', 'micro'];

interface Props {
  visible: boolean;
  trainerId: string;
  clientId: string;
  /** Ciclo existente para editar; sin valor = crear uno nuevo. */
  cycle?: TrainingCycle | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Hoja para crear o editar un ciclo. Simple a propósito: nivel + nombre y, si
 * se quiere, duración en semanas y fecha de inicio. Todo lo demás es opcional.
 */
export function CycleSheet({ visible, trainerId, clientId, cycle, onClose, onSaved }: Props) {
  const editing = !!cycle;
  const [level, setLevel] = useState<CycleLevel>('meso');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<number>(startOfToday());
  const [weeks, setWeeks] = useState<number>(CYCLE_DEFAULT_WEEKS.meso);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [isDeload, setIsDeload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [objetivos, setObjetivos] = useState<ObjetivoDeCiclo[]>([]);
  /*
   * El plan y el historial, para los objetivos: de uno salen los ejercicios que
   * se pueden elegir, del otro cuánto lleva hecho. Se piden al abrir la hoja y
   * no antes: es una pantalla que se abre de vez en cuando, y cargarlos con la
   * pantalla de al lado sería pedirlos siempre para nada.
   */
  const [ejerciciosDelPlan, setEjerciciosDelPlan] = useState<{ id: string; name: string }[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  // Rellena el formulario al abrir (con los valores del ciclo si se edita).
  useEffect(() => {
    if (!visible) return;
    if (cycle) {
      setLevel(cycle.level);
      setName(cycle.name);
      setStartDate(cycle.startDate ?? startOfToday());
      setOpen(!cycle.endDate);
      if (cycle.startDate && cycle.endDate) {
        setWeeks(Math.max(1, Math.round((cycle.endDate - cycle.startDate) / DAY_MS / 7)));
      } else {
        setWeeks(CYCLE_DEFAULT_WEEKS[cycle.level]);
      }
      setTarget(cycle.targetSessions ? String(cycle.targetSessions) : '');
      setGoal(cycle.goal ?? '');
      setObjetivos(cycle.objetivos ?? []);
      setNotes(cycle.notes ?? '');
      setIsDeload(!!cycle.isDeload);
    } else {
      setLevel('meso');
      setName('');
      setStartDate(startOfToday());
      setWeeks(CYCLE_DEFAULT_WEEKS.meso);
      setOpen(false);
      setTarget('');
      setGoal('');
      setObjetivos([]);
      setNotes('');
      setIsDeload(false);
    }
  }, [visible, cycle]);

  /*
   * El plan y el historial del alumno, para los objetivos.
   *
   * Del plan salen los ejercicios que se pueden elegir —no la biblioteca
   * entera: un objetivo sobre algo que no se entrena no se cumple nunca— y del
   * historial, cuánto lleva hecho.
   */
  useEffect(() => {
    if (!visible || !clientId) return;
    let vivo = true;
    Promise.all([
      getActiveRoutineForClient(clientId).catch(() => null),
      getWorkoutLogsForClient(clientId).catch(() => []),
    ])
      .then(([rutina, historial]) => {
        if (!vivo) return;
        const vistos = new Map<string, string>();
        for (const dia of rutina?.days ?? []) {
          for (const e of dia.exercises ?? []) {
            if (e.exerciseId && !vistos.has(e.exerciseId)) vistos.set(e.exerciseId, e.name);
          }
        }
        setEjerciciosDelPlan([...vistos].map(([id, name]) => ({ id, name })));
        setLogs(historial ?? []);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [visible, clientId]);

  const pickLevel = (l: CycleLevel) => {
    setLevel(l);
    if (!editing) setWeeks(CYCLE_DEFAULT_WEEKS[l]);
    if (l !== 'micro') setIsDeload(false);
  };

  /*
   * Con `masDias` y no sumando milisegundos: el domingo que cambia la hora dura
   * 23 o 25, y un bloque que lo cruce acababa a las 23:00 del día anterior. En
   * pantalla se leía un día menos del que el entrenador había puesto.
   */
  const endDate = open ? undefined : masDias(startDate, weeks * 7 - 1);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Ponle un nombre al ciclo');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        level,
        name: name.trim(),
        startDate,
        endDate,
        targetSessions: target.trim() ? Number(target) || undefined : undefined,
        goal: goal.trim() || undefined,
        objetivos: objetivos.length > 0 ? objetivos : undefined,
        notes: notes.trim() || undefined,
        isDeload: level === 'micro' && isDeload ? true : undefined,
      };
      if (cycle) {
        await updateCycle(cycle.id, payload);
        showToast('Ciclo actualizado');
      } else {
        await createCycle({ trainerId, clientId, ...payload });
        showToast('Ciclo creado');
      }
      onSaved();
      onClose();
    } catch {
      showToast('No se pudo guardar el ciclo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} titulo={editing ? 'Editar ciclo' : 'Nuevo ciclo'}>
      <Text style={styles.label}>Nivel</Text>
      <Segmented
        opciones={LEVELS.map((l) => ({ valor: l, texto: CYCLE_LEVEL_LABEL[l] }))}
        valor={level}
        onChange={pickLevel}
      />

      <TextField
        label="Nombre"
        placeholder="Ej. Hipertrofia"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Empieza</Text>
      <DateField value={startDate} onChange={setStartDate} />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>Sin fecha de fin (abierto)</Text>
        <Switch
          value={open}
          onValueChange={setOpen}
          trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
          thumbColor={colors.white}
        />
      </View>

      {!open ? (
        <>
          <Text style={styles.label}>Duración</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setWeeks((w) => Math.max(1, w - 1))}
              style={styles.stepBtn}
              hitSlop={6}
            >
              <Ionicons name="remove" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.dateText}>
              {weeks} semana{weeks === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() => setWeeks((w) => Math.min(52, w + 1))}
              style={styles.stepBtn}
              hitSlop={6}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
            </Pressable>
            <Text style={styles.endHint}>hasta {endDate ? fechaLegible(endDate) : '—'}</Text>
          </View>
        </>
      ) : null}

      {level === 'micro' ? (
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Semana de descarga (deload)</Text>
          <Switch
            value={isDeload}
            onValueChange={setIsDeload}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.optHint}>Opcional</Text>

      <TextField
        label="Meta de sesiones"
        placeholder="Ej. 16"
        keyboardType="numeric"
        value={target}
        onChangeText={setTarget}
      />
      <TextField
        label="Objetivo del ciclo"
        placeholder="Ej. Dominadas lastradas +25 kg × 5"
        value={goal}
        onChangeText={setGoal}
      />
      {/* Los objetivos medibles del ciclo. Justo debajo del objetivo en texto,
          porque son la misma idea: uno es la frase y estos son los números. */}
      <View style={styles.objetivos}>
        <ObjetivosDeCiclo
          objetivos={objetivos}
          logs={logs}
          onCambiar={setObjetivos}
          ejerciciosDelPlan={ejerciciosDelPlan}
        />
      </View>

      <TextField
        label="Notas del coach"
        placeholder="Notas privadas…"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={editing ? 'Guardar' : 'Crear ciclo'}
          onPress={handleSave}
          loading={saving}
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Separados con una raya: son otra cosa que el formulario de arriba, y
  // pegados parecerían un campo más del ciclo.
  objetivos: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, minWidth: 120, textAlign: 'center' },
  endHint: { ...typography.small, color: colors.textFaint, flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  optHint: {
    ...typography.label,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
