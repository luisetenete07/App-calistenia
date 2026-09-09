/*
 * Los pasos, SIN datos de salud. Y que no vuelvan por la puerta de atrás.
 *
 * QUÉ PASÓ
 *
 * Para dar en Android los pasos del día entero —con la app cerrada— hay que
 * leerlos de Health Connect, y eso exige `android.permission.health.READ_STEPS`,
 * que Google trata como dato de salud y revisa a mano. Se implementó, se envió
 * con la declaración de apps de salud rellenada, y la revisión lo tumbó:
 *
 *   "Los siguientes permisos de Salud conectada no parecen necesarios para las
 *    funciones que ofrece actualmente tu aplicación: Steps"
 *
 * No era que pidiéramos de más —se pedía UN permiso y ninguno más— sino que el
 * revisor no encontró la función: el contador de pasos vive dentro de Progreso,
 * en la pestaña de Nutrición y hacia abajo, y una cuenta recién creada no tiene
 * ni entrenador ni plan con los que llegar hasta ahí.
 *
 * La decisión fue quitarlo. Para lo que da de sí —ahorrarle a alguien escribir
 * un número al día— no compensaba tener la publicación parada en revisiones.
 *
 * QUÉ VIGILA ESTE GUARDIÁN
 *
 * Que no vuelva sin querer. Un permiso de salud que reaparezca en el manifiesto
 * —por reinstalar el módulo, por copiar y pegar de una rama vieja— no se nota
 * al probar la app: se nota semanas después, cuando Play rechaza la versión y
 * el lanzamiento se para otra vez.
 *
 * Y que lo que SÍ queda siga en pie: el contador con el sensor, la lectura del
 * día entero en iPhone, y la cifra a mano, que no es el plan B —mucha gente
 * lleva reloj y su cifra buena está ahí—.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pasos-de-salud.mjs
 */
import { existsSync, readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const hay = (ruta) => existsSync(new URL(`../${ruta}`, import.meta.url));

console.log('\nNi un permiso de salud en el manifiesto');
{
  const app = JSON.parse(lee('app.json')).expo;
  const permisos = app.android?.permissions ?? [];
  const deSalud = permisos.filter((p) => /permission\.health\./i.test(p));
  ok('ningún android.permission.health.*', deSalud.length === 0, deSalud.join(', '));

  /*
   * El de ACTIVIDAD FÍSICA sí, y hace falta. No es un dato de salud de los que
   * revisa Google: es el permiso normal de Android para leer el sensor de
   * pasos, y sin él `Pedometer.requestPermissionsAsync()` devuelve que no en
   * Android 10 y posteriores. Faltaba desde siempre, así que el contador del
   * sensor no había funcionado nunca en un Android moderno.
   */
  ok('el de actividad física se queda', permisos.includes('android.permission.ACTIVITY_RECOGNITION'));

  const plugins = (app.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
  ok('el módulo de Health Connect no está enchufado', !plugins.includes('react-native-health-connect'));

  /*
   * EL MÍNIMO DE ANDROID SE QUEDA EN 26, AUNQUE YA NO HAGA FALTA
   *
   * Se subió a 26 porque Health Connect lo exigía. Al quitarlo, la tentación es
   * devolverlo al valor de Expo, pero eso no quita nada: AÑADE los móviles con
   * Android 7, que no han ejecutado esta app en su vida. Las versiones 1.0.6 a
   * 1.0.9 ya se publicaron con 26, así que bajarlo ahora es estrenar terreno
   * nuevo en mitad de un lanzamiento a cambio de un puñado de móviles de 2016.
   *
   * Se puede bajar cuando haya calma y alguien pueda probarlo. Hasta entonces,
   * esto es una decisión, no un olvido.
   */
  const props = (app.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-build-properties');
  ok('el mínimo de Android sigue en 26, a propósito',
    props?.[1]?.android?.minSdkVersion === 26, JSON.stringify(props?.[1]));
}

console.log('\nNi rastro del módulo en el proyecto');
{
  const pkg = JSON.parse(lee('package.json'));
  const dependencias = { ...pkg.dependencies, ...pkg.devDependencies };
  ok('no está instalado', !('react-native-health-connect' in dependencias));
  ok('y su parte de lógica se fue con él', !hay('lib/pasosDeSalud.ts'));

  const contador = lee('components/ContadorDePasos.tsx');
  ok('el contador ya no lo llama', !/react-native-health-connect/.test(contador));
  /*
   * El porqué se queda escrito donde se toma la decisión. Sin eso, dentro de
   * seis meses alguien ve que en Android los pasos solo cuentan con la app
   * abierta, lo toma por un olvido, y vuelve a meter el permiso.
   */
  ok('y explica por qué no lo usa', /revisión lo tumbó|la revisión no lo aceptó/i.test(contador));
}

console.log('\nLo que sí hay, sigue funcionando');
{
  const contador = lee('components/ContadorDePasos.tsx');
  // iPhone: el día entero, con la app cerrada incluida. Eso no lo toca esto.
  ok('en iPhone se sigue leyendo el día entero', /getStepCountAsync/.test(contador));
  // Android: el sensor, y lo andado se SUMA a lo que ya hubiera del día.
  ok('en Android se escucha el sensor', /watchStepCount/.test(contador));
  ok('y lo andado se suma, no sustituye', /acumulativo: true/.test(contador));
  // Y a mano, que es lo que hace que esto funcione para quien lleva reloj.
  ok('y se puede escribir a mano', /'mano'/.test(contador));
  // Sin prometer lo que ya no se hace.
  ok('no se manda a nadie a instalar Health Connect', !/Instálalo desde Google Play/.test(contador));
  /*
   * Y sin dar a entender que cuenta con la app cerrada. "Se leen solos de este
   * móvil" era verdad con Health Connect; sin él, quien salga a andar sin abrir
   * UDECA vuelve creyendo que el contador está roto.
   */
  ok('en Android se dice que cuenta con la app abierta',
    /'Se cuentan con la app abierta'/.test(contador) && !/'Se leen solos de este móvil'/.test(contador));
}

console.log('\nY la política de privacidad dice lo que la app hace HOY');
{
  /*
   * Esto es lo que Google lee. Una política que siga hablando de Health Connect
   * cuando la app ya no lo usa es una contradicción con la declaración de datos,
   * y es de las cosas que se quedan viejas sin que salte nada.
   *
   * Está en DOS sitios: la web pública —la que ve Google— y la pantalla de
   * dentro de la app, que es la que ve el usuario. Las dos tienen que decir lo
   * mismo.
   */
  for (const [ruta, quien] of [
    ['web/privacidad.html', 'la de la web, que es la que mira Google'],
    ['app/privacy-policy.tsx', 'la de dentro de la app'],
  ]) {
    const t = lee(ruta);
    ok(`${quien}: ya no promete leer de Health Connect`,
      !/(a través de|through)[^.]{0,40}Health Connect/i.test(t));
    ok(`${quien}: dice que en Android NO se usa`, /[Nn]o usamos Health Connect|do not[\s\S]{0,20}use Health Connect/.test(t));
    ok(`${quien}: sigue diciendo qué se lee`, /pasos|steps/i.test(t));
    // Lo que Google mira con lupa y sigue siendo verdad.
    ok(`${quien}: descarta publicidad y venta`, /publicidad|advertising/i.test(t) && /(vende|sold|comparte con terceros)/i.test(t));
    ok(`${quien}: dice cómo retirar el permiso`, /retirar el permiso|withdraw the permission/i.test(t));
  }
  ok('la fecha está al día', /Última actualización: septiembre/.test(lee('web/privacidad.html')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
