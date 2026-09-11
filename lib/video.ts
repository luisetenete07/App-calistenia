/**
 * Detección y normalización de enlaces de Vimeo para las lecciones.
 *
 * Formatos aceptados (los que copia el usuario desde Vimeo):
 *  - https://vimeo.com/123456789
 *  - https://vimeo.com/123456789/a1b2c3d4e5      (vídeo oculto, con hash)
 *  - https://player.vimeo.com/video/123456789?h=a1b2c3d4e5
 */
export interface VimeoRef {
  id: string;
  hash?: string;
}

export function parseVimeoUrl(url: string): VimeoRef | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;

    // player.vimeo.com/video/{id}?h={hash}
    let m = u.pathname.match(/^\/video\/(\d+)/);
    if (m) {
      return { id: m[1], hash: u.searchParams.get('h') ?? undefined };
    }

    // vimeo.com/{id}[/{hash}]
    m = u.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (m) {
      return { id: m[1], hash: m[2] ?? u.searchParams.get('h') ?? undefined };
    }
    return null;
  } catch {
    return null;
  }
}

/** URL de embed del reproductor de Vimeo, con descarga y PiP desactivados. */
export function vimeoEmbedUrl(ref: VimeoRef): string {
  const params = new URLSearchParams({
    dnt: '1', // sin cookies de seguimiento
    pip: '0',
    byline: '0',
    title: '0',
    portrait: '0',
  });
  if (ref.hash) params.set('h', ref.hash);
  return `https://player.vimeo.com/video/${ref.id}?${params.toString()}`;
}

/** Extrae el id de un vídeo de YouTube de sus formatos habituales. */
export function parseYouTubeId(url: string): string | null {
  try {
    // Tolerante a enlaces pegados sin protocolo ("youtube.com/watch?v=...").
    const raw = url.trim();
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * URL de embed de YouTube para reproducir DENTRO de la app. Dominio
 * youtube-nocookie.com (menos avisos de cookies en la UE) y playsinline para
 * que en iPhone se reproduzca en la propia pantalla, sin salir de la app.
 */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/**
 * EL ORIGEN QUE SE LE PRESTA AL REPRODUCTOR EN EL MÓVIL.
 *
 * EL ERROR 153, CONTADO ENTERO
 *
 * En el móvil el reproductor iba en un WebView que NAVEGABA directamente a la
 * dirección del embed. Eso, para YouTube, no es una página que incrusta un
 * vídeo: es alguien abriendo el reproductor a pelo, sin `Referer` y sin origen.
 * Y su reproductor incrustado exige saber quién lo incrusta.
 *
 * Lo que se ve cuando falta es exactamente esto, y no es un rectángulo negro
 * —es peor, porque parece nuestro—:
 *
 *     Error de configuración del reproductor de vídeo
 *     Error 153
 *
 * con dos botones suyos, "Ver vídeo en YouTube" y "Más información", que
 * además no hacían nada porque el guardián de navegación los bloqueaba. Un
 * error ajeno dentro de nuestra app, con dos botones muertos.
 *
 * La solución es la de siempre para un WebView: en vez de navegar al embed, se
 * carga una página NUESTRA —cuatro líneas— con el embed en un `iframe`, y se
 * le dice al WebView que esa página vive en `https://www.youtube.com`. Con eso
 * la petición del iframe sale con su `Referer` en regla y el reproductor se
 * configura.
 *
 * NO ES LO MISMO QUE EL BLINDAJE QUE SE RINDIÓ, y conviene dejarlo escrito
 * para que nadie vuelva a atar los dos cabos equivocados. Aquel montaba
 * también una página con origen prestado, sí, pero además necesitaba que la
 * API de YouTube CONTESTARA por `postMessage` para quitar el cristal de
 * encima; eso es lo que nunca llegó a funcionar dentro de un WebView. Aquí no
 * hay API, ni cristal, ni mensajes: hay un `iframe` y nada más. Lo único que
 * tiene que pasar es que cargue.
 */
export const ORIGEN_DE_YOUTUBE = 'https://www.youtube.com';

/** ¿Es este embed de YouTube (o de su dominio sin cookies)? */
export function esEmbedDeYouTube(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube.com') ||
      host.endsWith('.youtube-nocookie.com')
    );
  } catch {
    return false;
  }
}

/**
 * La página mínima que envuelve el embed para dárselo al WebView con origen.
 *
 * El `origin` va también DENTRO de la dirección del embed: es lo que el
 * reproductor compara con quien lo incrusta, y los dos tienen que decir lo
 * mismo que el `baseUrl` con el que se carga esta página.
 *
 * Sin `overflow: hidden` y con el iframe a pantalla completa, en Android
 * aparece una franja blanca debajo del vídeo en cuanto el WebView decide que
 * hay algo que desplazar.
 */
export function paginaDeEmbed(embedUrl: string): string {
  const src = conOrigenDeYouTube(embedUrl);
  const atributo = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
iframe{display:block;border:0;width:100%;height:100%}</style></head>
<body><iframe src="${atributo}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>`;
}

/** Le pega el `origin` al embed, si no lo lleva ya. */
function conOrigenDeYouTube(embedUrl: string): string {
  if (embedUrl.includes('origin=')) return embedUrl;
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}origin=${encodeURIComponent(ORIGEN_DE_YOUTUBE)}`;
}


/*
 * LA MINIATURA LA PONE LA PLATAFORMA
 *
 * Las mini clases no llevan miniatura propia: se usa la del sitio donde está
 * el vídeo. No es solo por ahorrar trabajo —que también—, es que un curso
 * entero vive en UN documento de Firestore y cada miniatura subida va dentro,
 * en base64. Con tres mini clases por lección, las fotos se comían el
 * documento antes que el contenido.
 *
 * Las lecciones sí la llevan, porque son las que se enseñan en la lista y las
 * que merecen una portada elegida. Las mini clases van dentro de una lección
 * que ya tiene cara.
 */

/** La miniatura pública de un vídeo de YouTube. Se deduce del id, sin pedir nada. */
export function miniaturaDeYouTube(id: string): string {
  // `hqdefault` y no `maxresdefault`: esta existe para TODOS los vídeos, y la
  // otra falta en los subidos en baja resolución y deja el hueco en gris.
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * La dirección donde Vimeo cuenta los datos de un vídeo, su miniatura incluida.
 *
 * Vimeo no deja deducir la miniatura de la URL como YouTube: hay que
 * preguntársela. Para los vídeos ocultos el hash va en la dirección, o
 * contesta que no existe.
 */
export function urlDeOEmbedVimeo(ref: VimeoRef): string {
  const video = ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`;
  return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video)}`;
}

/**
 * La miniatura que se puede saber SIN pedir nada por la red.
 *
 * YouTube sí, porque va en la propia dirección. Vimeo no (hay que preguntarle,
 * ver `urlDeOEmbedVimeo`) y un .mp4 suelto tampoco: un archivo de vídeo no
 * trae portada, y sacarla habría que descargarlo entero.
 */
export function miniaturaDelEnlace(url: string | undefined): string | null {
  if (!url) return null;
  const yt = parseYouTubeId(url);
  return yt ? miniaturaDeYouTube(yt) : null;
}

/*
 * QUÉ SE DEJA CARGAR AL WEBVIEW, Y POR QUÉ SE CAMBIÓ DE CRITERIO
 *
 * En el dominio de YouTube conviven dos cosas que no se parecen en nada: las
 * PIEZAS del reproductor (`/iframe_api`, `/s/player/…/base.js`, `/youtubei/…`),
 * sin las cuales no hay vídeo, y las PÁGINAS (`/watch`, `/@alguien`,
 * `/results`), que son las que sacan de la app.
 *
 * Aquí hubo una lista de PERMITIDOS: se enumeraban las piezas y se negaba todo
 * lo demás. El razonamiento era que las rutas de YouTube las decide YouTube, y
 * una que no estuviera en mi lista sería una salida abierta que nadie ve.
 *
 * La realidad enseñó que el error se paga al revés. Con lista de permitidos,
 * una pieza que YouTube mueva de sitio —o que yo no supiera— deja el vídeo EN
 * NEGRO, sin ningún error por ninguna parte, y eso pasó tres versiones
 * seguidas: tres arreglos razonados y las tres veces seguía sin verse en el
 * móvil.
 *
 * Ahora es una lista de BLOQUEADOS, y falla al revés: lo peor que puede pasar
 * es que alguien acabe en una página de YouTube que yo no había previsto. Un
 * vídeo que no se ve rompe el producto; un alumno que se escapa a YouTube es
 * una molestia. Cuando hay que elegir de qué lado fallar, se falla del lado de
 * que el vídeo se vea.
 */

/**
 * Las PÁGINAS de YouTube: lo único que de verdad hay que impedir.
 *
 * Son las que sacan al alumno de UDECA y lo dejan en la app de YouTube, con el
 * vídeo del curso a la vista de cualquiera y sin forma cómoda de volver.
 */
const PAGINAS_QUE_SACAN = [
  '/watch',
  '/shorts',
  '/results',
  '/playlist',
  '/channel',
  '/user',
  '/c/',
  '/share',
  '/feed',
  '/account',
  '/premium',
  '/subscribe',
  '/signin',
  '/upload',
];

function esPaginaQueSaca(u: URL): boolean {
  /*
   * Los ESQUEMAS PROPIOS son lo primero, y son lo más grave de todo esto: un
   * `youtube://` o un `vnd.youtube:` no abre una página, abre LA APP DE
   * YOUTUBE, con la clase del curso dentro y sin forma de volver. Se bloquea
   * cualquier cosa que no sea http o https.
   */
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;

  const host = u.hostname.replace(/^www\./, '');
  // youtu.be solo sirve para mandarte a la página del vídeo.
  if (host === 'youtu.be' || host === 'm.youtube.com' || host === 'music.youtube.com') return true;
  /*
   * La página de Vimeo, igual: el reproductor vive en `player.vimeo.com` y la
   * página del vídeo —con su logo, su autor y su botón de compartir— en
   * `vimeo.com` a secas. Separar por subdominio los distingue sin listas.
   */
  if (host === 'vimeo.com') return true;
  if (!(host === 'youtube.com' || host.endsWith('.youtube.com'))) return false;
  // Los canales con arroba: /@alguien.
  if (/^\/@/.test(u.pathname)) return true;
  return PAGINAS_QUE_SACAN.some((r) => u.pathname === r || u.pathname.startsWith(`${r}/`) || u.pathname.startsWith(`${r}?`));
}

/**
 * ¿Puede el WebView cargar esta dirección?
 *
 * ESTO ERA UNA LISTA DE LO QUE SÍ, Y AHORA ES DE LO QUE NO. IMPORTA.
 *
 * Antes se enumeraban las piezas que el reproductor necesita y se negaba todo
 * lo demás. El razonamiento era bueno: las rutas de YouTube las decide YouTube,
 * y una que yo no conozca se convertiría en una salida abierta que nadie ve.
 *
 * Lo que enseñó la realidad es que el error se paga al revés. Con lista de
 * permitidos, una pieza que YouTube mueva de sitio —o que yo no supiera— deja
 * el vídeo EN NEGRO, sin ningún error, y eso ya ha pasado tres versiones
 * seguidas. Con lista de bloqueados, lo peor que pasa es que un alumno acabe
 * en una página de YouTube que yo no había previsto.
 *
 * Un vídeo que no se ve rompe el producto. Un alumno que se escapa a YouTube
 * es una molestia. Cuando hay que elegir de qué lado fallar, se falla del lado
 * de que el vídeo se vea.
 */
export function seQuedaDentro(destino: string, embedUrl: string): boolean {
  if (destino === embedUrl || destino === 'about:blank' || destino.startsWith('data:')) return true;
  try {
    return !esPaginaQueSaca(new URL(destino));
  } catch {
    // Una dirección que ni siquiera se puede leer no es una página de YouTube:
    // suele ser algo interno del WebView. Bloquearla era dejar el vídeo negro.
    return true;
  }
}

/**
 * Lo mismo, para el reproductor blindado.
 *
 * Ahí la página es NUESTRA y el reproductor de la plataforma va dentro, en un
 * marco. Se le deja cargar su propio reproductor y lo que necesite para
 * funcionar; todo lo demás —y en particular youtube.com, que es donde llevan
 * "Ver en YouTube" y el logo— se queda fuera. El cristal ya impide pulsarlos;
 * esto es la segunda cerradura, por si algún día el cristal falla.
 */
export function seQuedaDentroDelBlindaje(destino: string): boolean {
  if (destino === 'about:blank' || destino.startsWith('data:')) return true;
  try {
    const u = new URL(destino);
    /*
     * Los esquemas propios se miran ANTES que nada. `vnd.youtube://abc` se lee
     * como una dirección sin ruta, así que el atajo de aquí abajo lo daba por
     * bueno — y ese atajo era justo el que abría la app de YouTube.
     */
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // La propia página del reproductor se carga con un origen prestado
    // (youtube.com o player.vimeo.com) para que la API de la plataforma pueda
    // hablar con ella. Ese origen se admite A SECAS: sin ruta, que es como
    // llega.
    if (u.pathname === '' || u.pathname === '/') return true;
    return !esPaginaQueSaca(u);
  } catch {
    return true;
  }
}
