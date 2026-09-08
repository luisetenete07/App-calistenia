import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { MarcaDeAgua } from './MarcaDeAgua';
import { VideoPlayer } from './VideoPlayer';
import { avisoDeProteccion } from '../lib/marcaDeAgua';
import { tamanoDelVisor } from '../lib/visorDeVideo';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * Un vídeo a casi toda la pantalla, SIN salir de la app.
 *
 * Es el término medio que hacía falta. Por un lado, el vídeo metido en la
 * columna de contenido se queda pequeño en un ordenador y no sirve para lo
 * único que sirve un vídeo de técnica: mirar de cerca dónde va el codo. Por
 * otro, la pantalla completa de verdad —la del navegador o la del sistema— no
 * se puede usar: ahí el vídeo lo pinta el sistema POR ENCIMA de todo, y con él
 * se van la marca de agua con el nombre de quien mira y el cristal que tapa los
 * controles de YouTube. Se ganaría tamaño y se perdería el blindaje entero.
 *
 * Así que se amplía dentro: el vídeo sigue siendo un elemento nuestro, con su
 * marca de agua encima y sin acceso a los controles de la plataforma, y ocupa
 * casi todo (ver `lib/visorDeVideo` para las medidas).
 *
 * Se usa en los dos sitios donde hay vídeo —la técnica de un ejercicio durante
 * el entreno y las clases de los cursos— porque las protecciones tienen que ser
 * las mismas en los dos. Dos visores distintos serían dos sitios donde se puede
 * colar un botón de compartir.
 */
export function VisorDeVideo({
  url,
  titulo,
  profile,
  visible,
  onCerrar,
  protegido = true,
}: {
  url?: string;
  titulo?: string;
  profile: Pick<UserProfile, 'name' | 'uid'> | null | undefined;
  visible: boolean;
  onCerrar: () => void;
  /**
   * Si el vídeo va BLINDADO (el reproductor de la plataforma tapado con un
   * cristal y con controles nuestros) o con el embed normal.
   *
   * Las CLASES DE UN CURSO van blindadas: son el material que se vende, y ahí
   * el logo, el título y el "Ver en YouTube" son puertas para sacarlo.
   *
   * Los VÍDEOS DE TÉCNICA de un ejercicio, no. Es un enlace público de YouTube
   * que el entrenador ha pegado para que se vea dónde va el codo: no hay nada
   * que proteger, y el blindaje es la parte más frágil de todo esto —depende de
   * que la API de YouTube conteste dentro de una página con origen prestado—.
   * Poner en riesgo el vídeo que más se mira, para proteger un enlace que
   * cualquiera puede buscar, sale carísimo.
   *
   * Lo que NO cambia con esto: la marca de agua sigue encima, el vídeo sigue
   * sin poder navegar fuera de la app y sigue sin pantalla completa.
   */
  protegido?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const tam = tamanoDelVisor(width, height);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        {/*
         * EL FONDO CIERRA AL TOCARLO, Y VA DETRÁS, NO ALREDEDOR.
         *
         * Antes era un `Pressable` que envolvía TODO, con otro por dentro
         * rodeando el vídeo para que tocarlo no cerrara. O sea, que el
         * reproductor colgaba de dos capas que se disputan cada toque. En el
         * ordenador da igual —el `stopPropagation` del navegador corta la
         * cadena—, pero en el móvil ese método ni siquiera existe: quien
         * decide quién se queda el toque es el sistema de responders de React
         * Native, y ahí un WebView metido debajo de dos pulsables es la receta
         * conocida de "el vídeo se ve pero el play no responde".
         *
         * Puesto detrás como una capa suelta, el gesto de cerrar sigue igual y
         * ya no hay nada por encima del reproductor que le pueda quitar el
         * toque.
         */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <View style={styles.barra}>
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo ?? 'Vídeo'}
          </Text>
          <Pressable onPress={onCerrar} hitSlop={12} style={styles.cerrar}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Una View a secas: ahí dentro están los controles del reproductor, y
            no puede haber nada por encima que le robe el toque. */}
        <View style={[styles.marco, { width: tam.width, height: tam.height }]}>
          <MarcaDeAgua profile={profile}>
            <VideoPlayer url={url} protectedContent={protegido} />
          </MarcaDeAgua>
        </View>

        <View style={styles.aviso} pointerEvents="none">
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textFaint} />
          <Text style={styles.avisoTexto}>{avisoDeProteccion(Platform.OS)}</Text>
        </View>
      </View>
    </Modal>
  );
}

/** El enlace que abre el visor. Mismo aspecto en el entreno y en los cursos. */
export function BotonAmpliar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.ampliar} hitSlop={8}>
      <Ionicons name="scan-outline" size={14} color={colors.primary} />
      <Text style={styles.ampliarTexto}>Ver más grande</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    // Negro casi opaco y no del todo: se sigue intuyendo la app detrás, así
    // que se entiende que esto es una ventana y no otra pantalla.
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 1400,
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  cerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  marco: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 520 },
  avisoTexto: { ...typography.small, color: colors.textFaint, fontSize: 11, flex: 1 },
  ampliar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  ampliarTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
