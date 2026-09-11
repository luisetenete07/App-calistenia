import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { markIntroSeen } from '../../lib/intro';
import { trackOnce } from '../../lib/analytics';
import { FREE_CLIENT_LIMIT } from '../../lib/subscription';
import { colors, fonts, gradients, radius, spacing, typography } from '../../lib/theme';

const NATIVE = Platform.OS !== 'web';

/**
 * Presentación de la esencia de UDECA para quien abre la app por primera vez y
 * todavía no tiene cuenta. Son tres ideas, no un manual: qué entrenamos, cómo
 * lo entrenamos y con quién. Termina invitando a entrar con la prueba gratuita
 * por delante, para que la primera pantalla nunca sea un muro de pago.
 */

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'flame-outline',
    title: 'Tu cuerpo es el gimnasio',
    body: 'Calistenia de verdad: dominar tu propio peso. Sin máquinas, sin excusas y desde donde estés.',
  },
  {
    icon: 'analytics-outline',
    title: 'Método, no improvisación',
    body: 'Planes con progresión medida. Cada serie, cada segundo de isométrico y cada récord quedan registrados.',
  },
  {
    icon: 'people-outline',
    title: 'Solo o acompañado',
    body: 'Entrena con tu entrenador y tu grupo, o crea tú mismo tu plan como atleta independiente.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  // Primer paso del embudo: alguien acaba de instalar y abrir la app.
  useEffect(() => {
    void trackOnce('intro_start');
  }, []);

  // La cabecera entra una sola vez; las diapositivas se animan con el gesto.
  const headerIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerIn, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  }, [headerIn]);

  const go = async (path: '/(auth)/register' | '/(auth)/login') => {
    void trackOnce('intro_done');
    await markIntroSeen();
    router.replace(path);
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      go('/(auth)/register');
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.goldHalo} style={styles.halo} pointerEvents="none" />

      {/* Salida directa, visible desde la primera diapositiva. Quien llega con
          el código de su entrenador ya viene convertido y solo quiere entrar. */}
      <Pressable onPress={() => go('/(auth)/register')} hitSlop={10} style={styles.skip}>
        <Text style={styles.skipText}>Saltar</Text>
      </Pressable>

      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerIn,
            transform: [
              { translateY: headerIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            ],
          },
        ]}
      >
        <Logo />
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
          listener: (e) => {
            const x = (e.nativeEvent as { contentOffset: { x: number } }).contentOffset.x;
            const i = Math.round(x / width);
            if (i !== index) setIndex(i);
          },
        })}
        style={styles.pager}
      >
        {SLIDES.map((slide, i) => {
          // Cada diapositiva se acerca y se aclara al llegar al centro.
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          });
          return (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
                <View style={styles.iconRing}>
                  <Ionicons name={slide.icon} size={34} color={colors.primary} />
                </View>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={s.title}
              style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button title={isLast ? 'Empezar' : 'Siguiente'} onPress={next} />
        {/* Sin precios (ver lib/subscription.ts): lo que aquí importa es que
            hay una forma de entrar para cada uno, no lo que cuesta. */}
        <Text style={styles.trialNote}>
          Con tu entrenador o por tu cuenta, con un año entero por delante. Y si
          entrenas a otros, empiezas con {FREE_CLIENT_LIMIT} alumnos.
        </Text>
        <Pressable onPress={() => go('/(auth)/login')} hitSlop={8} style={styles.loginLink}>
          <Text style={styles.loginText}>Ya tengo cuenta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  halo: {
    position: 'absolute',
    // Banda a sangre, no un óvalo. `LinearGradient` recortado con borderRadius
    // deja un borde duro visible (en PC se veía el arco del círculo); de lado
    // a lado no hay lados que cortar y abajo se apaga a transparente.
    top: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  skip: {
    position: 'absolute',
    top: spacing.xl + spacing.sm,
    right: spacing.lg,
    zIndex: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  header: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  pager: { flexGrow: 0 },
  slide: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 420,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.xl },
  dot: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  trialNote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  loginLink: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.xs },
  loginText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
});
