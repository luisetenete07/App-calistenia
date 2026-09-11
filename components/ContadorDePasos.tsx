import React, { useCallback, useEffect, useRef, useState } from 'react';
import { frase } from '../lib/idioma';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { Dialogo } from './Dialogo';
import { setStepLog, type StepLog } from '../lib/firestore/steps';
import { updateUserProfile } from '../lib/firestore/users';
import { useAuth } from '../lib/auth-context';
import { inicioDelDia } from '../lib/fechas';
import { conMiles } from '../lib/texto';
import {
  caloriasDePasos,
  mediaSemanal,
  OBJETIVO_POR_DEFECTO,
  pasosAGuardar,
  pasosDeHoy,
  progresoDePasos,
  sinElPasoFantasma,
  textoDePasos,
  ultimosSieteDias,
} from '../lib/pasos';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Cuánto espera la lectura automática antes de volver a leer.
 *
 * La lectura se dispara al abrir la pantalla y cada vez que la app vuelve al
 * frente, y eso último pasa mucho más de lo que parece: al cerrar un diálogo del
 * sistema, al volver del selector de fotos, al bajar la persiana de avisos. Cada
 * lectura escucha el sensor cuatro segundos, escribe en Firestore y hace que el
 * padre recargue la sección entera.
 *
 * Sin este plazo, tres idas y venidas seguidas son tres recargas de la pantalla
 * en diez segundos: desde fuera, parpadeo. Un minuto es de sobra —los pasos no
 * se miran al segundo— y deja la puerta abierta a leer otra vez en cuanto de
 * verdad haya pasado algo.
 */
const ESPERA_ENTRE_LECTURAS_MS = 60 * 1000;

/**
 * Los pasos del día, DENTRO de la tarjeta de hoy.
 *
 * Aquí y no en Progreso a propósito: los pasos no son entrenamiento, son el
 * gasto del resto del día, y es al lado de las calorías donde esa cifra
 * significa algo. Alguien que entrena cuatro horas a la semana y pasa las
 * otras ciento sesenta y cuatro sentado no tiene un problema de entrenamiento.
 *
 * Ya no es una tarjeta suya: eran tres tarjetas seguidas —peso, pasos,
 * macros— contando la misma historia por partes. Ahora los pasos suman a las
 * calorías del día en la misma cifra grande, que es lo único que se hace con
 * ellos.
 *
 * Quién guarda los registros: el padre. Los necesita para calcular el
 * presupuesto de calorías, y tenerlos cargados dos veces —aquí y allí— era
 * pedirle dos veces lo mismo a Firestore y arriesgarse a que las dos copias
 * no dijeran lo mismo.
 *
 * La cifra puede venir del contador del propio teléfono o escribirse a mano.
 * Lo segundo no es el plan B de lo primero: mucha gente lleva reloj, y un
 * contador que solo acepte lo que mide él deja fuera justo a quien más anda.
 */
export function ContadorDePasos({
  profile,
  pesoKg,
  registros,
  onCambio,
}: {
  profile: UserProfile;
  /** Último peso registrado, para estimar el gasto. Sin él no se estima nada. */
  pesoKg?: number;
  registros: StepLog[];
  /** Se llama tras guardar, para que el padre recargue y recalcule el día. */
  onCambio: () => void | Promise<void>;
}) {
  const [aMano, setAMano] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  /**
   * Una lectura a la vez, y no más de una por minuto sin pedirlo.
   *
   * En referencias y no en estado a propósito: son dos cosas que deciden si se
   * lee, no cosas que se pinten. En estado, cada una haría repintar la tarjeta
   * justo en el momento en el que se está intentando que no repinte tanto.
   */
  const leyendoRef = useRef(false);
  const ultimaAutomaticaRef = useRef(0);
  const [cambiando, setCambiando] = useState(false);
  const { refreshProfile } = useAuth();
  /** De dónde salen sus pasos. Vacío = todavía no lo ha elegido. */
  const origen = profile.stepsSource;

  const cargar = onCambio;

  const hoy = pasosDeHoy(registros);
  /*
   * LO MISMO, PERO EN UNA REFERENCIA. Y no es un capricho.
   *
   * `registros` es una lista NUEVA cada vez que el padre recarga, aunque los
   * pasos sean los mismos. La lectura automática la necesita para saber qué hay
   * guardado hoy, y mientras dependió de ella se montó este tiovivo:
   *
   *   leer el sensor → guardar → el padre recarga → lista nueva → leer otra vez
   *
   * Cada vuelta escribía en Firestore y repintaba la pantalla entera. Desde
   * fuera se ve exactamente como lo contó quien lo sufrió: "parpadea mucho y te
   * tira de la app".
   *
   * Con la referencia, la lectura sigue viendo el dato fresco —se actualiza en
   * cada pintado— pero ya no es motivo para volver a leer.
   */
  const registrosRef = useRef(registros);
  registrosRef.current = registros;
  const objetivo = profile.stepGoal ?? OBJETIVO_POR_DEFECTO;
  const p = progresoDePasos(hoy?.steps ?? 0, objetivo);
  const semana = ultimosSieteDias(registros);
  const media = mediaSemanal(registros);
  const kcal = caloriasDePasos(p.pasos, pesoKg);

  const guardar = async (pasos: number, origen: 'telefono' | 'mano') => {
    await setStepLog(profile.uid, Date.now(), pasos, origen, profile.trainerId);
    await cargar();
  };

  /**
   * Lee del contador del teléfono.
   *
   * En iPhone se le pregunta al propio teléfono por el día entero, con la app
   * cerrada incluida: esa cifra es la buena y sustituye a lo que hubiera.
   *
   * EN ANDROID NO HAY EQUIVALENTE, Y NO ES UN DESCUIDO
   *
   * Los pasos del día entero en Android viven en Health Connect, y leerlos
   * exige el permiso `READ_STEPS`, que Google trata como dato de salud y
   * revisa a mano. Se implementó, se envió, y la revisión lo tumbó: no
   * consideró que la app tuviera una función que justificara ese permiso.
   *
   * Se podía pelear —sacar el contador a la portada, grabar un vídeo de
   * demostración, otra ronda de revisión— o quitarlo y publicar. Para lo que
   * da de sí (ahorrarle a alguien escribir un número al día) no compensaba
   * tener la app parada, así que se quitó entero: el módulo, el permiso y la
   * declaración.
   *
   * Lo que queda en Android es el sensor, que solo cuenta con la app delante y
   * por eso SUMA en vez de sustituir, y escribir la cifra a mano. Escribirla a
   * mano no es el plan B: mucha gente lleva reloj y su cifra buena está ahí.
   */
  const leerDelTelefono = async ({ enSilencio = false } = {}) => {
    if (Platform.OS === 'web') {
      if (enSilencio) return;
      showToast('El contador del móvil solo está en la app de iPhone o Android');
      return;
    }
    // Dos lecturas a la vez son dos suscripciones al sensor y dos escrituras
    // con el mismo dato. Pasaba al volver a la app justo después de abrirla.
    if (leyendoRef.current) return;
    leyendoRef.current = true;
    // El aviso de "leyendo" es solo para quien lo ha pedido: encenderlo en las
    // lecturas automáticas hacía parpadear la tarjeta sola, cada vez que la app
    // volvía al frente, sin que nadie hubiera tocado nada.
    if (!enSilencio) setLeyendo(true);
    try {
      const Pedometer = require('expo-sensors').Pedometer;
      if (!(await Pedometer.isAvailableAsync())) {
        if (!enSilencio) showToast('Este móvil no tiene contador de pasos');
        return;
      }
      /*
       * PEDIR EL PERMISO ES COSA DE QUIEN PULSA, NO DE LA APP SOLA.
       *
       * `requestPermissionsAsync` abre el diálogo del sistema si todavía no se
       * ha concedido, y en Android ese diálogo manda la app al fondo y la
       * devuelve al frente al cerrarse. Lo malo es quién escucha esa vuelta:
       * este mismo componente, que reacciona leyendo otra vez... y volviendo a
       * pedir el permiso. El resultado es el diálogo saliendo una y otra vez
       * sobre una pantalla que no para de repintarse.
       *
       * En las lecturas automáticas solo se MIRA si ya está concedido. Si no lo
       * está, no se lee y no se enseña nada: ya lo pedirá el propio alumno
       * cuando conecte el contador o pulse actualizar, que es cuando el diálogo
       * tiene sentido porque acaba de pedirlo él.
       */
      const permiso = enSilencio
        ? await Pedometer.getPermissionsAsync()
        : await Pedometer.requestPermissionsAsync();
      if (!permiso.granted) {
        if (!enSilencio) showToast('Sin permiso de actividad no se pueden leer los pasos');
        return;
      }
      if (Platform.OS === 'ios') {
        /*
         * En iPhone se le puede preguntar al teléfono por el día entero, con
         * la app cerrada incluida: esta cifra es la buena y manda sobre lo que
         * hubiera (salvo que sea menor, ver `pasosAGuardar`).
         */
        const { steps } = await Pedometer.getStepCountAsync(
          new Date(inicioDelDia(Date.now())),
          new Date()
        );
        const leidos = Math.max(0, Math.round(Number(steps) || 0));
        // Cero no es un éxito: o no se ha andado, o el teléfono no lo está
        // guardando. Decir "actualizado" ahí es lo que hace que alguien se
        // quede pensando que la app cuenta mal.
        if (leidos === 0) {
          if (!enSilencio) {
            showToast(
              'Tu iPhone no tiene pasos guardados de hoy. Comprueba en Ajustes › Privacidad › Movimiento y forma física.'
            );
          }
          return;
        }
        const deHoy = pasosDeHoy(registrosRef.current);
        const aGuardar = pasosAGuardar(deHoy, leidos, { acumulativo: false });
        // En la lectura automática, si no cambia nada no se escribe: cada
        // escritura hace recargar la pantalla entera al padre.
        if (enSilencio && aGuardar === (deHoy?.steps ?? 0)) return;
        await guardar(aGuardar, 'telefono');
        if (!enSilencio) showToast(frase`Traídos ${conMiles(leidos)} pasos de tu iPhone`);
        return;
      }

      /*
       * ANDROID: SOLO EL SENSOR, Y SOLO CON LA APP DELANTE
       *
       * `expo-sensors` no sabe dar los pasos de un día entero en Android —el
       * módulo contesta literalmente "Getting step count for date range is not
       * supported on Android yet"—, así que lo único que hay es escuchar el
       * sensor mientras UDECA está abierta.
       *
       * Se escucha un momento y lo andado se SUMA a lo que ya hubiera, porque
       * sustituirlo borraría la mañana de quien abre UDECA por la tarde. Y se
       * descuenta el paso fantasma que regala el módulo (ver
       * `sinElPasoFantasma` en lib/pasos.ts): era el que ponía "1 paso" a todo
       * el mundo.
       */
      const contados = sinElPasoFantasma(
        await new Promise<number>((resolve) => {
          let ultimo = 0;
          const sub = Pedometer.watchStepCount((r: { steps: number }) => {
            ultimo = r.steps;
          });
          setTimeout(() => {
            sub.remove();
            resolve(ultimo);
          }, 4000);
        })
      );
      if (contados === 0) {
        // Sin dar nada por leído: guardar un cero no aporta y encima marca el
        // día como si viniera del teléfono.
        if (!enSilencio) {
          showToast(
            'En Android los pasos solo se cuentan con la app abierta. Escribe los del día a mano y quedan guardados igual.'
          );
        }
        return;
      }
      const deHoyAndroid = pasosDeHoy(registrosRef.current);
      const sumado = pasosAGuardar(deHoyAndroid, contados, { acumulativo: true });
      // Igual que en iPhone: en la lectura automática, si el número no cambia
      // no se escribe. Cada escritura hace recargar la sección entera al padre.
      if (enSilencio && sumado === (deHoyAndroid?.steps ?? 0)) return;
      await guardar(sumado, 'telefono');
      if (!enSilencio) {
        showToast(frase`Sumados ${conMiles(contados)} pasos andados con la app abierta`);
      }
    } catch {
      if (!enSilencio) showToast('No se ha podido leer el contador del móvil');
    } finally {
      leyendoRef.current = false;
      if (!enSilencio) setLeyendo(false);
    }
  };

  /**
   * Elegir de dónde salen los pasos. Se guarda EN LA CUENTA, una sola vez.
   *
   * Al elegir el móvil se lee ya mismo, sin esperar a mañana: quien acaba de
   * conectarlo quiere ver sus pasos ahora, y una función que no enseña nada al
   * activarla parece que no ha hecho nada.
   */
  const conectar = async (cual: 'telefono' | 'mano') => {
    setCambiando(false);
    try {
      await updateUserProfile(profile.uid, { stepsSource: cual });
      await refreshProfile();
    } catch {
      showToast('No se ha podido guardar');
      return;
    }
    if (cual === 'telefono') await leerDelTelefono();
  };

  /**
   * LOS PASOS APARECEN SOLOS.
   *
   * Con el móvil conectado se lee al abrir la pantalla y cada vez que se vuelve
   * a la app. No hay que pulsar nada nunca más: eso era lo que hacía que el
   * contador se abandonara a los tres días.
   *
   * Se lee también al volver del segundo plano porque es justo cuando han
   * pasado cosas: se ha salido a andar con el móvil en el bolsillo y al volver
   * a UDECA la cifra tiene que estar puesta.
   *
   * En silencio: nadie ha pedido nada, así que ningún aviso por pantalla. Y sin
   * escribir si el número no cambia, para no hacer recargar la pantalla entera
   * por nada.
   */
  const leerSiToca = useCallback(() => {
    if (origen !== 'telefono' || Platform.OS === 'web') return;
    // Volver al frente pasa muchas veces seguidas (un diálogo del sistema, la
    // persiana de avisos, el selector de fotos). Leer en cada una es escribir y
    // recargar la sección en cada una, y eso se ve como parpadeo.
    const ahora = Date.now();
    if (ahora - ultimaAutomaticaRef.current < ESPERA_ENTRE_LECTURAS_MS) return;
    ultimaAutomaticaRef.current = ahora;
    leerDelTelefono({ enSilencio: true }).catch(() => {});
    /*
     * SOLO EL ORIGEN. Ni `leerDelTelefono` ni `registros`.
     *
     * `leerDelTelefono` se recrea en cada pintado, así que meterlo aquí
     * dispararía el efecto sin parar. Y `registros` era peor todavía, porque
     * cerraba el círculo: leer acaba guardando, guardar hace recargar al padre,
     * y el padre devuelve una lista nueva que volvía a disparar la lectura.
     * Los pasos de hoy se miran ahora por referencia (`registrosRef`), que da
     * el dato fresco sin ser un motivo para volver a leer.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen]);

  useEffect(() => {
    leerSiToca();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') leerSiToca();
    });
    return () => sub.remove();
  }, [leerSiToca]);

  const guardarAMano = async () => {
    const n = Number.parseInt(aMano, 10);
    if (!Number.isFinite(n) || n < 0) {
      showToast('Escribe cuántos pasos has dado');
      return;
    }
    await guardar(n, 'mano');
    setAMano('');
    showToast('Pasos guardados');
    // Quien escribe sus pasos ya ha elegido, aunque no haya tocado el selector.
    if (!origen) {
      updateUserProfile(profile.uid, { stepsSource: 'mano' })
        .then(() => refreshProfile())
        .catch(() => {});
    }
  };

  const maximo = Math.max(objetivo, ...semana.map((d) => d.steps), 1);

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Pasos de hoy</Text>

      <View style={styles.cabecera}>
        <ProgressRing
          size={92}
          thickness={7}
          progress={p.ratio}
          value={conMiles(p.pasos)}
          label={frase`de ${conMiles(p.objetivo)}`}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.texto}>{textoDePasos(p)}</Text>
          {/* La estimación se presenta como tal. Nadie sabe de verdad cuántas
              calorías quema alguien andando, y dar una cifra exacta sería
              inventarse una precisión que no existe. */}
          {kcal > 0 ? (
            <Text style={styles.kcal}>≈ {conMiles(kcal)} kcal de gasto, aproximadas</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.semana}>
        {semana.map((d, i) => (
          <View key={d.date} style={styles.diaColumna}>
            <View style={styles.barraFondo}>
              <View
                style={[
                  styles.barra,
                  { height: `${Math.round((d.steps / maximo) * 100)}%` },
                  d.steps >= objetivo && styles.barraCumplida,
                ]}
              />
            </View>
            <Text style={[styles.diaLetra, i === 6 && styles.diaHoy]}>
              {DIAS[(new Date(d.date).getDay() + 6) % 7]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.media}>Media de la semana: {conMiles(media)} pasos al día</Text>

      {/* ---- De dónde salen los pasos ----

           Se elige UNA VEZ y queda en la cuenta. Antes había que pulsar "traer
           los pasos del móvil" cada día: un contador que hay que pedir a mano
           cada mañana no lo usa nadie más de tres días. */}
      {!origen ? (
        <View style={styles.elegir}>
          <Text style={styles.elegirTitulo}>¿De dónde saco tus pasos?</Text>
          <Text style={styles.elegirTexto}>
            Se elige una vez. A partir de ahí aparecen solos cada día.
          </Text>
          <View style={styles.elegirBotones}>
            <Pressable onPress={() => conectar('telefono')} style={styles.elegirPrincipal}>
              <Ionicons name="phone-portrait-outline" size={15} color={colors.onPrimary} />
              <Text style={styles.elegirPrincipalTexto}>Este móvil</Text>
            </Pressable>
            <Pressable onPress={() => conectar('mano')} style={styles.elegirOtro} hitSlop={6}>
              <Text style={styles.elegirOtroTexto}>Los escribo yo</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.conectado}>
          <Ionicons
            name={leyendo ? 'hourglass-outline' : origen === 'telefono' ? 'phone-portrait-outline' : 'create-outline'}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.conectadoTexto} numberOfLines={1}>
            {leyendo
              ? 'Leyendo…'
              : origen === 'telefono'
                ? Platform.OS === 'ios'
                  ? 'Se leen solos de tu iPhone'
                  /*
                   * En Android se dice lo que de verdad pasa: el sensor cuenta
                   * mientras la app está delante. "Se leen solos de este móvil"
                   * daba a entender que contaba con la app cerrada —eso lo hacía
                   * Health Connect, que ya no está— y quien saliera a andar sin
                   * abrir UDECA volvería creyendo que el contador falla.
                   */
                  : 'Se cuentan con la app abierta'
                : 'Los escribes tú'}
          </Text>
          <Pressable onPress={() => setCambiando(true)} hitSlop={8}>
            <Text style={styles.cambiar}>Cambiar</Text>
          </Pressable>
        </View>
      )}

      {/* Escribirlos a mano está SIEMPRE, se haya elegido o no.

          Estuvo un rato escondido detrás de la pregunta de arriba y era un paso
          de más: quien entra a apuntar sus 9.000 pasos no quiere contestar
          antes de dónde salen. Y con el móvil conectado sigue haciendo falta —
          se sale a andar sin él más veces de las que parece, y ese día los
          pasos los sabe el reloj. */}
      <View style={styles.filaMano}>
        <TextField
          value={aMano}
          onChangeText={setAMano}
          placeholder="Ej. 9500"
          keyboardType="number-pad"
          containerStyle={styles.campo}
          style={{ marginBottom: 0 }}
          onSubmitEditing={guardarAMano}
          returnKeyType="done"
        />
        <Pressable onPress={guardarAMano} style={styles.botonMano}>
          <Text style={styles.botonManoTexto}>Apuntar a mano</Text>
        </Pressable>
      </View>
      {hoy?.source === 'mano' ? (
        <Text style={styles.origen}>Los de hoy los has escrito tú.</Text>
      ) : null}

      {/* Cambiar de fuente: dos opciones y ya. */}
      <Dialogo
        visible={cambiando}
        onClose={() => setCambiando(false)}
        titulo="¿De dónde saco tus pasos?"
        texto="Puedes cambiarlo cuando quieras. Lo que ya está apuntado no se toca."
        cancelar="Dejarlo como está"
      >
        <View style={styles.opcionesFuente}>
          <Pressable onPress={() => conectar('telefono')} style={styles.opcionFuente}>
            <Ionicons name="phone-portrait-outline" size={17} color={colors.primary} />
            <Text style={styles.opcionFuenteTexto}>
              {Platform.OS === 'ios' ? 'De mi iPhone' : 'De este móvil'}
            </Text>
            {origen === 'telefono' ? (
              <Ionicons name="checkmark" size={16} color={colors.primary} />
            ) : null}
          </Pressable>
          <Pressable onPress={() => conectar('mano')} style={styles.opcionFuente}>
            <Ionicons name="create-outline" size={17} color={colors.primary} />
            <Text style={styles.opcionFuenteTexto}>Los escribo yo</Text>
            {origen === 'mano' ? (
              <Ionicons name="checkmark" size={16} color={colors.primary} />
            ) : null}
          </Pressable>
        </View>
      </Dialogo>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texto: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  kcal: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 4 },
  semana: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 76,
    marginTop: spacing.md,
  },
  diaColumna: { flex: 1, alignItems: 'center', gap: 4 },
  barraFondo: {
    width: '100%',
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: { width: '100%', backgroundColor: colors.primaryDark, borderRadius: radius.sm },
  barraCumplida: { backgroundColor: colors.primary },
  diaLetra: { fontSize: 10, color: colors.textFaint },
  diaHoy: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  media: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: spacing.sm },
  // Elegir de dónde salen los pasos: solo la primera vez.
  elegir: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  elegirTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  elegirTexto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  elegirBotones: {
    flexDirection: 'row',
    alignItems: 'center',
    // Envuelve antes que salirse: en un móvil de 320 px "Los escribo yo" se
    // salía por el borde derecho de la tarjeta y se leía a medias.
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  elegirPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  elegirPrincipalTexto: {
    ...typography.small,
    color: colors.onPrimary,
    fontFamily: fonts.semiBold,
  },
  elegirOtro: { paddingVertical: 9 },
  elegirOtroTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },

  // Ya conectado: una línea discreta que dice de dónde salen y deja cambiarlo.
  conectado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  conectadoTexto: { ...typography.small, color: colors.textMuted, flexShrink: 1, flexGrow: 1 },
  cambiar: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  opcionesFuente: { gap: spacing.sm, marginTop: spacing.sm },
  opcionFuente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  opcionFuenteTexto: { ...typography.body, color: colors.text, flex: 1 },
  /*
   * El campo y su botón, en una fila que se parte si hace falta. Con el botón
   * fijo al lado, en 320 px al campo le quedaban ochenta píxeles y el ejemplo
   * "Ej. 9500" se leía "Ej. 950".
   */
  filaMano: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'wrap', gap: spacing.sm },
  campo: { flexGrow: 1, flexBasis: 130, minWidth: 130, marginBottom: 0 },
  botonMano: {
    // Al envolver, el botón pasa a ocupar la fila entera en vez de quedarse
    // encogido a la izquierda.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  botonManoTexto: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  origen: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: spacing.sm },
});
