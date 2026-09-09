/*
 * La rutina diaria: lo que se hace todos los días aparte del plan.
 *
 * QUÉ ES Y POR QUÉ TIENE SU PROPIA PIEZA
 *
 * El pino, la movilidad, los estiramientos. No es "el entreno del martes": es
 * algo corto que se repite a diario y que, justo por repetirse, es lo que más
 * cambia a alguien en seis meses. Va aparte del plan y se ve aparte.
 *
 * LO QUE SE VIGILA AQUÍ
 *
 * Sobre todo una cosa que parece un detalle y no lo es: qué pasa cuando el
 * entrenador CAMBIA la rutina a media semana. Si se quita un ejercicio, lo que
 * el alumno marcó ayer sobre ese ejercicio no puede seguir contando hoy — se
 * vería "4 de 3 hechos", que es de esos números que hacen desconfiar de todo lo
 * demás que dice la pantalla.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-rutina-diaria.mjs
 */
import { readFileSync } from 'node:fs';
import {
  conMarca,
  deLaBiblioteca,
  ejerciciosActualizados,
  hayRutinaDiaria,
  hechosDeHoy,
  marcaDeSerie,
  marcasDeLaRutina,
  moverEjercicio,
  MAX_SERIES,
  yaEstaPuesto,
  progresoDiario,
  seriesDe,
  seriesDeTexto,
  textoDelEjercicio,
  textoDiario,
} from '../lib/rutinaDiaria.ts';
import { masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const AHORA = Date.now();
const rutina = (ejercicios, extra = {}) => ({
  id: 'a1',
  trainerId: 'c1',
  clientId: 'a1',
  activa: true,
  nombre: 'Diaria',
  ejercicios,
  updatedAt: AHORA,
  ...extra,
});
const tres = [
  { id: 'e1', nombre: 'Pino', objetivo: '3 series de 30 s' },
  { id: 'e2', nombre: 'Movilidad de cadera', objetivo: '2 min' },
  { id: 'e3', nombre: 'Muñecas', objetivo: '1 min' },
];
const dia = (hechos, cuando = AHORA) => ({
  id: 'a1_x',
  clientId: 'a1',
  date: cuando,
  hechos,
  updatedAt: cuando,
});

console.log('\n¿Se le enseña algo al alumno?');
{
  ok('con ejercicios y encendida, sí', hayRutinaDiaria(rutina(tres)));
  ok('apagada, no', !hayRutinaDiaria(rutina(tres, { activa: false })));
  // Encendida pero vacía no es una rutina: es una tarjeta que no dice nada.
  ok('encendida pero sin ejercicios, tampoco', !hayRutinaDiaria(rutina([])));
  ok('sin rutina, nada', !hayRutinaDiaria(null) && !hayRutinaDiaria(undefined));
}

console.log('\nLo hecho HOY, y solo hoy');
{
  ok('lo de hoy cuenta', hechosDeHoy(dia(['e1']), AHORA).length === 1);
  /*
   * Lo de ayer NO. Es una rutina DIARIA: cada día empieza de cero. Sin esto,
   * quien la hizo el lunes la vería marcada el martes y no la haría.
   */
  ok('lo de ayer no', hechosDeHoy(dia(['e1', 'e2'], masDias(AHORA, -1)), AHORA).length === 0);
  ok('sin registro, nada', hechosDeHoy(null, AHORA).length === 0);
}

console.log('\nCómo va el día');
{
  ok('nada hecho', progresoDiario(rutina(tres), dia([]), AHORA).hechos === 0);
  const medio = progresoDiario(rutina(tres), dia(['e1', 'e2']), AHORA);
  ok('dos de tres', medio.hechos === 2 && medio.total === 3);
  ok('y no está completa', !medio.completa && medio.quedan === 1);
  const entera = progresoDiario(rutina(tres), dia(['e1', 'e2', 'e3']), AHORA);
  ok('las tres, completa', entera.completa && entera.ratio === 1 && entera.quedan === 0);
  // Una rutina vacía no puede dividir entre cero ni salir "completa".
  ok('sin ejercicios no divide entre cero', Number.isFinite(progresoDiario(rutina([]), dia([]), AHORA).ratio));
  ok('ni se da por completa', !progresoDiario(rutina([]), dia([]), AHORA).completa);
}

console.log('\nEl entrenador cambia la rutina a media semana');
{
  /*
   * Se marcaron tres y el entrenador quita uno. Lo marcado sobre el que ya no
   * está deja de contar: si no, saldría "3 de 2".
   */
  const marcadas = dia(['e1', 'e2', 'e3']);
  const p = progresoDiario(rutina(tres.slice(0, 2)), marcadas, AHORA);
  ok('lo marcado de un ejercicio que ya no está no cuenta', p.hechos === 2 && p.total === 2, `${p.hechos}/${p.total}`);
  ok('y nunca se pasa del 100 %', p.ratio === 1);
  // Y al revés: si añade uno, el día deja de estar completo, que es correcto.
  const conUnoMas = progresoDiario(
    rutina([...tres, { id: 'e4', nombre: 'Escápulas', objetivo: '10' }]),
    marcadas,
    AHORA
  );
  ok('si añade uno, quedan cosas por hacer', conUnoMas.quedan === 1 && !conUnoMas.completa);
}

console.log('\nLas series se marcan de una en una');
{
  /*
   * Es lo que separa esto de una lista de tareas. En el grease the groove las
   * cinco series no van seguidas: se reparten por el día, y hay que poder decir
   * "llevo dos" sin dar el ejercicio por hecho.
   */
  const conSeries = rutina([
    { id: 'e1', nombre: 'Pino', objetivo: '30 s', series: 5 },
    { id: 'e2', nombre: 'Muñecas', objetivo: '1 min' },
  ]);
  const marcas = marcasDeLaRutina(conSeries);
  ok('cinco series y un ejercicio suelto son seis cosas', marcas.length === 6, String(marcas.length));
  ok('las series van numeradas', marcas[0] === 'e1#1' && marcas[4] === 'e1#5', marcas.join(','));
  ok('y el que no las lleva se marca entero', marcas[5] === 'e2');

  const p = progresoDiario(conSeries, dia(['e1#1', 'e1#2']), AHORA);
  ok('dos series de seis cosas', p.hechos === 2 && p.total === 6, `${p.hechos}/${p.total}`);
  ok('y quedan cuatro', p.quedan === 4);

  /*
   * Y si el entrenador BAJA las series de cinco a tres, lo marcado de la cuarta
   * deja de contar. Si no, saldría "4 de 4" con la cuarta serie ya inexistente.
   */
  const bajado = rutina([{ id: 'e1', nombre: 'Pino', objetivo: '30 s', series: 3 }]);
  const tras = progresoDiario(bajado, dia(['e1#1', 'e1#4']), AHORA);
  ok('bajar las series descuenta lo que sobra', tras.hechos === 1 && tras.total === 3, `${tras.hechos}/${tras.total}`);
}

console.log('\nEl número de series, leído de lo que se teclea');
{
  ok('vacío es SIN PONER, no cero', seriesDeTexto('') === undefined);
  ok('un número normal se lee', seriesDeTexto('5') === 5);
  // Sin poner y "una serie" son cosas distintas: dos minutos de movilidad no se
  // cuentan por series, y ponerles un 1 sería inventarse un dato.
  ok('sin poner cuenta como una sola cosa', seriesDe({}) === 1);
  ok('el cero no vale', seriesDeTexto('0') === undefined);
  ok('lo que no son cifras se ignora', seriesDeTexto('3 series') === 3);
  ok('un dedo que resbala tiene tope', seriesDeTexto('900') === MAX_SERIES);
  ok('y el tope también al leer', seriesDe({ series: 900 }) === MAX_SERIES);
  ok('un negativo no rompe', seriesDe({ series: -3 }) === 1);
}

console.log('\nCambiar el orden');
{
  /*
   * El orden no es decorativo: quien pone las muñecas antes del pino lo hace
   * para llegar al pino con las muñecas calientes.
   */
  const l = tres;
  ok('el primero al final', moverEjercicio(l, 0, 2).map((e) => e.id).join() === 'e2,e3,e1');
  ok('el último al principio', moverEjercicio(l, 2, 0).map((e) => e.id).join() === 'e3,e1,e2');
  ok('al mismo sitio no cambia nada', moverEjercicio(l, 1, 1) === l);
  ok('fuera de la lista no rompe', moverEjercicio(l, 0, 9).map((e) => e.id).join() === 'e1,e2,e3');
  ok('y no toca la lista original', l.map((e) => e.id).join() === 'e1,e2,e3');
}

console.log('\nLo que se lee debajo del nombre');
{
  ok('series y objetivo', textoDelEjercicio({ id: 'x', nombre: 'Pino', objetivo: '30 s', series: 5 }) === '5 series · 30 s');
  // El singular otra vez: "1 series" delata que nadie lo ha leído.
  ok('una serie, en singular', textoDelEjercicio({ id: 'x', nombre: 'Pino', objetivo: '30 s', series: 1 }) === '1 serie · 30 s');
  ok('sin series, solo el objetivo', textoDelEjercicio({ id: 'x', nombre: 'Pino', objetivo: '30 s' }) === '30 s');
  ok('sin objetivo, solo las series', textoDelEjercicio({ id: 'x', nombre: 'Pino', objetivo: '', series: 3 }) === '3 series');
  ok('sin nada, nada', textoDelEjercicio({ id: 'x', nombre: 'Pino', objetivo: '' }) === '');
}

console.log('\nMarcar y desmarcar');
{
  ok('marcar añade', conMarca([], 'e1', true).join() === 'e1');
  ok('desmarcar quita', conMarca(['e1', 'e2'], 'e1', false).join() === 'e2');
  // El doble toque en un móvil lento es lo normal, no la excepción.
  ok('marcar dos veces no duplica', conMarca(['e1'], 'e1', true).join() === 'e1');
  ok('desmarcar lo que no está no rompe', conMarca(['e1'], 'e9', false).join() === 'e1');
}

console.log('\nLo que se le dice');
{
  ok('completa, se dice y se para', /Hecha/i.test(textoDiario(progresoDiario(rutina(tres), dia(['e1','e2','e3']), AHORA))));
  // A medias NO es un fallo: en algo diario, dos de tres es un día bueno.
  const aMedias = textoDiario(progresoDiario(rutina(tres), dia(['e1']), AHORA));
  ok('a medias no riñe', !/fall|mal|pierdes|has roto/i.test(aMedias), aMedias);
  ok('y dice por dónde va', /1 de 3/.test(aMedias), aMedias);
  ok('sin ejercicios no dice nada', textoDiario(progresoDiario(rutina([]), dia([]), AHORA)) === '');
  // "1 cosas cortas" delata que nadie ha leído la pantalla.
  const unaSola = textoDiario(progresoDiario(rutina([tres[0]]), dia([]), AHORA));
  ok('con una sola, en singular', /Una cosa corta/.test(unaSola), unaSola);
  const dosOMas = textoDiario(progresoDiario(rutina(tres), dia([]), AHORA));
  ok('con varias, en plural', /3 cosas cortas/.test(dosOMas), dosOMas);
}

console.log('\nQuién puede tocarla (reglas)');
{
  /*
   * Se lee el bloque de cada colección ENTERO en vez de buscar con distancias.
   * Un regex de "esto a menos de 400 caracteres de aquello" falla en cuanto
   * alguien escribe un comentario en medio — y entonces lo que se rompe no es
   * la app, es el guardián, que es la peor forma de perder el tiempo.
   */
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const sinNotas = reglas.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const bloque = (nombre) => {
    const i = sinNotas.indexOf(`match /${nombre}/`);
    if (i < 0) return '';
    // Hasta el `match` siguiente: es donde acaba lo que decide esta colección.
    const j = sinNotas.indexOf('match /', i + 8);
    return sinNotas.slice(i, j < 0 ? undefined : j);
  };
  const rutinas = bloque('rutinasDiarias');
  const dias = bloque('rutinasDiariasDias');

  // El id del documento ES el uid del alumno: sin exigirlo, un entrenador
  // escribiría la rutina de un alumno ajeno poniendo su uid en el campo.
  ok('el id del documento es el del alumno',
    /request\.resource\.data\.clientId == clientId/.test(rutinas), rutinas.slice(0, 80));
  ok('la escribe el entrenador que dice SU perfil',
    /users\/\$\(clientId\)\)\.data\.get\('trainerId', ''\)\s*\n?\s*== request\.auth\.uid/.test(rutinas));
  /*
   * Y un alumno CON entrenador no se la reescribe. Quitarse el ejercicio que no
   * apetece dejaría a su entrenador creyendo que lo hace. Solo puede llevar la
   * suya quien no tiene entrenador. Esto se permitía, y lo cazó check-rules.
   */
  ok('él solo puede si NO tiene entrenador',
    /request\.auth\.uid == clientId[\s\S]{0,220}get\('trainerId', ''\) == ''/.test(rutinas), rutinas.slice(-260));

  // Lo hecho lo marca ÉL. Dar por hecho el ejercicio de otro no es una función,
  // es falsear su registro.
  ok('lo hecho solo lo escribe el alumno',
    /allow write:[\s\S]{0,200}request\.resource\.data\.clientId == request\.auth\.uid/.test(dias));
  ok('y el id del día también lleva su uid',
    /diaId\.split\('_'\)\[0\] == request\.auth\.uid/.test(dias));
  ok('su entrenador puede leerlo', /resource\.data\.trainerId == request\.auth\.uid/.test(dias));
}

console.log('\nTraerse un ejercicio de la biblioteca');
{
  /*
   * POR QUÉ EXISTE
   *
   * Antes había que escribir "Pino contra pared" y pegar el enlace del vídeo a
   * mano, para cada alumno, aunque el ejercicio ya estuviera en la biblioteca
   * con su nombre bien escrito y su vídeo puesto. Era trabajo repetido, y era
   * donde se colaban las erratas y los vídeos que nadie llegaba a poner.
   */
  const pino = { id: 'ej-pino', name: 'Pino contra pared', videoUrl: 'https://youtu.be/abc' };
  const traido = deLaBiblioteca(pino, 'id1');
  ok('se trae el nombre', traido.nombre === 'Pino contra pared');
  ok('y el vídeo', traido.video === 'https://youtu.be/abc');
  // De dónde salió: es lo que permite corregirlo después desde la biblioteca.
  ok('y de qué ejercicio salió', traido.exerciseId === 'ej-pino');

  /*
   * El objetivo y las series NO vienen de la biblioteca: son de este alumno y
   * de este momento —"30 s por lado", "5 series repartidas"—, no del ejercicio.
   */
  ok('el objetivo empieza vacío', traido.objetivo === '');
  ok('y sin series', traido.series === undefined);
  const conExtra = deLaBiblioteca(pino, 'id2', { objetivo: ' 30 s ', series: 5 });
  ok('pero se respeta lo que hubiera escrito', conExtra.objetivo === '30 s' && conExtra.series === 5);

  // Un ejercicio sin vídeo no deja el campo puesto a vacío ensuciando el documento.
  const sinVideo = deLaBiblioteca({ id: 'x', name: 'Movilidad' }, 'id3');
  ok('sin vídeo, no se guarda el campo', !('video' in sinVideo));

  // Repetido: se avisa. No se impide —hay quien programa el mismo dos veces con
  // objetivos distintos— pero casi siempre es un despiste.
  ok('se sabe si ya está puesto', yaEstaPuesto([traido], 'ej-pino') === true);
  ok('y si no', yaEstaPuesto([traido], 'otro') === false);
  // Uno escrito a mano no tiene de dónde venir, y no puede confundirse con nada.
  ok('lo escrito a mano no cuenta como puesto',
    yaEstaPuesto([{ id: 'a', nombre: 'Pino contra pared', objetivo: '' }], 'ej-pino') === false);
}

console.log('\nY al corregirlo en la biblioteca, se corrige aquí');
{
  /*
   * Es la otra mitad de traérselo. Sin esto, una falta de ortografía arreglada
   * en la biblioteca —o un vídeo cambiado— se quedaba para siempre en la rutina
   * diaria de todo el que ya lo tuviera puesto, y había que quitarlo y volverlo
   * a poner. Que es exactamente lo que esto venía a evitar.
   */
  const lista = [
    { id: 'a', exerciseId: 'ej-pino', nombre: 'Pino contra pare', objetivo: '30 s', video: 'v1' },
    { id: 'b', nombre: 'Escrito a mano', objetivo: '' },
  ];
  const arreglada = ejerciciosActualizados(lista, 'ej-pino', { nombre: 'Pino contra pared' });
  ok('se corrige el nombre', arreglada?.[0].nombre === 'Pino contra pared');
  ok('sin tocar lo escrito a mano', arreglada?.[1].nombre === 'Escrito a mano');
  ok('y sin perder el objetivo del alumno', arreglada?.[0].objetivo === '30 s');
  // El vídeo solo se toca si se manda: `undefined` es "no lo toques".
  ok('el vídeo se queda si no se manda', arreglada?.[0].video === 'v1');
  ok('se cambia si se manda',
    ejerciciosActualizados(lista, 'ej-pino', { nombre: 'Pino', video: 'v2' })?.[0].video === 'v2');
  // Y quitarlo es una orden: dejar el viejo sería enseñar una técnica retirada.
  const sinVideo = ejerciciosActualizados(lista, 'ej-pino', { nombre: 'Pino', video: '' });
  ok('y se quita si se manda vacío', sinVideo !== null && !('video' in sinVideo[0]));

  /*
   * Y no se escribe si no cambia nada: un entrenador con cuarenta alumnos que
   * corrige un ejercicio que solo usan tres no puede pagar cuarenta escrituras.
   */
  ok('sin cambios, no se escribe',
    ejerciciosActualizados(lista, 'ej-pino', { nombre: 'Pino contra pare' }) === null);
  ok('ni si el ejercicio no está', ejerciciosActualizados(lista, 'otro', { nombre: 'X' }) === null);
  ok('ni con la lista vacía', ejerciciosActualizados([], 'ej-pino', { nombre: 'X' }) === null);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
