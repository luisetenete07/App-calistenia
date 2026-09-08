import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { DragList } from './DragList';
import { showToast } from './Toast';
import { getRutinaDiaria, setRutinaDiaria } from '../lib/firestore/rutinaDiaria';
import { nuevoId } from '../lib/ids';
import {
  moverEjercicio,
  NOMBRE_POR_DEFECTO,
  seriesDeTexto,
  textoDelEjercicio,
} from '../lib/rutinaDiaria';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { EjercicioDiario } from '../lib/types';

/**
 * Lo que este alumno hace TODOS los días, aparte de su plan.
 *
 * QUÉ ES
 *
 * El pino, la movilidad de cadera, los estiramientos. Cosas cortas que no son
 * "el entreno del martes" sino algo que se repite a diario y que, justo por
 * repetirse, es lo que más cambia a alguien en seis meses.
 *
 * POR QUÉ NO ES EL EDITOR DE RUTINAS OTRA VEZ
 *
 * Cada ejercicio lleva tres cosas y ninguna es obligatoria: un objetivo en
 * TEXTO LIBRE, las series si se quieren contar, y el vídeo de la técnica. Nada
 * de repeticiones, descansos, RIR ni progresión: poner "movilidad de cadera, un
 * par de minutos" en esos campos obliga a inventarse números que nadie va a
 * cumplir ni mirar.
 *
 * El objetivo es texto libre justo por eso: cabe un aguante, unos minutos o
 * "hasta que deje de tirar", que es como se explican de verdad estas cosas.
 *
 * LAS SERIES, CUANDO SE QUIEREN CONTAR
 *
 * En el grease the groove las series no van seguidas: se reparten por el día.
 * Con un número aquí, el alumno las marca de una en una y sabe cuántas le
 * quedan. Sin número, el ejercicio se marca entero de un toque — y eso es lo
 * correcto para dos minutos de movilidad, que no se cuentan por series.
 *
 * Y EL ORDEN SE ARRASTRA
 *
 * Porque no es decorativo: quien pone las muñecas antes del pino lo hace para
 * llegar al pino con las muñecas calientes.
 *
 * SE APAGA SIN PERDER NADA
 *
 * El interruptor deja de enseñársela al alumno pero no borra los ejercicios:
 * una rutina diaria se quita en una semana de mucha carga y se vuelve a poner
 * después, y volver a escribirla entera cada vez es lo que hace que no se
 * vuelva a poner.
 */
export function RutinaDiariaEditor({
  trainerId,
  clientId,
  /** Cómo se llama a esta persona en los textos. */
  paraMi = false,
}: {
  trainerId: string;
  clientId: string;
  paraMi?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ejercicios, setEjercicios] = useState<EjercicioDiario[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [nuevasSeries, setNuevasSeries] = useState('');
  /** Cuál se está editando. Solo uno a la vez: la tarjeta es pequeña. */
  const [editando, setEditando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getRutinaDiaria(clientId)
      .then((r) => {
        if (!vivo) return;
        if (r) {
          setActiva(r.activa);
          setNombre(r.nombre ?? '');
          setEjercicios(r.ejercicios ?? []);
          // Si ya tiene una puesta, se abre: es lo que se viene a mirar.
          setAbierto(r.activa && r.ejercicios.length > 0);
        }
        setCargando(false);
      })
      .catch(() => setCargando(false));
    return () => {
      vivo = false;
    };
  }, [clientId]);

  /**
   * Guarda entero, siempre.
   *
   * Se guarda en cada cambio y no con un botón de "Guardar": esto es una lista
   * de cuatro cosas, y un botón aparte solo sirve para que un día se salga de
   * la pantalla sin pulsarlo y se pierda lo escrito.
   */
  const guardar = async (
    cambios: Partial<{ activa: boolean; nombre: string; ejercicios: EjercicioDiario[] }>
  ) => {
    const siguiente = {
      activa: cambios.activa ?? activa,
      nombre: cambios.nombre ?? nombre,
      ejercicios: cambios.ejercicios ?? ejercicios,
    };
    try {
      await setRutinaDiaria({
        trainerId,
        clientId,
        activa: siguiente.activa,
        nombre: siguiente.nombre.trim() || NOMBRE_POR_DEFECTO,
        ejercicios: siguiente.ejercicios,
      });
    } catch {
      showToast('No se ha podido guardar');
    }
  };

  const anadir = () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    const series = seriesDeTexto(nuevasSeries);
    const lista = [
      ...ejercicios,
      // `series` solo si de verdad hay un número: sin poner y "una serie" son
      // cosas distintas, y guardar un campo vacío ensucia el documento.
      { id: nuevoId(), nombre: n, objetivo: nuevoObjetivo.trim(), ...(series ? { series } : {}) },
    ];
    setEjercicios(lista);
    setNuevoNombre('');
    setNuevoObjetivo('');
    setNuevasSeries('');
    // El primero que se añade la enciende: nadie escribe una lista para dejarla
    // apagada, y obligar a buscar el interruptor después es un paso de más.
    const encender = !activa && lista.length === 1;
    if (encender) setActiva(true);
    void guardar({ ejercicios: lista, activa: encender ? true : activa });
  };

  const quitar = (id: string) => {
    const lista = ejercicios.filter((e) => e.id !== id);
    setEjercicios(lista);
    if (editando === id) setEditando(null);
    void guardar({ ejercicios: lista });
  };

  /**
   * Cambia UN campo de UN ejercicio. Solo en pantalla, sin guardar.
   *
   * Se guarda al salir del campo, con `guardarLista`. Guardar en cada letra
   * sería una escritura por pulsación; y guardar en `onEndEditing`, como estaba,
   * se perdía el vídeo entero: al tocar la cabecera para salir del campo, el
   * campo se desmonta y ese aviso no llega a saltar nunca.
   */
  const cambiar = (id: string, campos: Partial<EjercicioDiario>) => {
    setEjercicios((prev) => prev.map((e) => (e.id === id ? { ...e, ...campos } : e)));
  };

  /** Guarda lo que haya ahora en pantalla. Se llama al salir de un campo. */
  const guardarLista = () => {
    setEjercicios((prev) => {
      void guardar({ ejercicios: prev });
      return prev;
    });
  };

  const reordenar = (desde: number, hasta: number) => {
    const lista = moverEjercicio(ejercicios, desde, hasta);
    if (lista === ejercicios) return;
    setEjercicios(lista);
    void guardar({ ejercicios: lista });
  };

  const alternar = () => {
    const v = !activa;
    setActiva(v);
    void guardar({ activa: v });
  };

  if (cargando) return null;

  const resumen = !activa
    ? 'apagada'
    : ejercicios.length === 0
      ? 'sin ejercicios'
      : `${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}`;

  return (
    <Card style={styles.tarjeta}>
      <Pressable style={styles.cabecera} onPress={() => setAbierto((v) => !v)} hitSlop={6}>
        <Ionicons name="repeat-outline" size={16} color={colors.primary} />
        {/* La pista DEBAJO del título, igual que en el resto de paneles
            plegables: al lado no caben los dos en un móvil estrecho y "Rutina
            diaria" se partía en "Rutina / diaria". */}
        <View style={styles.cabeceraTextos}>
          <Text style={styles.titulo}>Rutina diaria</Text>
          <Text style={styles.pista}>{resumen}</Text>
        </View>
        <Ionicons
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textFaint}
        />
      </Pressable>

      {abierto ? (
        <>
          <Text style={styles.explica}>
            {paraMi
              ? 'Lo que harás todos los días aparte de tu plan: pino, movilidad, lo que se repite. Corto y a diario.'
              : 'Lo que hará todos los días aparte de su plan: pino, movilidad, lo que se repite. Corto y a diario.'}
          </Text>

          <Pressable style={styles.interruptor} onPress={alternar} hitSlop={6}>
            <View style={[styles.casilla, activa && styles.casillaOn]}>
              {activa ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <Text style={styles.interruptorTexto}>
              {activa
                ? paraMi
                  ? 'Activa: la ves en tu Entreno'
                  : 'Activa: la ve en su Entreno'
                : 'Apagada. Los ejercicios se guardan igual.'}
            </Text>
          </Pressable>

          <TextInput
            style={styles.campoNombre}
            value={nombre}
            onChangeText={setNombre}
            onBlur={() => guardar({ nombre })}
            placeholder={NOMBRE_POR_DEFECTO}
            placeholderTextColor={colors.textFaint}
          />

          {/* El arrastre sale SOLO del asa (`handleOnly`): la fila lleva campos
              de texto dentro, y sin eso colocar el cursor en uno la movería. */}
          <DragList
            items={ejercicios}
            keyOf={(e) => e.id}
            onReorder={reordenar}
            handleOnly
            gap={0}
            style={styles.lista}
            renderItem={(e, _i, arrastrando, asa) => (
              <View style={[styles.fila, arrastrando && styles.filaArrastrando]}>
                <View style={styles.filaCabecera}>
                  {/* Con nombre: para quien usa lector de pantalla, un icono
                      sin etiqueta es un elemento mudo en medio de la fila. */}
                  <View
                    {...asa}
                    style={styles.asa}
                    accessibilityLabel="Mover de sitio"
                    accessibilityRole="adjustable"
                  >
                    <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                  </View>
                  <Pressable
                    style={styles.filaTextos}
                    onPress={() => {
                      if (editando === e.id) guardarLista();
                      setEditando((v) => (v === e.id ? null : e.id));
                    }}
                    hitSlop={4}
                  >
                    <Text style={styles.filaNombre}>{e.nombre}</Text>
                    {textoDelEjercicio(e) ? (
                      <Text style={styles.filaObjetivo}>{textoDelEjercicio(e)}</Text>
                    ) : null}
                  </Pressable>
                  {/* Que se vea desde fuera si tiene vídeo: entrar a cada uno a
                      comprobarlo es lo que hace que no se rellene nunca. */}
                  {e.video?.trim() ? (
                    <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
                  ) : null}
                  <Pressable
                    onPress={() => {
                      // Cerrar también guarda: es la otra forma de salir de los
                      // campos, y perder lo escrito por cerrar sería lo peor.
                      if (editando === e.id) guardarLista();
                      setEditando((v) => (v === e.id ? null : e.id));
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={editando === e.id ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textFaint}
                    />
                  </Pressable>
                  <Pressable onPress={() => quitar(e.id)} hitSlop={10}>
                    <Ionicons name="close" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>

                {editando === e.id ? (
                  <View style={styles.edicion}>
                    <TextInput
                      style={styles.campoEjercicio}
                      defaultValue={e.objetivo}
                      onChangeText={(t) => cambiar(e.id, { objetivo: t })}
                      onBlur={guardarLista}
                      placeholder="Objetivo (p. ej. 30 s por lado)"
                      placeholderTextColor={colors.textFaint}
                    />
                    <View style={styles.edicionFila}>
                      <TextInput
                        style={[styles.campoEjercicio, styles.campoSeries]}
                        defaultValue={e.series ? String(e.series) : ''}
                        onChangeText={(t) => cambiar(e.id, { series: seriesDeTexto(t) })}
                        onBlur={guardarLista}
                        placeholder="Series"
                        placeholderTextColor={colors.textFaint}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.pistaSeries}>
                        Con series, se marcan de una en una a lo largo del día.
                      </Text>
                    </View>
                    <TextInput
                      style={styles.campoEjercicio}
                      defaultValue={e.video ?? ''}
                      onChangeText={(t) => cambiar(e.id, { video: t.trim() || undefined })}
                      onBlur={guardarLista}
                      placeholder="Enlace del vídeo (YouTube o Vimeo)"
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                ) : null}
              </View>
            )}
          />

          <View style={styles.anadir}>
            <TextInput
              style={styles.campoEjercicio}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              /*
               * Corto a propósito: "Ejercicio (p. ej. Pino contra pared)" no
               * cabía en un móvil de 320 px y se leía a medias, sin cerrar el
               * paréntesis. La palabra "Ejercicio" sobra: el campo está debajo
               * de la lista de ejercicios y encima del botón de añadir.
               */
              placeholder="Ej. Pino contra pared"
              placeholderTextColor={colors.textFaint}
              returnKeyType="next"
            />
            <View style={styles.filaObjetivoNuevo}>
              <TextInput
                style={[styles.campoEjercicio, styles.campoObjetivoNuevo]}
                value={nuevoObjetivo}
                onChangeText={setNuevoObjetivo}
                placeholder="Objetivo (p. ej. 30 s)"
                placeholderTextColor={colors.textFaint}
                onSubmitEditing={anadir}
                returnKeyType="done"
              />
              <TextInput
                style={[styles.campoEjercicio, styles.campoSeries]}
                value={nuevasSeries}
                onChangeText={setNuevasSeries}
                placeholder="Series"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
              />
              <Pressable
                onPress={anadir}
                style={[styles.botonAnadir, !nuevoNombre.trim() && styles.botonApagado]}
                disabled={!nuevoNombre.trim()}
              >
                <Text style={styles.botonAnadirTexto}>Añadir</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cabeceraTextos: { flex: 1, minWidth: 0 },
  titulo: { ...typography.h3, color: colors.text },
  pista: { ...typography.small, color: colors.textFaint, fontSize: 12, marginTop: 1 },
  explica: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  interruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  interruptorTexto: { ...typography.small, color: colors.text, flex: 1 },
  campoNombre: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  lista: { marginTop: spacing.sm },
  fila: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Mientras se arrastra, la fila se despega del fondo para que se vea cuál va
  // en el dedo y dónde va a caer.
  filaArrastrando: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El asa se coge con el dedo: pequeña no se acierta, y fallar al arrastrar
  // acaba moviendo la pantalla en vez del ejercicio.
  asa: { paddingVertical: 4, paddingRight: 2 },
  filaTextos: { flex: 1, minWidth: 0 },
  filaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  filaObjetivo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  edicion: { gap: spacing.sm, marginTop: spacing.sm, paddingLeft: 26 },
  edicionFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  campoSeries: { width: 84, flexGrow: 0, flexShrink: 0 },
  pistaSeries: { ...typography.small, color: colors.textFaint, flex: 1, minWidth: 140 },
  anadir: { marginTop: spacing.md, gap: spacing.sm },
  campoEjercicio: {
    ...typography.small,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
  },
  filaObjetivoNuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Tres cosas en una fila no caben en un móvil estrecho: que bajen en vez de
    // encogerse hasta que el objetivo se quede en dos letras.
    flexWrap: 'wrap',
  },
  campoObjetivoNuevo: { flexGrow: 1, flexShrink: 1, minWidth: 130 },
  botonAnadir: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  botonApagado: { opacity: 0.4 },
  botonAnadirTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
