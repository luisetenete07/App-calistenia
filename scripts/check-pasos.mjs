/*
 * Contador de pasos (lib/pasos.ts).
 *
 * Lo que hay que proteger: que una lectura parcial del móvil no borre lo que
 * el usuario escribió a mano —que es el fallo que hace que la gente deje de
 * usar un contador— y que la semana cuente los días en blanco, porque una
 * semana perfecta hecha de tres días no es una semana perfecta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pasos.mjs
 */
import { readFileSync } from 'node:fs';
import {
  balanceDelDia,
  caloriasDePasos,
  objetivoDeTexto,
  OBJETIVO_MAXIMO,
  OBJETIVO_MINIMO,
  mediaSemanal,
  OBJETIVO_POR_DEFECTO,
  pasosAGuardar,
  pasosDeHoy,
  progresoDePasos,
  sinElPasoFantasma,
  textoDelBalance,
  textoDePasos,
  ultimosSieteDias,
} from '../lib/pasos.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nCómo va el día');
{
  const p = progresoDePasos(4000, 8000);
  comprueba('la mitad del objetivo', p.ratio === 0.5 && p.quedan === 4000);
  comprueba('no está cumplido', !p.cumplido);
  comprueba('con el objetivo, cumplido', progresoDePasos(8000, 8000).cumplido);
  // Pasarse no rompe la barra ni deja "quedan -2000".
  comprueba('pasarse no pasa del 100 %', progresoDePasos(20000, 8000).ratio === 1);
  comprueba('ni deja pasos negativos', progresoDePasos(20000, 8000).quedan === 0);
  comprueba('sin objetivo, el de por defecto', progresoDePasos(0).objetivo === OBJETIVO_POR_DEFECTO);
  comprueba('un objetivo de cero no divide entre cero', Number.isFinite(progresoDePasos(100, 0).ratio));
  comprueba('pasos negativos se quedan en cero', progresoDePasos(-500).pasos === 0);
}

console.log('\nLa semana, con sus días en blanco');
{
  const hoy = Date.now();
  const registros = [
    { date: masDias(hoy, -6), steps: 9000, source: 'telefono' },
    { date: masDias(hoy, -3), steps: 5000, source: 'mano' },
    { date: hoy, steps: 2000, source: 'telefono' },
  ];
  const semana = ultimosSieteDias(registros, hoy);
  comprueba('siete días', semana.length === 7);
  comprueba('el último es hoy', inicioDelDia(semana[6].date) === inicioDelDia(hoy));
  comprueba('en orden, del más viejo al más nuevo', semana[0].date < semana[6].date);
  comprueba('los días sin registro salen a cero', semana[1].steps === 0 && semana[2].steps === 0);
  comprueba('y los que hay, con su cifra', semana[0].steps === 9000 && semana[6].steps === 2000);
  // Contando los ceros: 16000/7 = 2286. Saltárselos daría 5333 y una semana
  // floja parecería buena.
  comprueba('la media cuenta los días en blanco', mediaSemanal(registros, hoy) === 2286, String(mediaSemanal(registros, hoy)));

  comprueba('encuentra los de hoy', pasosDeHoy(registros, hoy)?.steps === 2000);
  comprueba('sin registro de hoy, nada', pasosDeHoy([registros[0]], hoy) === null);
}

console.log('\nQué se guarda cuando llega una lectura del móvil');
{
  // iPhone: la lectura es la del día entero, así que manda.
  comprueba('en iPhone la lectura sustituye', pasosAGuardar({ date: 0, steps: 300, source: 'telefono' }, 9000, { acumulativo: false }) === 9000);
  comprueba('sin nada previo, se guarda tal cual', pasosAGuardar(null, 4000, { acumulativo: false }) === 4000);

  // Android: solo cuenta con la app abierta, así que se suma; si sustituyera,
  // abrir UDECA a las ocho de la tarde borraría el día entero.
  comprueba('en Android se suma a lo del día', pasosAGuardar({ date: 0, steps: 4000, source: 'telefono' }, 300, { acumulativo: true }) === 4300);

  // Y lo escrito a mano no lo pisa una lectura parcial: quien teclea los 12.000
  // de su reloj no puede verlos convertidos en 300.
  const aMano = { date: 0, steps: 12000, source: 'mano' };
  comprueba('lo escrito a mano no lo pisa una lectura menor', pasosAGuardar(aMano, 300, { acumulativo: false }) === 12000);
  comprueba('pero una lectura mayor sí manda', pasosAGuardar(aMano, 15000, { acumulativo: false }) === 15000);
  comprueba('una lectura negativa no resta', pasosAGuardar(null, -50, { acumulativo: false }) === 0);

  /*
   * Y TAMPOCO LO PISA LO QUE YA HABÍA LEÍDO EL PROPIO TELÉFONO.
   *
   * Los pasos de un día solo suben. Una lectura por debajo de lo apuntado no
   * es que se haya andado menos: es una lectura mala. Antes solo se protegía
   * lo escrito a mano, así que un 1 defectuoso se llevaba por delante los
   * 8.000 que el mismo móvil había dado dos horas antes.
   */
  const delMovil = { date: 0, steps: 8000, source: 'telefono' };
  comprueba('una lectura mala no baja el contador', pasosAGuardar(delMovil, 1, { acumulativo: false }) === 8000);
  comprueba('un cero tampoco', pasosAGuardar(delMovil, 0, { acumulativo: false }) === 8000);
}

console.log('\nEl paso fantasma de Android');
{
  /*
   * El sensor de Android cuenta desde que se encendió el móvil y suelta un
   * primer aviso nada más ponerse a escuchar. El módulo de Expo toma como
   * origen `total - 1`, así que ese primer aviso vale SIEMPRE 1, se haya
   * andado o no. Ese 1 es el que se guardaba como los pasos del día: quien
   * pulsaba el botón sentado veía "1 paso" y pensaba, con razón, que el
   * contador estaba roto.
   */
  comprueba('el primer aviso, que siempre vale 1, no cuenta como un paso', sinElPasoFantasma(1) === 0);
  comprueba('sin ese paso, lo demás es lo andado de verdad', sinElPasoFantasma(24) === 23);
  comprueba('un cero no se vuelve negativo', sinElPasoFantasma(0) === 0);
  // Y sin haber andado no se guarda nada: guardar un cero marcaría el día como
  // leído del teléfono sin haber leído nada.
  comprueba('lo que se sumaría tras el fantasma es cero', pasosAGuardar({ date: 0, steps: 4000, source: 'telefono' }, sinElPasoFantasma(1), { acumulativo: true }) === 4000);
}

console.log('\nSe conecta UNA VEZ y se lee solo');
{
  /*
   * El fallo que hacía que nadie usara el contador no era de cuentas: era que
   * había que pedir los pasos a mano CADA DÍA. Un contador que hay que
   * despertar cada mañana se abandona a los tres días.
   *
   * Lo que se comprueba aquí es la parte que lo arregla: que la elección se
   * guarde en la cuenta y que la app lea sola.
   */
  const { readFileSync } = await import('node:fs');
  const sinComentarios = (x) =>
    x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const lee = (f) => sinComentarios(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  const contador = lee('components/ContadorDePasos.tsx');
  const tipos = lee('lib/types.ts');

  comprueba('la elección vive en la cuenta, no en el móvil', /stepsSource\?: 'telefono' \| 'mano'/.test(tipos));
  comprueba('y se guarda al elegir', /updateUserProfile\(profile\.uid, \{ stepsSource: cual \}\)/.test(contador));
  // Lo que hace que aparezcan solos: leer al abrir y al volver a la app.
  comprueba('lee al abrir la pantalla', /useEffect\(\(\) => \{\s*leerSiToca\(\);/.test(contador));
  comprueba('y al volver del segundo plano', /AppState\.addEventListener/.test(contador));
  comprueba('solo si está conectado al móvil', /if \(origen !== 'telefono'/.test(contador));
  // Una lectura que nadie ha pedido no puede llenar la pantalla de avisos.
  comprueba('la lectura automática va en silencio', /enSilencio: true/.test(contador));
  // (El dato de hoy se lee de la referencia, no de la prop: ver más abajo, en
  // "La lectura automática no puede llamarse a sí misma".)
  comprueba('y no escribe si el número no cambia',
    /if \(enSilencio && aGuardar === \(deHoy\?\.steps \?\? 0\)\) return;/.test(contador));
  // Y se puede cambiar de fuente cuando se quiera.
  comprueba('se puede cambiar de fuente', /setCambiando\(true\)/.test(contador));
  // Escribirlos a mano sigue estando con el móvil conectado: se sale a andar
  // sin él más veces de las que parece.
  comprueba('escribir a mano sigue disponible', /Apuntar a mano/.test(contador));
  /*
   * Y sin tener que contestar antes de dónde salen. Estuvo escondido detrás de
   * la pregunta de la fuente y era un paso de más para quien solo entra a
   * apuntar sus 9.000 pasos del reloj.
   */
  comprueba('y sin pasar antes por la pregunta',
    !/\{origen \?[\s\S]{0,80}styles\.filaMano/.test(contador));
}

console.log('\nLas calorías, que son una estimación');
{
  comprueba('10.000 pasos de una persona de 70 kg', caloriasDePasos(10000, 70) === 350, String(caloriasDePasos(10000, 70)));
  comprueba('pesando más, más', caloriasDePasos(10000, 90) > caloriasDePasos(10000, 70));
  // Sin peso no se inventa una cifra: se calla.
  comprueba('sin peso, nada', caloriasDePasos(10000) === 0);
  comprueba('sin pasos, nada', caloriasDePasos(0, 70) === 0);
}

console.log('\nLo que se le dice');
{
  comprueba('sin andar, dice el objetivo', /8.000 pasos/.test(textoDePasos(progresoDePasos(0, 8000))));
  comprueba('a medias, lo que queda', /4.000 pasos/.test(textoDePasos(progresoDePasos(4000, 8000))));
  comprueba('cumplido, lo dice y para', /cumplido/i.test(textoDePasos(progresoDePasos(8000, 8000))));
  comprueba('y no riñe por pasarse', !/demasiado|exceso/i.test(textoDePasos(progresoDePasos(30000, 8000))));
}

console.log('\nEl objetivo lo pone el entrenador');
{
  // Sin que nadie lo elija, 10.000. No es un detalle: es la cifra que ve todo
  // alumno cuyo coach aún no ha entrado en su ficha.
  comprueba('por omisión son 10.000', OBJETIVO_POR_DEFECTO === 10000, String(OBJETIVO_POR_DEFECTO));
  comprueba('se lee un número escrito a mano', objetivoDeTexto('12000') === 12000);
  comprueba('con puntos también', objetivoDeTexto('12.000') === 12000, String(objetivoDeTexto('12.000')));
  // Borrar el campo es quitar el objetivo. Devolver 10.000 sería no dejarle
  // deshacer lo que puso.
  comprueba('vacío no es 10.000, es nada', objetivoDeTexto('') === undefined);
  comprueba('ni letras', objetivoDeTexto('muchos') === undefined);
  comprueba('un disparate no entra', objetivoDeTexto('999999') === undefined);
  comprueba('ni una cifra ridícula', objetivoDeTexto('12') === undefined);
  comprueba('los topes sí', objetivoDeTexto(String(OBJETIVO_MINIMO)) === OBJETIVO_MINIMO
    && objetivoDeTexto(String(OBJETIVO_MAXIMO)) === OBJETIVO_MAXIMO);
}

console.log('\nEl presupuesto de calorías del día');
{
  // Los pasos SUMAN al presupuesto. Es la misma resta que descontarlos de lo
  // comido, pero al derecho: "hoy tienes 2.320" se entiende y "has comido
  // 1.450 menos 320" no.
  const b = balanceDelDia(2000, 1450, 320);
  comprueba('el presupuesto es el plan más lo andado', b.disponibles === 2320, String(b.disponibles));
  comprueba('quedan las que quedan', b.restantes === 870, String(b.restantes));
  comprueba('y no se ha pasado', b.pasado === false);

  // Enseñar un cero a quien se ha pasado 600 kcal es esconder justo el dato
  // por el que ha entrado en la pantalla.
  const p = balanceDelDia(2000, 2600, 0);
  comprueba('pasarse sale en negativo, no en cero', p.restantes === -600, String(p.restantes));
  comprueba('y se marca como pasado', p.pasado === true);

  comprueba('sin andar, el presupuesto es el del plan', balanceDelDia(2000, 0).disponibles === 2000);
  comprueba('nada negativo entra', balanceDelDia(-5, -5, -5).disponibles === 0);
  comprueba('sin plan no se inventa nada', balanceDelDia(0, 0, 0).disponibles === 0);
}

console.log('\nDe dónde sale el presupuesto');
{
  const conPasos = textoDelBalance(balanceDelDia(2000, 1450, 320));
  comprueba('dice lo comido y lo disponible', /1.450/.test(conPasos) && /2.320/.test(conPasos), conPasos);
  comprueba('y de dónde salen las de más', /por andar/.test(conPasos), conPasos);
  const sinPasos = textoDelBalance(balanceDelDia(2000, 1450, 0));
  comprueba('sin pasos no habla de andar', !/andar/.test(sinPasos), sinPasos);
}

console.log('\nLa lectura automática no puede llamarse a sí misma');
{
  /*
   * EL TIOVIVO
   *
   * "En la sección de nutrición, al rehacer la ficha nutricional, parpadea
   * mucho y te tira de la app".
   *
   * El contador de pasos lee solo cuando se abre la pantalla, y esa lectura
   * dependía de `registros`: la lista de pasos que le pasa el padre. Pero el
   * padre devuelve una lista NUEVA cada vez que recarga, aunque los pasos sean
   * los mismos. Y leer acaba guardando, y guardar hace recargar al padre:
   *
   *   leer el sensor → guardar → el padre recarga → lista nueva → leer otra vez
   *
   * Cada vuelta escribía en Firestore y repintaba la pantalla entera, con una
   * escucha del sensor de cuatro segundos por medio. Guardar los macros
   * arrancaba justo eso —refresca el perfil, el perfil hace recargar al padre—,
   * que es por lo que se notaba al rehacer la ficha.
   *
   * Lo que esto vigila: que la lectura dependa SOLO del origen, y que los pasos
   * de hoy se miren por referencia, que da el dato fresco sin ser un motivo
   * para volver a leer.
   */
  const c = readFileSync(new URL('../components/ContadorDePasos.tsx', import.meta.url), 'utf8');

  const deps = /const leerSiToca = useCallback\([\s\S]*?\}, \[([^\]]*)\]\);/.exec(c)?.[1] ?? '(no se encuentra)';
  comprueba('la lectura automática solo depende del origen', deps.trim() === 'origen', deps);
  comprueba('los pasos de hoy se miran por referencia', /registrosRef\.current/.test(c));
  comprueba('y la referencia se mantiene fresca', /registrosRef\.current = registros/.test(c));
  /*
   * Y que no se cuele por otro lado: si `leerDelTelefono` entrara en las
   * dependencias, el efecto se dispararía en cada pintado, que es la misma
   * enfermedad con otro nombre.
   */
  comprueba('ni depende de la función que lee', !/\[origen, leerDelTelefono\]/.test(c));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
