/*
 * El tamaño del vídeo ampliado (lib/visorDeVideo.ts).
 *
 * Lo que se protege: que el vídeo NO se salga de la pantalla. Si se saliera,
 * en un móvil se comería el botón de cerrar y quien entra a ver una técnica se
 * quedaría atrapado con un vídeo a pantalla completa y sin salida — que es
 * justo el escenario que este visor existe para evitar (la pantalla completa
 * del sistema tapa la marca de agua y el blindaje).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-visor.mjs
 */
import { readFileSync } from 'node:fs';
import {
  ALTO_MAXIMO,
  ANCHO_MAXIMO,
  mereceAmpliar,
  RELACION,
  tamanoDelVisor,
} from '../lib/visorDeVideo.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const cabe = (t, w, h) =>
  t.width <= Math.ceil(w * ANCHO_MAXIMO) && t.height <= Math.ceil(h * ALTO_MAXIMO);

console.log('\nNunca se sale de la pantalla');
{
  const pantallas = [
    ['móvil de pie', 390, 844],
    ['móvil tumbado', 844, 390],
    ['móvil pequeño', 320, 568],
    ['tablet', 834, 1112],
    ['portátil', 1440, 900],
    ['monitor grande', 2560, 1440],
    ['ventana estrecha', 300, 1200],
    ['ventana bajita', 1600, 400],
  ];
  for (const [nombre, w, h] of pantallas) {
    const t = tamanoDelVisor(w, h);
    comprueba(`${nombre} (${w}×${h})`, cabe(t, w, h), `${t.width}×${t.height}`);
  }
}

console.log('\nMantiene la forma del vídeo');
{
  for (const [w, h] of [[390, 844], [1440, 900], [1600, 400]]) {
    const t = tamanoDelVisor(w, h);
    comprueba(`16:9 en ${w}×${h}`, Math.abs(t.width / t.height - RELACION) < 0.02,
      `${t.width}×${t.height} = ${(t.width / t.height).toFixed(3)}`);
  }
  const cuadrado = tamanoDelVisor(1000, 1000, 1);
  comprueba('respeta otra relación si se le pide', Math.abs(cuadrado.width / cuadrado.height - 1) < 0.02,
    `${cuadrado.width}×${cuadrado.height}`);
}

console.log('\nEs de verdad más grande que lo de antes');
{
  // El motivo de existir: en un portátil el vídeo se veía en una columna de
  // 860 px. Si el visor no ganara nada, no haría falta.
  const t = tamanoDelVisor(1440, 900);
  comprueba('en un portátil gana ancho sobre los 860 de la columna', t.width > 860, String(t.width));
  const grande = tamanoDelVisor(2560, 1440);
  comprueba('en un monitor grande, mucho más', grande.width > 1600, String(grande.width));
}

console.log('\nNo se ofrece ampliar cuando no se gana nada');
{
  // En un móvil el vídeo ya ocupa casi todo: un botón para agrandarlo un 4 %
  // es un botón que miente.
  comprueba('en móvil no se ofrece', !mereceAmpliar(358, 390, 844), String(tamanoDelVisor(390, 844).width));
  comprueba('en un portátil sí', mereceAmpliar(828, 1440, 900));
  comprueba('en un monitor grande, también', mereceAmpliar(828, 2560, 1440));
}

console.log('\nNada raro rompe la cuenta');
{
  const cero = tamanoDelVisor(0, 0);
  comprueba('sin ventana no sale nada negativo', cero.width >= 0 && cero.height >= 0,
    `${cero.width}×${cero.height}`);
  const negativo = tamanoDelVisor(-100, -100);
  comprueba('medidas negativas se tratan como cero', negativo.width === 0 && negativo.height === 0,
    `${negativo.width}×${negativo.height}`);
  const sinRelacion = tamanoDelVisor(1440, 900, 0);
  comprueba('sin relación se usa la de siempre',
    Math.abs(sinRelacion.width / sinRelacion.height - RELACION) < 0.02);
}

console.log('\nNada por encima del reproductor que le quite el toque');
{
  /*
   * EL FALLO QUE ESTO CIERRA
   *
   * El vídeo colgaba de DOS pulsables: uno que envolvía la pantalla entera
   * para cerrar al tocar fuera, y otro rodeando el marco para que tocar el
   * vídeo no cerrara. En el ordenador eso funciona porque el navegador tiene
   * `stopPropagation`; en el móvil ese método NO EXISTE en el evento de React
   * Native, y quien decide de quién es el toque es el sistema de responders.
   * Un WebView debajo de dos pulsables es la receta conocida de "el vídeo se
   * ve pero el play no responde", que es justo como se vive desde fuera que
   * "el reproductor no funciona".
   *
   * Ahora el fondo va DETRÁS, como una capa suelta, y el marco del vídeo es una
   * View a secas.
   *
   *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-visor.mjs
   */
  const visor = readFileSync(new URL('../components/VisorDeVideo.tsx', import.meta.url), 'utf8');
  const marco = visor.slice(visor.indexOf('<Modal'), visor.indexOf('</Modal>'));

  comprueba(
    'el fondo que cierra va detrás, no envolviendo',
    /<Pressable style=\{StyleSheet\.absoluteFill\} onPress=\{onCerrar\} \/>/.test(marco)
  );
  comprueba(
    'el marco del vídeo es una View, no un pulsable',
    /<View style=\{\[styles\.marco/.test(marco) && !/<Pressable[^>]*styles\.marco/.test(marco)
  );
  // Y no queda ningún `stopPropagation`, que en móvil no hace nada y daba la
  // falsa sensación de tener el problema resuelto.
  comprueba('sin stopPropagation, que en móvil no existe', !/stopPropagation\?\.\(\)/.test(visor));
  // La marca de agua va encima del vídeo: si capturara toques, taparía el play.
  const marca = readFileSync(new URL('../components/MarcaDeAgua.tsx', import.meta.url), 'utf8');
  comprueba('la marca de agua deja pasar los toques', /styles\.capa\} pointerEvents="none"/.test(marca));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
