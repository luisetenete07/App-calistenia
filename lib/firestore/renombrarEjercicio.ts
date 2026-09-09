import { collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { diasRenombrados, objetivosRenombrados } from '../renombrarEjercicio';
import { ejerciciosActualizados } from '../rutinaDiaria';
import type { Routine, RoutineTemplate, RutinaDiaria, TrainingCycle } from '../types';

/**
 * Llevar el nombre nuevo de un ejercicio a todo lo que lo tenía copiado.
 *
 * El porqué de que haya copias está en `lib/renombrarEjercicio.ts`. Aquí solo
 * está el recorrido: rutinas de los alumnos, plantillas del entrenador y
 * objetivos de los ciclos.
 *
 * SE ESCRIBE POCO A PROPÓSITO
 *
 * Se leen las tres colecciones enteras del entrenador, pero solo se escriben
 * los documentos donde el ejercicio aparece de verdad. Un entrenador con
 * cuarenta alumnos que corrige una falta en un ejercicio que solo usan tres no
 * paga cuarenta escrituras, paga tres. Por eso las funciones puras devuelven
 * `null` cuando no cambia nada.
 *
 * Y solo se llama cuando el nombre CAMBIA. Guardar un ejercicio para tocarle el
 * vídeo o la categoría no dispara ningún recorrido.
 *
 * VALE TAMBIÉN PARA EL ATLETA
 *
 * La cuenta de atleta usa esta misma pantalla de ejercicios y en sus datos es a
 * la vez entrenador y alumno de sí misma: su rutina lleva su propio uid en
 * `trainerId`. Así que pasando `trainerId = su uid` esto le funciona igual, sin
 * un camino aparte.
 */
export async function propagarNombreDeEjercicio(
  trainerId: string,
  ejercicioId: string,
  nombre: string,
  /*
   * El vídeo, cuando también ha cambiado.
   *
   * Solo lo necesitan las RUTINAS DIARIAS, que son las únicas que se traen el
   * enlace copiado; los planes guardan el identificador del ejercicio y leen el
   * vídeo de la biblioteca cada vez, así que ahí no hay nada que actualizar.
   *
   * `undefined` significa "no lo toques". Una cadena vacía sí es una orden: el
   * entrenador ha quitado el vídeo, y dejar el viejo puesto sería enseñar una
   * técnica que ha retirado a propósito.
   */
  video?: string
): Promise<number> {
  if (!trainerId || !ejercicioId || !nombre) return 0;

  const suyos = (nombreColeccion: string) =>
    getDocs(query(collection(db, nombreColeccion), where('trainerId', '==', trainerId)));

  const [rutinas, plantillas, ciclos, diarias] = await Promise.all([
    suyos('routines'),
    suyos('routineTemplates'),
    suyos('trainingCycles'),
    suyos('rutinasDiarias'),
  ]);

  const escrituras: Promise<unknown>[] = [];

  for (const d of rutinas.docs) {
    const dias = diasRenombrados((d.data() as Routine).days, ejercicioId, nombre);
    if (dias) escrituras.push(updateDoc(d.ref, { days: dias, updatedAt: Date.now() }));
  }

  for (const d of plantillas.docs) {
    const dias = diasRenombrados((d.data() as RoutineTemplate).days, ejercicioId, nombre);
    if (dias) escrituras.push(updateDoc(d.ref, { days: dias }));
  }

  for (const d of ciclos.docs) {
    const objetivos = objetivosRenombrados(
      (d.data() as TrainingCycle).objetivos,
      ejercicioId,
      nombre
    );
    if (objetivos) escrituras.push(updateDoc(d.ref, { objetivos, updatedAt: Date.now() }));
  }

  /*
   * Y las RUTINAS DIARIAS, que son las que se traen el ejercicio de la
   * biblioteca con su nombre y su vídeo copiados dentro. Sin esto, corregir una
   * falta o cambiar el enlace del vídeo dejaba lo viejo puesto en la rutina
   * diaria de todo el que ya lo tuviera, que es justo lo que esta función
   * existe para evitar.
   */
  for (const d of diarias.docs) {
    const lista = ejerciciosActualizados((d.data() as RutinaDiaria).ejercicios, ejercicioId, {
      nombre,
      video,
    });
    if (lista) escrituras.push(updateDoc(d.ref, { ejercicios: lista, updatedAt: Date.now() }));
  }

  await Promise.all(escrituras);
  return escrituras.length;
}
