/*
 * Que los vídeos se puedan VER en el móvil, y que sigan sin sacar de la app.
 *
 * POR QUÉ EXISTE
 *
 * En iPhone y Android los vídeos de técnica y de los cursos se veían en negro.
 * En el ordenador funcionaban, así que no se notaba: ahí el vídeo va en un
 * `iframe` y nadie le pregunta nada. En el móvil va en un WebView, y el WebView
 * pasa cada dirección por `seQuedaDentro` / `seQuedaDentroDelBlindaje` antes de
 * cargarla.
 *
 * Esas dos funciones bloqueaban el dominio `youtube.com` ENTERO. Y en ese
 * dominio viven dos cosas muy distintas:
 *
 *   - Las PIEZAS del reproductor: `/iframe_api`, `/s/player/…/base.js`,
 *     `/youtubei/v1/…`. Sin ellas no hay vídeo, solo un rectángulo negro.
 *   - Las PÁGINAS: `/watch`, `/@canal`, `/results`. Ahí llevan el logo y el
 *     "Ver en YouTube", y ahí es donde no se puede ir.
 *
 * Bloquear las dos por igual mataba el reproductor para proteger algo que se
 * podía proteger sin matarlo.
 *
 * Es un fallo silencioso y caro: no da error, no aparece en el navegador, y en
 * el móvil se ve como una app rota. De ahí este guion, que comprueba LAS DOS
 * COSAS a la vez —que el reproductor arranca y que no se sale— porque arreglar
 * una rompiendo la otra es muy fácil.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-video-movil.mjs
 */
import { readFileSync } from 'node:fs';
import { seQuedaDentro, seQuedaDentroDelBlindaje } from '../lib/video.ts';
import { ESPERA_MS, fuenteBlindada } from '../lib/reproductorBlindado.ts';

let fallos = 0;
/** El porqué solo se imprime cuando falla; si pasa, sobra y despista. */
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

/** El embed que se usa de verdad, para el guardián del reproductor normal. */
const EMBED = 'https://www.youtube-nocookie.com/embed/ID?rel=0&modestbranding=1&playsinline=1';

/**
 * Lo que el reproductor pide para poder reproducir. Si algo de esto se
 * bloquea, el vídeo se queda en negro.
 */
const NECESITA = [
  ['https://www.youtube.com/iframe_api', 'la API que monta el reproductor'],
  ['https://www.youtube.com/s/player/abc123/base.js', 'el código del reproductor'],
  ['https://www.youtube.com/youtubei/v1/player', 'los datos del vídeo'],
  ['https://www.youtube-nocookie.com/embed/ID', 'el marco del vídeo'],
  ['https://i.ytimg.com/vi/ID/hqdefault.jpg', 'la miniatura'],
  ['https://rr1.googlevideo.com/videoplayback?x=1', 'el vídeo en sí'],
  ['https://fonts.gstatic.com/s/roboto.woff2', 'la tipografía del reproductor'],
  ['https://player.vimeo.com/video/123', 'el reproductor de Vimeo'],
];

/**
 * Lo que saca al usuario de UDECA. Un alumno se ha metido en una lección de su
 * curso, no en un navegador — y el vídeo del curso no puede acabar abierto en
 * la app de YouTube, a la vista de cualquiera.
 */
const NO_DEBE_PASAR = [
  ['https://www.youtube.com/watch?v=ID', 'la página del vídeo'],
  ['https://m.youtube.com/watch?v=ID', 'la página del vídeo, en móvil'],
  ['https://youtu.be/ID', 'el enlace corto'],
  ['https://www.youtube.com/@uncanal', 'el canal'],
  ['https://www.youtube.com/channel/UC123', 'el canal, en la forma vieja'],
  ['https://www.youtube.com/results?search_query=x', 'la búsqueda'],
  ['https://www.youtube.com/playlist?list=X', 'una lista'],
  ['https://www.youtube.com/share?v=ID', 'compartir'],
  ['https://music.youtube.com/watch?v=ID', 'YouTube Music'],
];

/*
 * LO QUE YA NO SE BLOQUEA, Y ES A PROPÓSITO
 *
 * Antes esto era una lista de permitidos y aquí abajo estaban "una ruta que no
 * conozco" y "cualquier otra web", que se bloqueaban por no estar en la lista.
 * Ese criterio dejó el vídeo en negro tres versiones seguidas: cualquier pieza
 * del reproductor que YouTube moviera de sitio caía del lado malo, sin dar
 * ningún error.
 *
 * Ahora se bloquean solo las páginas que sacan de la app. Una ruta desconocida
 * carga, y eso es lo que se quiere: como mucho, alguien acaba donde no
 * esperábamos; antes, nadie podía ver la clase.
 */
const AHORA_SE_DEJAN_PASAR = [
  ['https://www.youtube.com/algo-que-aun-no-existe', 'una ruta de YouTube que no conozco'],
  ['https://www.youtube.com/s/player/abc/base.js', 'una pieza del reproductor'],
  ['https://rr3.googlevideo.com/videoplayback?y=2', 'el vídeo por otro servidor'],
];

console.log('\nLo que el reproductor necesita para arrancar');
for (const [url, que] of NECESITA) {
  const blindado = seQuedaDentroDelBlindaje(url);
  const normal = seQuedaDentro(url, EMBED);
  ok(
    que,
    blindado && normal,
    blindado ? 'lo bloquea el reproductor normal' : 'lo bloquea el blindado'
  );
}

console.log('\nLo que NO puede cargarse, porque saca de la app');
for (const [url, que] of NO_DEBE_PASAR) {
  const blindado = seQuedaDentroDelBlindaje(url);
  const normal = seQuedaDentro(url, EMBED);
  ok(que, !blindado && !normal, blindado ? 'pasa en el blindado' : 'pasa en el normal');
}


const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nEl reproductor le dice a YouTube desde dónde se le habla');
{
  /*
   * Con `enablejsapi=1`, YouTube exige saber el origen desde el que se le va a
   * hablar. Sin `origin` el reproductor puede no llegar a arrancar, y lo que se
   * ve entonces no es un mensaje de error: es un rectángulo negro.
   *
   * El origen no es fijo: en el ordenador la página hereda el de la app y en el
   * móvil va en un WebView con uno prestado. Por eso lo pasa quien la monta.
   */
  const con = fuenteBlindada('https://youtu.be/ID', 'https://www.youtube.com');
  ok('el blindado declara el origen', /[?&]origin=https%3A%2F%2Fwww\.youtube\.com/.test(con.src), con.src);
  ok('y sigue usando la API del iframe', /[?&]enablejsapi=1/.test(con.src));
  const sin = fuenteBlindada('https://youtu.be/ID');
  ok('sin origen conocido, no se inventa uno', !/origin=/.test(sin.src));
}

console.log('\nEl paracaídas no repite lo que acaba de fallar');
{
  const f = fuenteBlindada('https://youtu.be/ID', 'https://www.youtube.com');
  /*
   * El repuesto era el mismo enlace con los controles puestos, y llevaba dentro
   * los parámetros por los que el blindaje se puede haber caído. Reintentar con
   * eso no es un repuesto: es esperar sentado con el vídeo en negro.
   */
  ok('el repuesto no usa la API', !/enablejsapi/.test(f.srcNormal), f.srcNormal);
  ok('ni bloquea el teclado', !/disablekb/.test(f.srcNormal));
  ok('ni quita la pantalla completa', !/fs=0/.test(f.srcNormal));
  ok('y sigue siendo el mismo vídeo', f.srcNormal.includes('/embed/ID'));
  // Segundos mirando un rectángulo negro sin saber que hay un plan B.
  ok('no se tarda una eternidad en rendirse', ESPERA_MS <= 5000, `${ESPERA_MS} ms`);
}

console.log('\nCuando el blindaje se rinde, alguien lo escucha');
{
  const vp = lee('components/VideoPlayer.tsx');
  // La página gritaba "me he desblindado" y no había nadie al otro lado, así
  // que un fallo del blindaje era un vídeo negro para siempre.
  ok('el WebView escucha los avisos de la página', /onMessage=/.test(vp));
  ok('y reacciona al de sin blindaje', /'sin-blindaje'\) setSeRindio\(true\)/.test(vp));
  ok('un error de carga también cuenta', /onError=\{\(\) => setSeRindio\(true\)\}/.test(vp));
  // Y lo que se enseña entonces es OTRO mecanismo: una navegación normal a una
  // dirección de verdad, no la misma página con origen prestado.
  ok('y se cambia de mecanismo, no se reintenta',
    /seRindio\) \{\s*return <VimeoVideo embedUrl=\{fuente\.srcNormal\}/.test(vp), 'sigue reintentando lo mismo');
}

console.log('\nQué va blindado y qué no');
{
  const visor = lee('components/VisorDeVideo.tsx');
  ok('el visor deja elegir', /protegido = true/.test(visor));
  ok('y por defecto protege', /protectedContent=\{protegido\}/.test(visor));
  // Una clase de curso es material de pago: va blindada.
  const curso = lee('app/(client)/courses/[id].tsx');
  ok('las clases de un curso siguen blindadas', !/protegido=\{false\}/.test(curso));
  /*
   * El vídeo de técnica no. Es un enlace público que el entrenador ha pegado, y
   * el blindaje es la parte más frágil del reproductor: arriesgar el vídeo que
   * más se mira para proteger algo que cualquiera puede buscar sale carísimo.
   */
  ok('la técnica del entreno, sin blindar', /protegido=\{false\}/.test(lee('app/(client)/workout.tsx')));
  ok('la de la rutina diaria, tampoco', /protegido=\{false\}/.test(lee('components/RutinaDiariaDelDia.tsx')));
}

console.log('\nLo desconocido carga, en vez de quedarse en negro');
for (const [url, que] of AHORA_SE_DEJAN_PASAR) {
  const blindado = seQuedaDentroDelBlindaje(url);
  const normal = seQuedaDentro(url, EMBED);
  ok(que, blindado && normal, blindado ? 'lo bloquea el reproductor normal' : 'lo bloquea el blindado');
}

// Una dirección que ni se puede leer suele ser algo interno del WebView.
// Bloquearla era dejar el vídeo negro por algo que no era una página de nadie.
ok('lo que no es ni una dirección, pasa', seQuedaDentro('esto-no-es-una-url', EMBED));

console.log('\nEn el móvil las clases ya no van blindadas');
{
  const vp = readFileSync(new URL('../components/VideoPlayer.tsx', import.meta.url), 'utf8');
  /*
   * El blindaje necesita montar una página nuestra con un origen PRESTADO y que
   * la API de YouTube conteste dentro. En un iframe del navegador funciona; en
   * un WebView no lo ha hecho ni una vez. Se cambia una protección cosmética
   * —esconder el logo de YouTube— por que la clase se pueda ver.
   */
  ok('solo se blinda en el ordenador', /protectedContent && Platform\.OS === 'web'/.test(vp));
  // Lo que NO se toca: sigue sin poder salirse ni ponerse a pantalla completa.
  ok('sigue sin pantalla completa en el blindado', /allowsFullscreenVideo=\{false\}/.test(vp));
  ok('y sigue sin poder navegar fuera', /onShouldStartLoadWithRequest/.test(vp));
}

console.log('\nUn vídeo que no carga lo dice, en vez de quedarse negro');
{
  /*
   * EL FALLO SILENCIOSO
   *
   * Si el WebView no conseguía cargar el reproductor —sin cobertura, un vídeo
   * que su dueño ha puesto como no incrustable, una red que bloquea YouTube—
   * lo que quedaba era un rectángulo negro, quieto y sin explicación. Para el
   * alumno eso es "la app está rota"; para nosotros, un aviso que llega como
   * "el reproductor no funciona" y sin nada con lo que trabajar.
   */
  const p = lee('components/VideoPlayer.tsx');
  ok('el reproductor se entera de que ha fallado', /onError=\{\(\) => setFallo\(true\)\}/.test(p));
  ok('y también si se muere el proceso', /onRenderProcessGone=\{\(\) => setFallo\(true\)\}/.test(p));
  /*
   * Pero solo si falla la PÁGINA. En Android `onHttpError` salta también por
   * cualquier pieza suelta que el reproductor pida y no reciba, y tirar el
   * vídeo por eso sería cambiar un fallo raro por uno constante.
   */
  ok('un recurso suelto no tira el vídeo', /nativeEvent\?\.url === embedUrl/.test(p));
  ok('se le dice al alumno qué ha pasado', /No se ha podido cargar el vídeo/.test(p));
  ok('y puede reintentar', /Reintentar/.test(p));
  /*
   * Reintentar tiene que volver a montar el WebView entero (por eso la clave
   * cambia): pedirle que recargue lo que acaba de fallar deja la misma página
   * rota en pantalla.
   */
  ok('el reintento monta el reproductor de nuevo', /key=\{intento\}/.test(p) && /setIntento\(\(n\) => n \+ 1\)/.test(p));
  // Y un vídeo distinto empieza de cero: lo que falló con uno no tiene por qué
  // fallar con el siguiente.
  ok('un vídeo nuevo empieza limpio', /useEffect\(\(\) => setFallo\(false\), \[embedUrl\]\)/.test(p));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
