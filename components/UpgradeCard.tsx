import React from 'react';
import { frase } from '../lib/idioma';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from './Card';
import { useAuth } from '../lib/auth-context';
import { updateUserProfile } from '../lib/firestore/users';
import { track } from '../lib/analytics';
import {
  CAN_LINK_TO_PAYMENT,
  clientSlotsOf,
  isAdmin,
  planIlimitado,
  subscriptionCheckoutUrl,
  subscriptionState,
  tocaElAvisoDelAtleta,
  TRIAL_DAYS,
} from '../lib/subscription';
import type { UserProfile } from '../lib/types';
import { ElegirPlan } from './ElegirPlan';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * ¿Le queda plan por delante a esta cuenta?
 *
 * Al ENTRENADOR, mientras no tenga el plan sin tope. Su primer año está
 * pagado y es un año entero de app completa, pero el techo de alumnos sigue
 * ahí: el plan que lo quita se puede contratar desde el primer día y no hay
 * que esperar a chocar con la quinta plaza para enterarse de que existe.
 *
 * Al ATLETA, solo cuando no tiene acceso pagado por delante: durante su año no
 * hay nada que venderle, y seguir enseñándole "hazte de pago" a quien acaba de
 * pagar es la forma más rápida de parecer una máquina tragaperras.
 */
export function canUpgrade(profile: UserProfile | null): boolean {
  if (!profile || !CAN_LINK_TO_PAYMENT) return false;
  if (profile.role !== 'trainer' && profile.role !== 'athlete') return false;
  if (isAdmin(profile)) return false;
  const estado = subscriptionState(profile);
  if (estado.legacy) return false; // cuenta fundadora: acceso completo de por vida
  if (profile.role === 'trainer') return !planIlimitado(profile);
  return !estado.active || estado.trial;
}

interface Props {
  /**
   * 'recordatorio' es la versión breve de los primeros días (se puede cerrar);
   * 'completa' es la del perfil, que se queda hasta que dan el paso.
   */
  variante?: 'recordatorio' | 'completa';
  /** Clave para recordar que ya se cerró (solo en la versión breve). */
  onClose?: () => void;
}

/**
 * "Puedes pasar al plan completo cuando quieras."
 *
 * Existe por una razón concreta: hay gente que entra y ya viene decidida a
 * pagar el plan completo, pero no encuentra dónde. Sin esto, su única forma de
 * contratarlo era esperar a chocar con el tope o a que se le acabara el año y
 * toparse con el muro, que es hacer esperar a quien quiere pagar.
 *
 * Solo aparece donde se puede enlazar a pagar (ver CAN_LINK_TO_PAYMENT): sin
 * precio ni enlazar a pagar fuera.
 */
export function UpgradeCard({ variante = 'completa', onClose }: Props) {
  const { profile } = useAuth();
  if (!canUpgrade(profile)) return null;

  const esAtleta = profile?.role === 'athlete';
  const estado = subscriptionState(profile);
  const url = subscriptionCheckoutUrl(profile);
  const diasRestantes = estado.trial ? estado.daysLeft : null;
  /** Se le acabó el año: ya no es "pasar al plan", es volver a entrar. */
  const caducado = !estado.active;

  /*
   * Aquí no se dice ningún precio (ver lib/subscription.ts). Lo que sustituye
   * a la cifra no es un hueco: es lo que el entrenador de verdad necesita
   * saber para decidir —cuántas plazas tiene, cuántas le quedan y qué pasa
   * cuando se acaben—. Eso ya estaba escrito; lo único que se va es el número.
   */
  /*
   * Lo que se dice justo antes del botón del atleta.
   *
   * No es un adorno: es la única línea que aclara qué se lleva por el dinero.
   * Va aquí y no dentro de `ElegirPlan` porque ese componente lo comparten el
   * muro y esta tarjeta, y en el muro la pantalla ya lo dice por su cuenta.
   *
   * Al entrenador no le corresponde nada aquí: "se cobra una vez al año" va
   * pegado a su botón, que es donde importa saberlo.
   */
  const facturacion = 'Un año entero, la app completa y sin recortes.';

  /**
   * Las plazas del entrenador, con nombre y apellidos.
   *
   * Decir "tu alta incluye 5 alumnos y llevas 3" hace dos cosas a la vez: es la
   * verdad completa —lo que compró, sin letra pequeña— y es lo que de verdad
   * mueve a dar el paso, porque enseña dónde está el techo antes de chocar con
   * él. Un mensaje que solo dice "hazte Pro" no informa de nada.
   */
  const plazas = clientSlotsOf(profile);
  const usados = profile?.clientCount ?? 0;
  const lleno = usados >= plazas;

  /*
   * LAS VENTAJAS DEL ATLETA SÍ SON VENTAJAS. LAS DEL ENTRENADOR NO LO ERAN.
   *
   * Al atleta, sin plan, se le acaba el acceso: todo lo que hay en esta lista
   * es de verdad lo que se lleva por pagar.
   *
   * Al entrenador se le enseñaban tres: alumnos ilimitados, cobros e informes.
   * Solo la primera era cierta. Los cobros y los informes los tiene desde el
   * primer día con su alta —lo único que el plan levanta es el TOPE DE ALUMNOS,
   * y así está escrito en `trainerHasAccess`—, así que la tarjeta le estaba
   * vendiendo cosas que ya había pagado.
   *
   * Eso hace daño dos veces: descubrirlo es descubrir que le han inflado la
   * lista, y de paso esconde lo que de verdad tiene, que es mucho. Lo que se
   * enseña ahora es lo que cambia (una cosa, grande y clara) y, debajo, lo que
   * YA tiene incluido. Decirle "el plan no desbloquea funciones, quita el
   * tope" vende mejor que tres promesas de las cuales dos ya se cumplían.
   */
  const ventajas = esAtleta
    ? [
        'Tus rutinas y tu progreso, sin límite de tiempo',
        'Nutrición, macros y libreta de comidas',
        'Informes en PDF y récords guardados para siempre',
      ]
    : [];

  /** Lo que el entrenador ya tiene con su año, pague o no el plan sin tope. */
  const yaIncluido = [
    'Cobros, avisos de impago y control de cuotas',
    'Rutinas, ciclos y calendario',
    'Nutrición, macros y pasos',
    'Informes de progreso con tu marca',
    'Cursos y clases VIP',
  ];

  /** El titular del recordatorio para el entrenador, según dónde esté. */
  const tituloCoach = lleno
    ? plazas === 0
      ? 'Esta cuenta no incluye alumnos'
      : frase`Has llenado tus ${plazas} plazas`
    : frase`Tu plan incluye ${plazas} alumnos`;
  /**
   * El texto dice DOS cosas que no pueden faltar: lo que ya tiene pagado para
   * siempre, y que a partir de la plaza siguiente el plan deja de ser opcional.
   * Descubrir el tope el día que llega el alumno nuevo, y no antes, es lo que
   * convierte una cuota razonable en una encerrona.
   */
  const textoCoach = lleno
    ? plazas === 0
      ? 'Tu tarjeta ya gastó sus plazas en otra cuenta de entrenador, así que esta entra sin plazas. Con el plan sin tope tienes alumnos ilimitados.'
      : frase`Para aceptar al alumno ${plazas + 1} hace falta el plan. Los ${plazas} que ya tienes siguen contigo pagues o no.`
    : frase`Ya llevas ${usados} de ${plazas}. Del alumno ${plazas + 1} en adelante hace falta el plan, y el grupo deja de tener tope.`;

  const abrir = () => {
    void track('checkout_start');
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (variante === 'recordatorio') {
    return (
      <Card style={styles.breve}>
        <View style={styles.breveFila}>
          <View style={styles.icono}>
            <Ionicons name="rocket-outline" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.breveTitulo}>
              {esAtleta ? 'Cuando quieras, sin esperar' : tituloCoach}
            </Text>
            <Text style={styles.breveTexto}>
              {esAtleta
                ? diasRestantes !== null
                  ? frase`Te quedan ${diasRestantes} días de prueba. Si ya lo tienes claro, pasa al plan completo y olvídate del contador.`
                  : 'Pasa al plan completo cuando quieras.'
                : textoCoach}
            </Text>
          </View>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        {url ? (
          <Pressable onPress={abrir} style={styles.enlace} hitSlop={6}>
            <Text style={styles.enlaceTexto}>Ver el plan completo</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </Card>
    );
  }

  return (
    <Card accent style={styles.card}>
      <View style={styles.cabecera}>
        <Text style={styles.eyebrow}>{esAtleta ? 'UDECA ATLETA' : 'UDECA PRO'}</Text>
        {diasRestantes !== null ? (
          <View style={styles.pill}>
            <Text style={styles.pillTexto}>
              {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'} de prueba
            </Text>
          </View>
        ) : null}
      </View>

      {/* Solo para las cuentas antiguas que siguen en su prueba de 28 días:
          con el modelo nuevo no hay prueba, y `diasRestantes` solo tiene valor
          mientras la haya. Un contador a la vista evita la sorpresa del último
          día, que es cuando se pierde a la gente. */}
      {esAtleta && diasRestantes !== null ? (
        <View style={styles.plazas}>
          <View style={styles.plazasFila}>
            <Text style={styles.plazasTitulo}>Tu prueba dura {TRIAL_DAYS} días</Text>
            <Text
              style={[styles.plazasCuenta, diasRestantes <= 3 && { color: colors.warning }]}
            >
              {diasRestantes === 1 ? frase`queda ${diasRestantes}` : frase`quedan ${diasRestantes}`}
            </Text>
          </View>
          {/* Una barra y no un punto por día: con cuatro semanas de prueba,
              veintiocho puntos en una fila son veintiocho rayas de seis
              píxeles, que no se cuentan de un vistazo ni dicen nada. La
              proporción sí se lee sola. */}
          <View style={styles.barra}>
            <View
              style={[
                styles.barraGastada,
                {
                  width: `${Math.min(100, Math.max(0, ((TRIAL_DAYS - diasRestantes) / TRIAL_DAYS) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.plazasPie}>
            Con todo abierto, sin recortes. Cuando terminen, lo que has
            registrado te espera intacto.
          </Text>
        </View>
      ) : null}

      {/* Lo primero que ve el entrenador es lo que YA tiene, no lo que le
          falta: su primer año incluye plazas de verdad. Enseñar el contador es
          a la vez lo más honesto y lo más persuasivo — el que va por 4 de 5
          sabe exactamente qué está a punto de necesitar. */}
      {!esAtleta ? (
        <View style={styles.plazas}>
          <View style={styles.plazasFila}>
            <Text style={styles.plazasTitulo}>
              {plazas === 0
                ? 'Tu plan no incluye alumnos'
                : frase`Tu plan incluye ${plazas} alumnos`}
            </Text>
            {plazas > 0 ? (
              <Text style={[styles.plazasCuenta, lleno && { color: colors.warning }]}>
                {usados} / {plazas}
              </Text>
            ) : null}
          </View>
          {plazas > 0 ? (
            <View style={styles.plazasPuntos}>
              {Array.from({ length: plazas }, (_, i) => (
                <View
                  key={i}
                  style={[styles.plaza, i < usados && styles.plazaOcupada]}
                />
              ))}
            </View>
          ) : null}
          <Text style={styles.plazasPie}>
            {plazas === 0
              ? 'Tu tarjeta ya gastó sus plazas en otra cuenta de entrenador.'
              : lleno
                ? frase`Están todas ocupadas. Para aceptar al alumno ${plazas + 1} hace falta el plan sin tope.`
                : frase`Del alumno ${plazas + 1} en adelante hace falta el plan sin tope.`}
          </Text>
        </View>
      ) : null}

      {ventajas.map((v) => (
        <View key={v} style={styles.ventaja}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          <Text style={styles.ventajaTexto}>{v}</Text>
        </View>
      ))}

      {/* LO QUE CAMBIA, en dos columnas.
          Una sola fila, porque una sola cosa cambia. Enseñarla así —lo que
          tienes hoy al lado de lo que tendrías— dice en un vistazo lo que tres
          líneas de texto no consiguen, y no promete nada de más. */}
      {!esAtleta ? (
        <>
          <Text style={styles.seccion}>Lo que cambia</Text>
          <View style={styles.comparaFila}>
            <View style={styles.compara}>
              <Text style={styles.comparaCuando}>Ahora</Text>
              <Text style={styles.comparaValor}>
                {plazas === 0 ? 'Sin plazas' : frase`${plazas} alumnos`}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
            <View style={[styles.compara, styles.comparaDestacada]}>
              <Text style={[styles.comparaCuando, { color: colors.primary }]}>Con el plan</Text>
              <Text style={[styles.comparaValor, { color: colors.primaryBright }]}>
                Sin tope
              </Text>
            </View>
          </View>

          {/* Y lo que NO cambia, que es casi todo. Va explícito porque es la
              diferencia entre "te falta la mitad del producto" y "tienes el
              producto entero, y lo que compras es sitio". */}
          <Text style={styles.seccion}>Ya lo tienes con tu año</Text>
          {yaIncluido.map((v) => (
            <View key={v} style={styles.ventaja}>
              <Ionicons name="checkmark-circle" size={15} color={colors.textMuted} />
              <Text style={[styles.ventajaTexto, { color: colors.textMuted }]}>{v}</Text>
            </View>
          ))}
          <Text style={styles.aclara}>
            El plan no desbloquea funciones: las tienes todas desde el primer
            día. Lo único que quita es el tope de alumnos.
          </Text>
        </>
      ) : null}

      {/* Los dos ven un solo botón: se paga por años y no hay nada que
          elegir. Fingir una decisión donde no la hay solo hace la pantalla
          más lenta. */}
      {esAtleta ? (
        <>
          {/* Va JUSTO encima del botón, no suelto más arriba: lo que dice es
              sobre el paso que viene a continuación, y a media tarjeta de
              distancia no se lee como parte de él.

              Y solo si hay botón. Sin enlace configurado `ElegirPlan` no pinta
              nada, y esta frase se quedaba sola al final de la tarjeta
              hablando de un paso que no estaba por ninguna parte. */}
          {url ? <Text style={styles.pie}>{facturacion}</Text> : null}
          <ElegirPlan
            profile={profile}
            nota="Se paga una vez y te olvidas del contador hasta el año que viene."
          />
        </>
      ) : (
        <>
          {url ? (
            <Pressable onPress={abrir} style={styles.boton}>
              <Text style={styles.botonTexto}>
                {caducado ? 'Renovar mi cuenta' : 'Pasar al plan sin tope'}
              </Text>
            </Pressable>
          ) : null}
          {/* Cómo se cobra va aquí, pegado al botón: es lo último que se lee
              antes de pulsar, y es donde de verdad importa saberlo. Es UNA
              frase entera y no un trozo pegado a una variable, porque el
              diccionario traduce por frase completa. */}
          <Text style={styles.nota}>
            {caducado
              ? 'Se cobra una vez al año e incluye la app entera sin tope de alumnos. Tu grupo y tu trabajo te esperan intactos.'
              : 'Se cobra una vez al año. Mientras no lo actives no se te cobra nada, y tus alumnos actuales siguen igual.'}
          </Text>
        </>
      )}
    </Card>
  );
}

/**
 * Cada cuánto vuelve a saltar el aviso a pantalla completa: una semana.
 *
 * Ni una vez y nunca más —el que hoy tiene dos alumnos puede tener seis en un
 * mes y necesita enterarse— ni cada vez que abre la app, que es como se
 * consigue que alguien desinstale. Una vez por semana es un recordatorio; cada
 * día es acoso.
 */
const CADA_CUANTO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aviso a pantalla completa del plan.
 *
 * Va a pantalla completa a propósito: lo que aquí se cuenta —el tope de
 * alumnos, los días de prueba— no es un detalle de letra pequeña, es la
 * condición que le va a afectar el día que le entre gente o se le acabe el
 * plazo. Enterarse ESE día, y no antes, es lo que hace que un precio justo
 * parezca una encerrona.
 *
 * Sale al entrenador y al atleta, con lo suyo cada uno y en momentos
 * distintos: al entrenador cada semana mientras tenga plazas de las que
 * hablar, y al atleta SOLO el último día de su prueba (ver
 * `tocaElAvisoDelAtleta`). Se cierra con un toque y no vuelve en una semana, y
 * el descanso se guarda en la CUENTA: cerrarlo en el móvil y que salte en el
 * ordenador media hora después no es recordar, es perseguir.
 *
 * Cuando la prueba del atleta caduca ya no llega aquí: el muro de pago le sale
 * antes y bloquea la app entera, así que no se pisan.
 */
export function UpgradePopup() {
  const { profile, refreshProfile } = useAuth();
  const [cerradoAhora, setCerradoAhora] = React.useState(false);
  const esAtleta = profile?.role === 'athlete';

  const ultimoCierre = profile?.planPopupClosedAt ?? 0;
  const tocaEnseñarlo = Date.now() - ultimoCierre > CADA_CUANTO_MS;

  const cerrar = () => {
    setCerradoAhora(true);
    if (!profile) return;
    updateUserProfile(profile.uid, { planPopupClosedAt: Date.now() })
      .then(() => refreshProfile())
      .catch(() => {});
  };

  if (cerradoAhora || !tocaEnseñarlo || !canUpgrade(profile)) return null;
  if (esAtleta && !tocaElAvisoDelAtleta(profile)) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={styles.popup} edges={['top', 'bottom']}>
        <View style={styles.popupBarra}>
          <Pressable onPress={cerrar} hitSlop={12} style={styles.popupCerrar}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.popupCuerpo}>
          <View style={styles.popupIcono}>
            <Ionicons name={esAtleta ? 'barbell' : 'people'} size={26} color={colors.primary} />
          </View>
          <Text style={styles.popupEyebrow}>
            {esAtleta ? 'Tu plan de atleta' : 'Tu plan de entrenador'}
          </Text>
          {/* Al atleta se le dice por qué le sale esto HOY. Un titular que
              explica el producto ("así funciona tu prueba") sirve el primer
              día; el último, lo que hace falta saber es que se acaba. */}
          <Text style={styles.popupTitulo}>
            {esAtleta ? 'Te queda un día de prueba' : 'Así funciona tu grupo'}
          </Text>
          <UpgradeCard />
          <Pressable onPress={cerrar} style={styles.popupAhoraNo} hitSlop={8}>
            <Text style={styles.popupAhoraNoTexto}>Ahora no, gracias</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popup: { flex: 1, backgroundColor: colors.background },
  popupBarra: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  popupCerrar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCuerpo: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  popupIcono: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  popupEyebrow: {
    ...typography.small,
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
  },
  popupTitulo: { ...typography.h1, color: colors.text, marginTop: 2, marginBottom: spacing.lg },
  popupAhoraNo: { alignSelf: 'center', paddingVertical: spacing.md },
  popupAhoraNoTexto: { ...typography.body, color: colors.textMuted },

  breve: { marginBottom: spacing.md },
  breveFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  icono: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breveTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  breveTexto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    marginLeft: 34 + spacing.sm,
  },
  enlaceTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },

  card: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    ...typography.small,
    color: colors.primaryBright,
    letterSpacing: 1.5,
    fontFamily: fonts.semiBold,
  },
  pill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pillTexto: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  plazas: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  plazasFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plazasTitulo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  plazasCuenta: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  plazasPuntos: { flexDirection: 'row', gap: 5, marginTop: spacing.sm },
  barra: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  barraGastada: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  plaza: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  plazaOcupada: { backgroundColor: colors.primary },
  plazasPie: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  pie: { ...typography.small, color: colors.textFaint, marginBottom: spacing.md },
  ventaja: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  ventajaTexto: { ...typography.small, color: colors.text, flex: 1 },
  seccion: {
    ...typography.small,
    color: colors.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  comparaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compara: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  // Se distingue por el borde, como en ElegirPlan: un bloque de color aquí se
  // leería como publicidad metida con calzador en una app negra y sobria.
  comparaDestacada: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  comparaCuando: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  comparaValor: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    marginTop: 2,
  },
  aclara: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  botonTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  nota: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.sm,
    lineHeight: 17,
    textAlign: 'center',
  },
});
