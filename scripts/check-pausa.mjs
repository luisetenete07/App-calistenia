/*
 * Comprobación de las pausas del plan (lib/pausa.ts).
 *
 * Lo que se protege aquí es que "vuelve al plan con normalidad" sea verdad. La
 * parte delicada es el congelado del ciclo: si se calcula de más, el alumno
 * repite un día; si se calcula de menos, se salta uno que nunca entrenó. Las
 * dos cosas se notan a la primera semana y las dos hacen dudar del plan entero,
 * que es lo único que un alumno no puede permitirse dudar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pausa.mjs
 */
import {
  conPausaNueva,
  cubre,
  diasDePausa,
  diasQueQuedan,
  duracionEnDias,
  pausaActiva,
  podarPausas,
  terminadaHoy,
  textoRango,
} from '../lib/pausa.ts';
import { anclaParaIndice, diasCongeladosEntre, indiceDelCiclo } from '../lib/ciclo.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo, las fechas de estas comprobaciones saldrían en inglés y el
// resultado dependería de dónde se ejecuten.
setIdioma('es');

const DIA = 24 * 60 * 60 * 1000;
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}
/** Lunes 3 de agosto de 2026, 00:00. */
const LUNES = new Date(2026, 7, 3).getTime();
const dia = (n) => LUNES + n * DIA;
const pausa = (d0, d1, extra = {}) => ({
  desde: dia(d0),
  hasta: dia(d1),
  porQuien: 'coach',
  creadaEn: LUNES,
  ...extra,
});

console.log('\nLo básico de un rango');
{
  const p = pausa(0, 2); // lunes a miércoles
  comprueba('tres días', duracionEnDias(p) === 3, String(duracionEnDias(p)));
  comprueba('un solo día también vale', duracionEnDias(pausa(0, 0)) === 1);
  comprueba('el lunes entra', cubre(p, dia(0)));
  comprueba('el miércoles entra (el último se incluye)', cubre(p, dia(2)));
  comprueba('el jueves ya no', !cubre(p, dia(3)));
  comprueba('el domingo anterior tampoco', !cubre(p, dia(-1)));
  comprueba('a media tarde sigue contando', cubre(p, dia(1) + 17 * 60 * 60 * 1000));
}

console.log('\nCuál está activa y cuánto queda');
{
  const ps = [pausa(0, 2)];
  comprueba('el martes hay pausa', pausaActiva(ps, dia(1)) !== null);
  comprueba('el jueves ya no', pausaActiva(ps, dia(3)) === null);
  comprueba('sin pausas, ninguna', pausaActiva(undefined, dia(1)) === null);
  comprueba('el lunes quedan 3 días', diasQueQuedan(ps[0], dia(0)) === 3);
  comprueba('el miércoles queda 1 (hoy)', diasQueQuedan(ps[0], dia(2)) === 1);
  comprueba('sin pausa, 0', diasQueQuedan(null, dia(0)) === 0);
}

console.log('\nLa racha: los días de pausa no cuentan ni rompen');
{
  const ps = [pausa(0, 2)];
  const enMiercoles = diasDePausa(ps, dia(2));
  comprueba('el miércoles ya van 3 días', enMiercoles.length === 3);
  comprueba(
    'y son lunes, martes y miércoles',
    enMiercoles.join() === [dia(0), dia(1), dia(2)].join()
  );
  comprueba(
    'el lunes solo cuenta el lunes: los que no han llegado no valen',
    diasDePausa(ps, dia(0)).length === 1
  );
}

console.log('\nEl congelado del ciclo (la parte que hay que clavar)');
{
  // Ciclo de 3 días que arranca el lunes: L=día1, M=día2, X=día3, J=día1...
  const CICLO = 3;
  const sinPausa = (n) => indiceDelCiclo(LUNES, CICLO, dia(n));
  comprueba('sin pausa, el lunes es el día 1', sinPausa(0) === 0);
  comprueba('sin pausa, el jueves vuelve al día 1', sinPausa(3) === 0);

  // Pausa de lunes a miércoles: al volver el JUEVES tiene que tocarle el día
  // que le tocaba el lunes (el 1), no el que le tocaría sin pausa.
  //
  // Dentro de la pausa el índice no se mira: esos días la app no propone
  // sesión ninguna, dice "en pausa". Lo que tiene que estar clavado es el día
  // de VOLVER y todos los siguientes, que es lo que aquí se comprueba.
  const ps = [pausa(0, 2)];
  const con = (n) => indiceDelCiclo(LUNES, CICLO, dia(n), ps);
  comprueba('durante la pausa hay pausa activa, no día', pausaActiva(ps, dia(1)) !== null);
  comprueba('el jueves retoma el día 1, el que se dejó', con(3) === 0, String(con(3)));
  comprueba('el viernes ya es el día 2', con(4) === 1, String(con(4)));
  comprueba('el sábado, el día 3', con(5) === 2, String(con(5)));
  comprueba(
    'una semana después sigue cuadrando',
    con(10) === 1,
    `${con(10)}`
  );

  comprueba('días congelados el jueves: los 3 de la pausa', diasCongeladosEntre(LUNES, ps, dia(3)) === 3);
  comprueba('y no crecen después', diasCongeladosEntre(LUNES, ps, dia(30)) === 3);

  /*
   * Y LA PAUSA NO SE COBRA DOS VECES.
   *
   * Este era el fallo que traía a los alumnos de cabeza. El congelado se
   * calculaba sumando TODA la pausa acumulada desde siempre, así que quien
   * hubiera tenido tres días de baja arrastraba esos tres días para siempre:
   * pulsaba "reiniciar el ciclo", pedía el Día 1 y le salía el Día 3.
   *
   * Una pausa anterior al arranque del ciclo no puede moverlo.
   */
  const anclaNueva = anclaParaIndice(0, ps, dia(10));
  comprueba('reiniciar después de una pausa deja el Día 1', indiceDelCiclo(anclaNueva, CICLO, dia(10), ps) === 0);
  comprueba('y al día siguiente el Día 2', indiceDelCiclo(anclaNueva, CICLO, dia(11), ps) === 1);

  // Y fijar un día concreto cuenta los días de pausa que hay por el camino.
  const enPausa = [pausa(9, 9)];
  const fijado = anclaParaIndice(2, enPausa, dia(10));
  comprueba('fijar "hoy es el día 3" sale el día 3', indiceDelCiclo(fijado, CICLO, dia(10), enPausa) === 2);

  // Reiniciar ESTANDO de baja: hoy es el Día 1 igualmente.
  const hoyDeBaja = [pausa(8, 10)];
  const desdeLaBaja = anclaParaIndice(0, hoyDeBaja, dia(10));
  comprueba('reiniciar estando de baja deja el Día 1', indiceDelCiclo(desdeLaBaja, CICLO, dia(10), hoyDeBaja) === 0);
  // Y a partir de ahí el ciclo corre normal: quien dice "hoy es el Día 1"
  // está eligiendo el día de hoy, esté de baja o no.
  comprueba('y mañana el Día 2', indiceDelCiclo(desdeLaBaja, CICLO, dia(11), hoyDeBaja) === 1);
}

console.log('\nDos pausas seguidas se suman, y las solapadas no');
{
  const dos = conPausaNueva([pausa(0, 1)], pausa(5, 6));
  comprueba('dos pausas separadas conviven', dos.length === 2);
  comprueba('congelan 4 días en total', diasCongeladosEntre(dia(0), dos, dia(20)) === 4);

  // Una pausa nueva que pisa a otra la sustituye: si no, esos días
  // congelarían el ciclo dos veces y el alumno repetiría entrenos.
  const solapada = conPausaNueva([pausa(0, 3)], pausa(2, 5));
  comprueba('la que se solapa desaparece', solapada.length === 1);
  comprueba('queda la nueva', solapada[0].desde === dia(2) && solapada[0].hasta === dia(5));
  comprueba('congela 4 días, no 8', diasCongeladosEntre(dia(0), solapada, dia(20)) === 4);
  comprueba('quedan ordenadas por fecha', dos[0].desde < dos[1].desde);
}

console.log('\nTerminarla antes de tiempo');
{
  // El miércoles se corta una pausa de lunes a viernes: los tres días que ya
  // pasaron siguen congelados; jueves y viernes se recuperan.
  const cortada = terminadaHoy([pausa(0, 4)], dia(2));
  comprueba('no se borra, se recorta', cortada.length === 1);
  comprueba('acaba ayer (martes)', cortada[0].hasta === dia(1), String(cortada[0].hasta));
  comprueba('congela 2 días, los ya vividos', diasCongeladosEntre(dia(0), cortada, dia(10)) === 2);
  comprueba('y hoy ya no hay pausa', pausaActiva(cortada, dia(2)) === null);

  // Cortarla el mismo día que empieza sí la borra: no llegó a congelar nada.
  const mismoDia = terminadaHoy([pausa(0, 4)], dia(0));
  comprueba('cortada el primer día, desaparece', mismoDia.length === 0);
  comprueba('y no congela nada', diasCongeladosEntre(dia(0), mismoDia, dia(10)) === 0);
}

console.log('\nLas viejas se podan');
{
  const viejas = [pausa(0, 2), { ...pausa(0, 2), desde: dia(-300), hasta: dia(-298) }];
  const podadas = podarPausas(viejas, dia(0));
  comprueba('la de hace 300 días se va', podadas.length === 1);
  comprueba('la reciente se queda', podadas[0].desde === dia(0));
}

console.log('\nCómo se cuenta el rango');
{
  comprueba(
    'mismo mes',
    textoRango(pausa(0, 4)) === 'Del 3 al 7 de agosto',
    textoRango(pausa(0, 4))
  );
  comprueba(
    'un solo día',
    textoRango(pausa(0, 0)) === 'El 3 de agosto',
    textoRango(pausa(0, 0))
  );
  comprueba(
    'a caballo entre dos meses',
    textoRango(pausa(26, 31)) === 'Del 29 de agosto al 3 de septiembre',
    textoRango(pausa(26, 31))
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
