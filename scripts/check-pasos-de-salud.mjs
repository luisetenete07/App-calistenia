/*
 * Los pasos del móvil en Android, con la app cerrada.
 *
 * DE DÓNDE SALE ESTO
 *
 * En iPhone la app pregunta al teléfono por el día entero y ya estaba. En
 * Android no había manera: `expo-sensors` contesta literalmente "Getting step
 * count for date range is not supported on Android yet", así que solo se podía
 * escuchar el sensor mientras UDECA estaba delante. Quien abría la app a las
 * ocho de la tarde tenía, para nosotros, los pasos de esos cuatro segundos.
 *
 * Ahora se leen de Health Connect, el almacén de salud del sistema. Lo que se
 * protege aquí son las cuatro formas de romperlo sin que salte ningún error:
 *
 *  - Confundir CERO con NO SÉ. Cero es "hoy no has andado" y se guarda; nada es
 *    "no me lo han dicho", y guardarlo pondría el día a cero por un fallo de
 *    permisos.
 *  - Dar por bueno un permiso que no es. `requestPermission` devuelve lo
 *    concedido, no lo pedido: si el usuario dice que no, la lista vuelve vacía
 *    y hay que enterarse.
 *  - Preguntar a Health Connect DESPUÉS del sensor. Un móvil sin sensor de
 *    pasos se salía por el `return` de arriba y nunca llegaba a preguntar,
 *    aunque Health Connect tuviera el día entero guardado.
 *  - Quedarse sin declarar los permisos en el manifiesto, que es lo que hace
 *    que la petición falle en silencio.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pasos-de-salud.mjs
 */
import { readFileSync } from 'node:fs';
import {
  hayPermisoDePasos,
  pasosDelResultado,
  PERMISO_DE_PASOS,
  porQueNoHaySalud,
  rangoDelDia,
  SALUD_DISPONIBLE,
  SALUD_HAY_QUE_ACTUALIZARLA,
  SALUD_NO_DISPONIBLE,
  saludUtilizable,
} from '../lib/pasosDeSalud.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nCuándo se puede usar Health Connect');
{
  ok('disponible, sí', saludUtilizable(SALUD_DISPONIBLE));
  ok('sin instalar, no', !saludUtilizable(SALUD_NO_DISPONIBLE));
  ok('desactualizado, tampoco', !saludUtilizable(SALUD_HAY_QUE_ACTUALIZARLA));
  // Lo que no es ninguno de los tres tampoco vale: un `undefined` colándose
  // como "disponible" acabaría en una excepción tres líneas después.
  ok('cualquier otra cosa, no', !saludUtilizable(undefined) && !saludUtilizable('3'));

  /*
   * Y cada caso con su salida. "No se han podido leer los pasos" a secas deja a
   * la persona sin saber si el fallo es suyo, del móvil o nuestro.
   */
  ok('si hay que actualizarlo, se dice', /Actualiza Health Connect/.test(porQueNoHaySalud(SALUD_HAY_QUE_ACTUALIZARLA)));
  ok('si no lo tiene, se ofrece la salida', /a mano/.test(porQueNoHaySalud(SALUD_NO_DISPONIBLE)));
}

console.log('\nEl permiso: se mira lo CONCEDIDO, no lo pedido');
{
  ok('solo se pide leer los pasos',
    PERMISO_DE_PASOS.accessType === 'read' && PERMISO_DE_PASOS.recordType === 'Steps');
  ok('con el permiso, sí', hayPermisoDePasos([{ accessType: 'read', recordType: 'Steps' }]));
  // Si el usuario dice que no, la lista vuelve vacía. Ese es el caso real.
  ok('sin nada concedido, no', !hayPermisoDePasos([]));
  // Permiso de otra cosa no es permiso de pasos.
  ok('otro dato no vale', !hayPermisoDePasos([{ accessType: 'read', recordType: 'Weight' }]));
  // Poder ESCRIBIR pasos no es poder leerlos.
  ok('escribir no es leer', !hayPermisoDePasos([{ accessType: 'write', recordType: 'Steps' }]));
  ok('una respuesta rara no se da por buena', !hayPermisoDePasos(undefined) && !hayPermisoDePasos('sí'));
}

console.log('\nCero y "no sé" no son lo mismo');
{
  ok('un número se lee', pasosDelResultado({ COUNT_TOTAL: 8432 }) === 8432);
  // Cero es un dato: hoy no se ha andado.
  ok('el cero es un dato', pasosDelResultado({ COUNT_TOTAL: 0 }) === 0);
  /*
   * Y todo lo demás es "no sé". Devolver cero aquí es lo que pondría el día a
   * cero cuando lo que ha fallado es la lectura.
   */
  ok('sin respuesta, no sé', pasosDelResultado(undefined) === null);
  ok('sin el campo, no sé', pasosDelResultado({}) === null);
  ok('un texto no es un número', pasosDelResultado({ COUNT_TOTAL: '8432' }) === null);
  ok('ni un negativo', pasosDelResultado({ COUNT_TOTAL: -3 }) === null);
  ok('los decimales se redondean', pasosDelResultado({ COUNT_TOTAL: 8432.6 }) === 8433);
}

console.log('\nEl día que se pregunta');
{
  const desde = Date.UTC(2026, 8, 5, 0, 0, 0);
  const hasta = Date.UTC(2026, 8, 5, 20, 30, 0);
  const r = rangoDelDia(desde, hasta);
  ok('es un rango cerrado', r.operator === 'between');
  ok('en el formato que pide', r.startTime === '2026-09-05T00:00:00.000Z' && r.endTime === '2026-09-05T20:30:00.000Z');
}

console.log('\nEstá enganchado, y en el orden correcto');
{
  const c = lee('components/ContadorDePasos.tsx');
  ok('se lee de Health Connect', /leerDeHealthConnect/.test(c));
  /*
   * ANTES del sensor. Si se preguntara después, un móvil sin contador de pasos
   * —o cuyo dueño niegue el permiso de actividad— se saldría por el `return` de
   * `isAvailableAsync` sin llegar a preguntar nunca.
   */
  ok('se pregunta antes que al sensor',
    c.indexOf('leerDeHealthConnect(enSilencio)') < c.indexOf("require('expo-sensors')"),
    'el sensor decide antes, y un móvil sin sensor se queda sin pasos');
  // Solo en Android: en iPhone ya se leía el día entero y no hay que tocarlo.
  ok('solo en Android', /Platform\.OS === 'android'/.test(c));
  // Un fallo aquí no puede dejar sin pasos a nadie: se cae al sensor.
  ok('si falla, se cae al sensor', /catch \{[\s\S]{0,200}?return null;/.test(c));
}

console.log('\nY declarado donde Android lo mira');
{
  const app = JSON.parse(lee('app.json')).expo;
  const permisos = app.android?.permissions ?? [];
  // Sin declararlo, la petición de permiso falla en silencio: no se puede pedir
  // lo que no está en el manifiesto.
  ok('el permiso de pasos está declarado', permisos.includes('android.permission.health.READ_STEPS'));
  /*
   * Y el de actividad, que faltaba desde siempre. Sin él,
   * `Pedometer.requestPermissionsAsync()` devuelve que no en Android 10 y
   * posteriores — o sea, que el contador del sensor tampoco había funcionado
   * nunca.
   */
  ok('y el de actividad, que faltaba', permisos.includes('android.permission.ACTIVITY_RECOGNITION'));

  const plugins = (app.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
  ok('el módulo está enchufado', plugins.includes('react-native-health-connect'));
  /*
   * Health Connect exige Android 8 (API 26) y Expo trae 24 por defecto. Sin
   * subirlo, la compilación de Android falla entera.
   */
  const props = (app.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-build-properties');
  ok('y el mínimo de Android sube a 26', props?.[1]?.android?.minSdkVersion === 26, JSON.stringify(props?.[1]));

  /*
   * Y con tope de versión. Es un módulo NATIVO y el SDK de Expo no lo gestiona,
   * así que el `^` que pone npm por defecto autorizaría cualquier versión mayor
   * futura — o sea, una app que deja de arrancar sin que nadie la haya tocado.
   * Es exactamente lo que ya pasó con gesture-handler y la 3.0.
   */
  const version = JSON.parse(lee('package.json')).dependencies['react-native-health-connect'];
  ok('sin rango que se abra solo', typeof version === 'string' && !version.startsWith('^'), version);
}


console.log('\nY contado en la política de privacidad');
{
  /*
   * Google TUMBA la declaración de datos de salud si la política enlazada no
   * menciona Health Connect y qué se hace con lo que se lee. Y es de las cosas
   * que se quedan viejas sin que salte nada: el código lee pasos y el texto
   * sigue hablando de lo de antes.
   *
   * Está en DOS sitios —la web pública y la pantalla de dentro de la app— y las
   * dos tienen que decir lo mismo: la de la web es la que ve Google, la de la
   * app es la que ve el usuario.
   */
  for (const [ruta, quien] of [
    ['web/privacidad.html', 'la de la web, que es la que mira Google'],
    ['app/privacy-policy.tsx', 'la de dentro de la app'],
  ]) {
    const t = lee(ruta);
    ok(`${quien}: nombra Health Connect`, /Health Connect/.test(t));
    ok(`${quien}: dice que solo se leen los pasos`, /pasos/i.test(t) && /[Ss]olo leemos|no escribe/.test(t));
    // Lo que Google mira con lupa: que no se venda ni se use para publicidad.
    ok(`${quien}: descarta publicidad y venta`, /publicidad/i.test(t) && /(vende|comparte con terceros)/i.test(t));
    // Y cómo se corta, que es el derecho que tiene que poder ejercer.
    ok(`${quien}: dice cómo retirar el permiso`, /retirar el permiso|withdraw the permission/i.test(t));
  }
  // La fecha es lo que dice si la política cubre lo que la app hace HOY.
  ok('la fecha está al día', /Última actualización: septiembre/.test(lee('web/privacidad.html')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
