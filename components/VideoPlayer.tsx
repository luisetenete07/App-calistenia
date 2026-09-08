import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  parseVimeoUrl,
  parseYouTubeId,
  seQuedaDentro,
  seQuedaDentroDelBlindaje,
  vimeoEmbedUrl,
  youTubeEmbedUrl,
} from '../lib/video';
import { fuenteBlindada, paginaDelReproductor } from '../lib/reproductorBlindado';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * Reproductor de vídeo de lecciones. Protecciones aplicadas:
 * - Solo se carga si el alumno tiene sesión y acceso (garantizado por las
 *   reglas de Firestore antes de llegar aquí).
 * - Contenido de curso en YouTube o Vimeo: va BLINDADO (ver
 *   `lib/reproductorBlindado`). El reproductor de la plataforma se carga sin
 *   controles y tapado con un cristal que se come todos los toques, y los
 *   controles los ponemos nosotros. Así no queda a la vista ni un logo, ni el
 *   título, ni "Ver en YouTube", ni compartir, ni el menú del clic derecho.
 * - En web: sin botón de descarga (controlsList=nodownload), sin
 *   Picture-in-Picture y sin menú contextual (clic derecho).
 * - En nativo: los controles del sistema no incluyen opción de descarga.
 * Nota: ningún reproductor web puede impedir al 100% la grabación de
 * pantalla; esto disuade la descarga y el reparto de enlaces.
 */
export function VideoPlayer({
  url,
  protectedContent = false,
}: {
  url?: string;
  /** Cursos: refuerza las protecciones (sin PiP, sin menú contextual). */
  protectedContent?: boolean;
}) {
  if (!url) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="videocam-outline" size={28} color={colors.textFaint} />
        <Text style={styles.placeholderText}>Vídeo no disponible</Text>
      </View>
    );
  }

  /*
   * EL BLINDAJE, SOLO EN EL ORDENADOR. Y no es una preferencia: es lo que
   * quedó después de tres intentos.
   *
   * El reproductor blindado necesita montar una página NUESTRA con un origen
   * PRESTADO (`baseUrl: youtube.com`) y que la API de YouTube conteste dentro.
   * En un iframe del navegador eso funciona y se ve todos los días. Dentro de
   * un WebView no ha funcionado ni una vez: tres versiones seguidas con el
   * vídeo en negro en iPhone y en Android, tres arreglos razonados —la lista
   * de rutas permitidas, el parámetro `origin`, el paracaídas que avisa— y las
   * tres veces seguía negro.
   *
   * Llegados aquí, la decisión no es cuál es la causa, es cuánto vale
   * seguir buscándola. El blindaje esconde el logo y el botón de compartir de
   * YouTube. El vídeo ES el producto: un curso que no se puede ver no es un
   * curso. Se cambia una protección cosmética por la función principal.
   *
   * En el móvil se carga el embed a pelo, que es una navegación normal a una
   * dirección de verdad: lo más difícil de romper que hay. Lo que SÍ se
   * mantiene: la marca de agua con el nombre de quien mira, no poder navegar
   * fuera de la app y no tener pantalla completa.
   */
  const blindado =
    protectedContent && Platform.OS === 'web'
      ? fuenteBlindada(url, origenDelReproductor())
      : null;
  if (blindado) return <VideoBlindado fuente={blindado} />;

  // Enlaces de Vimeo: se reproducen con el player oficial embebido, que
  // respeta la privacidad "solo donde esté incrustado" configurada en Vimeo.
  const vimeo = parseVimeoUrl(url);
  if (vimeo) {
    return <VimeoVideo embedUrl={vimeoEmbedUrl(vimeo)} protectedContent={protectedContent} />;
  }

  const youtubeId = parseYouTubeId(url);
  if (youtubeId) {
    return (
      <VimeoVideo embedUrl={youTubeEmbedUrl(youtubeId)} protectedContent={protectedContent} />
    );
  }

  // Archivo de vídeo directo (mp4, HLS...): reproductor propio.
  const looksLikeFile = /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i.test(url);
  if (looksLikeFile) {
    return Platform.OS === 'web' ? <WebVideo url={url} /> : <NativeVideo url={url} />;
  }

  // Cualquier otro enlace (Drive, Dropbox, etc.): se muestra embebido DENTRO
  // de la app (iframe/WebView) para que el usuario nunca salga de UDECA.
  return <VimeoVideo embedUrl={url} protectedContent={protectedContent} />;
}

/**
 * El origen desde el que se va a hablar con el reproductor de la plataforma.
 *
 * En el ordenador la página del blindaje va en un iframe `srcdoc`, que hereda
 * el origen de la app. En el móvil va en un WebView cargado con un origen
 * prestado, el mismo que se le pasa como `baseUrl`.
 *
 * YouTube lo necesita declarado para dejar hablar a la API del iframe. Sin él
 * el reproductor puede no llegar a arrancar, y lo que se ve entonces no es un
 * error: es un rectángulo negro.
 */
const BASE_NATIVA = 'https://www.youtube.com';

function origenDelReproductor(): string {
  if (Platform.OS !== 'web') return BASE_NATIVA;
  try {
    return window.location.origin;
  } catch {
    return BASE_NATIVA;
  }
}

/**
 * El reproductor de curso: el de la plataforma, tapado.
 *
 * La página la monta `lib/reproductorBlindado` y es LA MISMA en el móvil y en
 * el ordenador; lo único que cambia es dónde se mete: en un WebView o en un
 * iframe con `srcdoc`. Escribir dos páginas distintas sería tener dos sitios
 * donde se puede colar un botón de compartir.
 *
 * El `baseUrl` no es cosmético: la API de YouTube habla con su reproductor por
 * postMessage y necesita un origen de verdad. Cargando la página sin él, el
 * origen es "null", la API no contesta nunca y el blindaje se cae solo.
 *
 * EN EL MÓVIL, EL BLINDAJE PUEDE RENDIRSE, Y TIENE QUE PODER
 *
 * La página avisa por `postMessage` cuando se ha desblindado, y el WebView
 * avisa si no ha podido ni cargar. Cuando pasa cualquiera de las dos cosas se
 * cambia de mecanismo: se deja de montar una página nuestra con un origen
 * prestado y se carga el embed a pelo, que es una navegación normal a una
 * dirección de verdad y es lo más difícil de romper que hay.
 *
 * Antes esto no existía: la página gritaba "me he desblindado" y no había
 * nadie escuchando al otro lado, así que un fallo del blindaje era un vídeo
 * negro para siempre.
 */
function VideoBlindado({ fuente }: { fuente: NonNullable<ReturnType<typeof fuenteBlindada>> }) {
  const html = React.useMemo(() => paginaDelReproductor(fuente), [fuente.src]);
  const [seRindio, setSeRindio] = React.useState(false);
  const base = fuente.dialecto === 'youtube' ? BASE_NATIVA : 'https://player.vimeo.com';

  // Vídeo nuevo, oportunidad nueva: lo que falló con uno no tiene por qué
  // fallar con el siguiente.
  React.useEffect(() => setSeRindio(false), [fuente.src]);

  if (Platform.OS !== 'web' && seRindio) {
    return <VimeoVideo embedUrl={fuente.srcNormal} protectedContent />;
  }

  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      srcDoc: html,
      allow: 'autoplay; encrypted-media',
      // Sin pantalla completa a propósito: ahí el vídeo lo pinta el sistema,
      // por encima de la marca de agua y por encima del cristal.
      allowFullScreen: false,
      frameBorder: '0',
      scrolling: 'no',
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      style: {
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        borderRadius: radius.md,
        border: 'none',
      },
    });
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.video}>
      <WebView
        source={{ html, baseUrl: base }}
        originWhitelist={['*']}
        allowsFullscreenVideo={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onShouldStartLoadWithRequest={(req: { url: string }) =>
          seQuedaDentroDelBlindaje(req.url)
        }
        // La página avisa cuando ha tenido que quitarse el cristal. Aquí es
        // donde se recoge ese aviso para cambiar de mecanismo, en vez de
        // reintentar lo mismo que acaba de fallar.
        onMessage={(e: { nativeEvent: { data: string } }) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m?.de === 'reproductor' && m.que === 'sin-blindaje') setSeRindio(true);
          } catch {
            /* un mensaje que no entendemos no es motivo para tirar el vídeo */
          }
        }}
        // Y si el WebView no llega ni a cargar la página, lo mismo.
        onError={() => setSeRindio(true)}
        onHttpError={() => setSeRindio(true)}
        onRenderProcessGone={() => setSeRindio(true)}
        allowsLinkPreview={false}
        suppressMenuItems={['copy', 'share', 'select', 'selectAll', 'lookup', 'translate']}
        style={{ flex: 1, backgroundColor: '#000', borderRadius: radius.md }}
      />
    </View>
  );
}

function VimeoVideo({
  embedUrl,
  protectedContent = false,
}: {
  embedUrl: string;
  protectedContent?: boolean;
}) {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      src: embedUrl,
      // Contenido protegido: sin Picture-in-Picture (no se puede "sacar" el
      // vídeo de la app) ni menú contextual sobre el marco.
      allow: protectedContent ? 'autoplay; fullscreen' : 'autoplay; fullscreen; picture-in-picture',
      allowFullScreen: true,
      frameBorder: '0',
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      style: {
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        borderRadius: radius.md,
        border: 'none',
      },
    });
  }
  /*
   * Nativo (iOS/Android): el reproductor dentro de un WebView.
   *
   * Con un vídeo de YouTube, el reproductor incrustado trae sus propios
   * enlaces —el título, el logo, "Ver en YouTube"— y cualquiera de ellos
   * sacaba al alumno de UDECA y lo dejaba en la app de YouTube, con el vídeo
   * del curso a la vista de quien pase por allí y sin forma cómoda de volver.
   *
   * Se arregla no dejando que el WebView navegue a ninguna otra parte: solo
   * carga el propio reproductor y lo que este necesite. Un toque en "Ver en
   * YouTube" no hace nada, que es exactamente lo que tiene que hacer.
   */
  return <VideoEnWebView embedUrl={embedUrl} protectedContent={protectedContent} />;
}

/**
 * El WebView del reproductor, con lo que pasa cuando NO carga.
 *
 * UN VÍDEO QUE FALLA TIENE QUE DECIRLO
 *
 * Antes, si el WebView no conseguía cargar el reproductor —sin cobertura, un
 * vídeo que su dueño ha puesto como no incrustable, una red que bloquea
 * YouTube— lo que quedaba era un rectángulo negro, quieto y sin explicación.
 * Para el alumno eso es "la app está rota", y para nosotros es un aviso que
 * llega como "el reproductor no funciona" y sin nada más con lo que trabajar.
 *
 * Ahora se ve qué ha pasado y hay un botón de reintentar, que además arregla
 * el caso más común de todos: el vídeo que falló porque en ese momento no
 * había red.
 */
function VideoEnWebView({
  embedUrl,
  protectedContent,
}: {
  embedUrl: string;
  protectedContent?: boolean;
}) {
  const [fallo, setFallo] = React.useState(false);
  // Cambiar la clave vuelve a montar el WebView entero: es la forma de
  // reintentar de verdad, y no de pedirle que recargue lo que ya falló.
  const [intento, setIntento] = React.useState(0);

  // Vídeo nuevo, oportunidad nueva.
  React.useEffect(() => setFallo(false), [embedUrl]);

  if (fallo) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.textFaint} />
        <Text style={styles.placeholderText}>No se ha podido cargar el vídeo</Text>
        <Pressable
          onPress={() => {
            setFallo(false);
            setIntento((n) => n + 1);
          }}
          hitSlop={8}
          style={styles.reintentar}
        >
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.reintentarTexto}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.video}>
      <WebView
        key={intento}
        source={{ uri: embedUrl }}
        onError={() => setFallo(true)}
        /*
         * Solo si falla la PÁGINA. En Android esto salta también por cualquier
         * pieza suelta que el reproductor pida y no reciba —un icono, una
         * medición—, y tirar el vídeo por eso sería cambiar un fallo raro por
         * uno constante.
         */
        onHttpError={(e: { nativeEvent: { url?: string } }) => {
          if (e?.nativeEvent?.url === embedUrl) setFallo(true);
        }}
        onRenderProcessGone={() => setFallo(true)}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Sin ventanas nuevas: en Android un enlace con target=_blank abría la
        // app de YouTube por su cuenta, sin pasar por la comprobación de abajo.
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onShouldStartLoadWithRequest={(req: { url: string }) => seQuedaDentro(req.url, embedUrl)}
        // Contenido de curso: fuera el menú de mantener pulsado (copiar el
        // enlace, compartir) y la vista previa 3D Touch, que son las dos
        // formas de sacar la dirección del vídeo sin salir de la app.
        {...(protectedContent
          ? {
              allowsLinkPreview: false,
              suppressMenuItems: ['copy', 'share', 'select', 'selectAll', 'lookup', 'translate'],
            }
          : null)}
        style={{ flex: 1, backgroundColor: '#000', borderRadius: radius.md }}
      />
    </View>
  );
}

function NativeVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}

function WebVideo({ url }: { url: string }) {
  // En web renderizamos un <video> nativo para poder desactivar la descarga.
  const ref = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    el.setAttribute('disablePictureInPicture', 'true');
    el.setAttribute('disableRemotePlayback', 'true');
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, [url]);

  return React.createElement('video', {
    ref,
    src: url,
    controls: true,
    playsInline: true,
    style: {
      width: '100%',
      aspectRatio: '16 / 9',
      backgroundColor: '#000',
      borderRadius: radius.md,
    },
  });
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: radius.md,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: { ...typography.small, color: colors.textFaint },
  reintentar: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.xs },
  reintentarTexto: { ...typography.small, color: colors.primary },
});
