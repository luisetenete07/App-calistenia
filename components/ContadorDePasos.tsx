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
import {
  hayPermisoDePasos,
  pasosDelResultado,
  PERMISO_DE_PASOS,
  porQueNoHaySalud,
  rangoDelDia,
  saludUtilizable,
} from '../lib/pasosDeSalud';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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
  const [cambiando, setCambiando] = useState(false);
  const { refreshProfile } = useAuth();
  /** De dónde salen sus pasos. Vacío = todavía no lo ha elegido. */
  const origen = profile.stepsSource;

  const cargar = onCambio;

  const hoy = pasosDeHoy(registros);
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
   * Los pasos de hoy según Health Connect, o `null` si no se puede.
   *
   * `null` significa "por aquí no hay nada que rascar, prueba otra cosa": el
   * móvil no lo trae, no está actualizado, o el usuario no ha dado permiso. El
   * que llama se cae entonces al sensor de siempre.
   *
   * Cero SÍ es un número: quiere decir que Health Connect existe, nos deja
   * mirar, y hoy no hay pasos guardados. Confundir las dos cosas es lo que
   * haría que un fallo de permisos pusiera el día a cero.
   *
   * El módulo se carga con `require` y dentro del try por lo mismo que el
   * resto: en la web no existe, y una importación arriba del todo tumbaría la
   * pantalla entera en vez de solo esta función.
   */
  const leerDeHealthConnect = async (enSilencio: boolean): Promise<number | null> => {
    try {
      const salud = require('react-native-health-connect');
      await salud.initialize();
      const estado = await salud.getSdkStatus();
      if (!saludUtilizable(estado)) {
        if (!enSilencio) showToast(porQueNoHaySalud(estado));
        return null;
      }
      /*
       * Se piden los permisos aunque ya estén dados: si lo están, Health
       * Connect contesta que sí sin enseñar nada, así que esto no molesta en
       * las lecturas automáticas.
       */
      const concedidos = await salud.requestPermission([PERMISO_DE_PASOS]);
      if (!hayPermisoDePasos(concedidos)) {
        if (!enSilencio) {
          showToast('Sin permiso en Health Connect no se pueden leer tus pasos.');
        }
        return null;
      }
      const res = await salud.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: rangoDelDia(inicioDelDia(Date.now()), Date.now()),
      });
      return pasosDelResultado(res);
    } catch {
      // Cualquier cosa rara aquí no puede dejar sin pasos a nadie: se devuelve
      // `null` y el que llama se cae al sensor.
      return null;
    }
  };

  /**
   * Lee del contador del teléfono.
   *
   * En iPhone se le pregunta al propio teléfono por el día entero, con la app
   * cerrada incluida. En Android eso lo tiene Health Connect y no el sensor, así
   * que se prueba ahí PRIMERO; solo si el móvil no lo trae se cae al sensor,
   * que únicamente cuenta con la app delante y por eso se suma en vez de
   * sustituir.
   */
  const leerDelTelefono = async ({ enSilencio = false } = {}) => {
    if (Platform.OS === 'web') {
      if (enSilencio) return;
      showToast('El contador del móvil solo está en la app de iPhone o Android');
      return;
    }
    setLeyendo(true);
    try {
      /*
       * ANDROID: HEALTH CONNECT PRIMERO, Y ANTES DE TOCAR EL SENSOR
       *
       * Es el almacén de salud del sistema y el único sitio de Android donde
       * están los pasos del día ENTERO: los que cuenta el teléfono con la app
       * cerrada, más los del reloj o de otra app. `expo-sensors` no puede
       * dárnoslos —contesta "not supported"— y solo sabe contar mientras UDECA
       * está delante.
       *
       * Va antes que nada a propósito. Si se preguntara después, un móvil sin
       * sensor de pasos, o cuyo dueño no diera el permiso de actividad, se
       * quedaría sin leer nada aunque Health Connect tuviera el día entero
       * guardado: se habría salido por el `return` de arriba.
       */
      if (Platform.OS === 'android') {
        const pasosDeSalud = await leerDeHealthConnect(enSilencio);
        if (pasosDeSalud !== null) {
          if (pasosDeSalud === 0) {
            // Cero no es un éxito: o no se ha andado, o no hay nada guardado.
            if (!enSilencio) {
              showToast('Health Connect no tiene pasos guardados de hoy todavía.');
            }
            return;
          }
          const aGuardar = pasosAGuardar(hoy, pasosDeSalud, { acumulativo: false });
          // En la lectura automática, si no cambia nada no se escribe: cada
          // escritura hace recargar la pantalla entera al padre.
          if (enSilencio && aGuardar === (hoy?.steps ?? 0)) return;
          await guardar(aGuardar, 'telefono');
          if (!enSilencio) showToast(frase`Traídos ${conMiles(pasosDeSalud)} pasos de tu móvil`);
          return;
        }
      }

      const Pedometer = require('expo-sensors').Pedometer;
      if (!(await Pedometer.isAvailableAsync())) {
        if (!enSilencio) showToast('Este móvil no tiene contador de pasos');
        return;
      }
      /*
       * El permiso se PIDE la primera vez y ya está concedido las siguientes,
       * así que esta llamada no molesta a nadie en las lecturas automáticas: si
       * ya se dijo que sí, devuelve que sí sin enseñar nada.
       */
      const permiso = await Pedometer.requestPermissionsAsync();
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
        const aGuardar = pasosAGuardar(hoy, leidos, { acumulativo: false });
        // En la lectura automática, si no cambia nada no se escribe: cada
        // escritura hace recargar la pantalla entera al padre.
        if (enSilencio && aGuardar === (hoy?.steps ?? 0)) return;
        await guardar(aGuardar, 'telefono');
        if (!enSilencio) showToast(frase`Traídos ${conMiles(leidos)} pasos de tu iPhone`);
        return;
      }

      /*
       * Sin Health Connect, lo único que hay es escuchar el sensor, y ese solo
       * cuenta mientras la app está delante.
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
            'Sin Health Connect, Android solo cuenta los pasos con la app abierta. Instálalo desde Google Play, o escribe tus pasos a mano.'
          );
        }
        return;
      }
      await guardar(pasosAGuardar(hoy, contados, { acumulativo: true }), 'telefono');
      if (!enSilencio) {
        showToast(frase`Sumados ${conMiles(contados)} pasos andados con la app abierta`);
      }
    } catch {
      if (!enSilencio) showToast('No se ha podido leer el contador del móvil');
    } finally {
      setLeyendo(false);
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
    leerDelTelefono({ enSilencio: true }).catch(() => {});
    // `leerDelTelefono` se recrea en cada pintado y meterlo aquí dispararía el
    // efecto sin parar; lo que de verdad decide es el origen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, registros]);

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
                  : 'Se leen solos de este móvil'
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
