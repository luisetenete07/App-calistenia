/*
 * El plan por ciclos (días sueltos): lib/ciclo.ts.
 *
 * DE DÓNDE SALE ESTO
 *
 * De una queja de campo: "hay alumnos que ponen el cambio de día o el reinicio
 * al actual y les deja de funcionar". No era un fallo, eran cuatro, y todos
 * salían de lo mismo: la cuenta de qué día del ciclo toca estaba repartida por
 * tres ficheros que no se hablaban, y el desempate entre lo que decide el
 * alumno y lo que programa el coach se hacía cogiendo la fecha más grande.
 *
 * Los cuatro, reproducidos aquí abajo uno por uno:
 *
 *  1. Una pausa vieja seguía corriendo el ciclo para siempre. Con siete días de
 *     rueda y dos de baja el mes pasado, el alumno pulsaba "reiniciar" —pedía
 *     el Día 1— y le salía el Día 6.
 *  2. Fijar "hoy es el Día 5" guardaba una fecha FUTURA para ganar el desempate
 *     por fecha más grande. Así una elección de la semana pasada tumbaba a un
 *     reinicio de hace un minuto, y los dispositivos de una misma cuenta no se
 *     ponían de acuerdo nunca.
 *  3. Un coach que dejaba el plan preparado "para el lunes" guardaba una fecha
 *     futura que ganaba siempre: el alumno pulsaba "reiniciar" y no pasaba nada.
 *  4. El congelado por pausa se calculaba para HOY y se usaba también para
 *     mirar atrás (la racha) y adelante (los avisos), así que esas dos cuentas
 *     salían movidas.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ciclo.mjs
 */
import { readFileSync } from 'node:fs';
import {
  anclaEfectiva,
  anclaParaIndice,
  anclaQueManda,
  diasCongeladosEntre,
  indiceDelCiclo,
} from '../lib/ciclo.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const HOY = inicioDelDia(Date.now());
const dia = (n) => masDias(HOY, n);
const pausa = (a, b) => ({ desde: dia(a), hasta: dia(b), porQuien: 'alumno', creadaEn: HOY });

console.log('\nLa rueda gira, y gira igual hacia atrás y hacia delante');
{
  const ancla = dia(-4);
  ok('el día del ancla es el Día 1', indiceDelCiclo(ancla, 3, ancla) === 0);
  ok('cuatro días después, 4 % 3 = el segundo', indiceDelCiclo(ancla, 3, HOY) === 1);
  ok('y sigue girando mañana', indiceDelCiclo(ancla, 3, dia(1)) === 2);
  /*
   * Hacia atrás también. La racha recorre los días del pasado preguntando qué
   * tocaba en cada uno; si esta cuenta no valiera para ayer, la racha se
   * rompería sola.
   */
  ok('y hacia atrás', indiceDelCiclo(ancla, 3, dia(-3)) === 1 && indiceDelCiclo(ancla, 3, dia(-5)) === 2);
  ok('un ciclo sin días no revienta', indiceDelCiclo(ancla, 0, HOY) === 0);
}

console.log('\nFijar el día de hoy: ida y vuelta exactas');
{
  /*
   * Esto es lo que hace el selector de "hoy es el Día N". Tiene que salir el
   * día pedido para CUALQUIER largo de ciclo y CUALQUIER día, porque un ciclo
   * son tres días para uno y nueve para otro.
   */
  let todos = true;
  for (let largo = 1; largo <= 12; largo++) {
    for (let i = 0; i < largo; i++) {
      const a = anclaParaIndice(i);
      if (indiceDelCiclo(a, largo, HOY) !== i % largo) todos = false;
      // Y el ancla NUNCA es futura: es el día en que el ciclo empezó (fallo nº 2).
      if (a > HOY) todos = false;
    }
  }
  ok('de 1 a 12 días de ciclo, siempre sale el día pedido y sin fechas futuras', todos);
}

console.log('\nFallo nº 1: una pausa vieja no puede mover un ciclo nuevo');
{
  const vieja = [pausa(-8, -7)];
  const reinicio = anclaParaIndice(0, vieja);
  ok('reiniciar deja el Día 1', indiceDelCiclo(reinicio, 7, HOY, vieja) === 0);
  ok('y el ancla es hoy mismo', reinicio === HOY, String(reinicio));

  const cuarto = anclaParaIndice(3, vieja);
  ok('fijar el Día 4 deja el Día 4', indiceDelCiclo(cuarto, 7, HOY, vieja) === 3);

  // Lo que sí congela: la pausa que cae DENTRO del ciclo en curso.
  const dentro = [pausa(-2, -1)];
  const conPausa = anclaParaIndice(3, dentro);
  ok('una pausa de en medio se compensa al fijar el día',
    indiceDelCiclo(conPausa, 7, HOY, dentro) === 3);
  ok('y retrocede el ancla lo que dure la pausa', conPausa === dia(-5), String(conPausa));
}

console.log('\nFallo nº 4: el congelado se cuenta en su tramo, no el de hoy');
{
  const ps = [pausa(-3, -2)];
  const ancla = dia(-6);
  ok('antes de la pausa no congela nada', diasCongeladosEntre(ancla, ps, dia(-4)) === 0);
  ok('dentro de la pausa cuenta lo vivido', diasCongeladosEntre(ancla, ps, dia(-2)) === 2);
  ok('después ya no crece', diasCongeladosEntre(ancla, ps, dia(30)) === 2);
  // Una pausa anterior al ancla no cuenta: es la clave del fallo nº 1.
  ok('una pausa anterior al ancla no cuenta', diasCongeladosEntre(dia(-1), ps, HOY) === 0);
  // Y una pausa que aún no ha llegado tampoco: no ha congelado nada todavía.
  ok('una pausa futura tampoco', diasCongeladosEntre(ancla, [pausa(5, 6)], HOY) === 0);
  // Dos pausas que se pisan congelan los días una vez, no dos.
  ok('las solapadas no cuentan doble',
    diasCongeladosEntre(ancla, [pausa(-3, -2), pausa(-2, -1)], HOY) === 3);
}

console.log('\nFallo nº 2: entre dos móviles gana el último que habló');
{
  // El alumno fijó "hoy es el Día 5" ayer en el móvil, y hoy ha reiniciado en
  // la tablet. Antes ganaba el del móvil por tener la fecha más grande.
  const delMovil = { ancla: dia(-4), decididaEn: dia(-1) };
  const deLaTablet = { ancla: HOY, decididaEn: HOY };
  ok('gana el reinicio de hoy', anclaQueManda(delMovil, deLaTablet)?.ancla === HOY);
  ok('y da igual el orden', anclaQueManda(deLaTablet, delMovil)?.ancla === HOY);
  ok('si solo hay uno, ese', anclaQueManda(null, deLaTablet)?.ancla === HOY);
  ok('y si no hay ninguno, nada', anclaQueManda(null, null) === null);
  // Datos de versiones anteriores, sin fecha de decisión: se conserva lo que
  // hacía aquella versión (la fecha más grande) en vez de elegir al azar.
  ok('sin fecha de decisión, se conserva lo de antes',
    anclaQueManda({ ancla: dia(-1), decididaEn: 0 }, { ancla: dia(-3), decididaEn: 0 })?.ancla === dia(-1));
}

console.log('\nFallo nº 3: la fecha futura del coach no tumba al alumno');
{
  const alumno = { ancla: HOY, decididaEn: HOY };
  const preparadoParaElLunes = { cycleStartDate: dia(3), cycleStartDateSetAt: dia(-1) };
  ok('gana el alumno, que habló después', anclaEfectiva(preparadoParaElLunes, alumno) === HOY);

  // Y si el coach reprograma DESPUÉS, gana el coach: es su plan.
  const reprogramado = { cycleStartDate: dia(2), cycleStartDateSetAt: Date.now() + 1000 };
  ok('y el coach gana si reprograma después', anclaEfectiva(reprogramado, alumno) === dia(2));

  ok('sin ancla del alumno, la del coach', anclaEfectiva({ cycleStartDate: dia(-5) }, null) === dia(-5));
  ok('sin nada, cero (el ciclo empieza hoy)', anclaEfectiva(null, null) === 0);
  ok('sin fecha del coach, la del alumno', anclaEfectiva({}, alumno) === HOY);
}

console.log('\nY está enganchado donde tiene que estar');
{
  const anchor = lee('lib/cycleAnchor.ts');
  // La fecha de la decisión se guarda SIEMPRE: es lo único que permite saber
  // qué manda entre dos dispositivos.
  ok('el ancla se guarda con la fecha en que se decidió', /decididaEn: Date\.now\(\)/.test(anchor));
  // Y las dos pantallas del alumno miran lo mismo: el móvil y la cuenta.
  ok('se juntan el dispositivo y la cuenta', /anclaQueManda\(await getCycleAnchor/.test(anchor));

  const sync = lee('lib/firestore/sync.ts');
  ok('y las dos cosas se suben juntas',
    /cycleAnchors\.\$\{routineId\}`\]: ts,[\s\S]{0,120}cycleAnchorsSetAt/.test(sync));

  const entreno = lee('app/(client)/workout.tsx');
  const inicio = lee('app/(client)/dashboard.tsx');
  /*
   * Las dos pantallas que enseñan qué toca hoy tienen que usar la MISMA ancla.
   * La de inicio miraba solo la de este móvil: quien reiniciaba el ciclo en la
   * tablet veía un día en la portada y otro al entrar a entrenar.
   */
  ok('la portada usa el ancla de la cuenta, no solo la del móvil',
    /anclaDelAlumno\(routineData\.id, profile\)/.test(inicio));
  // Y ninguna de las dos vuelve a desplazar el ancla por su cuenta.
  ok('ya nadie desplaza el ancla a mano',
    !/anclaConPausas/.test(entreno) && !/anclaConPausas/.test(inicio));
  // Las pausas llegan a las dos: sin ellas el ciclo corre durante la baja.
  ok('las pausas llegan a la pantalla de entreno', /pausas: profile\?\.planPauses/.test(entreno));
  ok('y a la de inicio', /pausas: profile\?\.planPauses/.test(inicio));

  /*
   * La racha cuenta con lo mismo. Si mira otro día del ciclo que la pantalla,
   * da por saltado un entreno que era descanso y la rompe sin motivo.
   */
  const racha = lee('lib/stats.ts');
  ok('la racha usa la misma cuenta del ciclo', /indiceDelCiclo\(anchor, r\.days\.length, d, plan\?\.pausas\)/.test(racha));

  /*
   * Y el coach solo "reprograma" cuando cambia la fecha de verdad. Si cada
   * guardado contara como una reprogramación, corregir una serie le robaría al
   * alumno el día que él había fijado.
   */
  for (const [ruta, quien] of [
    ['app/(trainer)/clients/[id]/routine.tsx', 'el editor del coach'],
    ['app/(client)/my-plan.tsx', 'el plan del atleta'],
  ]) {
    const t = lee(ruta);
    ok(`${quien}: solo anota la fecha si cambia`,
      /cambioLaFecha = schedule === 'cycle' && cycleStartDate !== fechaAlAbrir\.current/.test(t));
    ok(`${quien}: y la manda al guardar`,
      /cycleStartDateSetAt: cambioLaFecha \? Date\.now\(\) : undefined/.test(t));
  }

  /*
   * Una plantilla es una ESTRUCTURA, no un calendario. Aplicando una guardada
   * en marzo, el ciclo arrancaba en marzo y al alumno le tocaba un día
   * cualquiera de la rueda sin que nada lo explicara.
   */
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('aplicar una plantilla no arrastra su fecha de inicio',
    !/if \(t\.cycleStartDate\) setCycleStartDate/.test(editor));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
