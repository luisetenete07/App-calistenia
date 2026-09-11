import React, { useEffect, useState } from 'react';
import { frase } from '../../lib/idioma';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BotonApple } from '../../components/BotonApple';
import { BotonGoogle } from '../../components/BotonGoogle';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAppleSignIn } from '../../lib/appleAuth';
import { useGoogleSignIn } from '../../lib/googleAuth';
import { mensajeDeEntrada } from '../../lib/enlazarCuenta';
import { trackOnce } from '../../lib/analytics';
import { FREE_CLIENT_LIMIT } from '../../lib/subscription';
import { colors, fonts, gradients, spacing, typography } from '../../lib/theme';

/**
 * Crear cuenta: con Google o con Apple, y ya.
 *
 * Antes había nombre, correo, contraseña, código del entrenador y elegir rol,
 * todo antes de haber visto la app. Cinco campos son cinco sitios donde
 * abandonar, y el que más pesa —la contraseña— además había que inventarla y
 * recordarla.
 *
 * Ahora se entra primero y se pregunta después: al volver de Google o de Apple,
 * `app/(auth)/completar.tsx` pide el nombre, el rol y el código si hace falta.
 * Es el mismo trabajo, pero cuando ya se está dentro y no cuesta lo mismo.
 *
 * Los tres tipos de cuenta se cuentan aquí igualmente, sin poder elegirlos: no
 * es un formulario, es saber a qué vienes.
 */

const TIPOS: { titulo: string; icono: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  {
    titulo: 'Alumno',
    icono: 'person-outline',
    texto: 'Entrenas con tu entrenador, que te manda el plan. Necesitas su código.',
  },
  {
    titulo: 'Atleta',
    icono: 'barbell-outline',
    texto: 'Entrenas por tu cuenta. Entras con un año entero por delante.',
  },
  {
    titulo: 'Entrenador',
    icono: 'people-outline',
    texto: frase`Tus alumnos, tus cobros y tu negocio. El alta incluye ${FREE_CLIENT_LIMIT} alumnos.`,
  },
];

export default function RegisterScreen() {
  const google = useGoogleSignIn();
  const apple = useAppleSignIn();
  const [error, setError] = useState<string | null>(null);

  // Cuántos llegan a ver la pantalla de alta (denominador del embudo).
  useEffect(() => {
    void trackOnce('register_view');
  }, []);

  const entrarCon = async (proveedor: { entrar: () => Promise<unknown> }, cual: string) => {
    setError(null);
    try {
      await proveedor.entrar();
    } catch (e) {
      setError(mensajeDeEntrada(e) || frase`No se ha podido entrar con ${cual}. Inténtalo otra vez.`);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content} maxWidth={560}>
      <View style={styles.header}>
        <LinearGradient
          colors={gradients.goldHaloSoft}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Logo />
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>En un toque. Sin contraseñas que recordar.</Text>
      </View>

      <Card accent style={styles.formCard}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {google.disponible ? (
          <BotonGoogle
            texto="Registrarme con Google"
            cargando={google.entrando}
            onPress={() => entrarCon(google, 'Google')}
          />
        ) : null}

        {apple.disponible ? (
          <View style={google.disponible ? styles.hueco : undefined}>
            <BotonApple
              texto="Registrarme con Apple"
              cargando={apple.entrando}
              onPress={() => entrarCon(apple, 'Apple')}
            />
          </View>
        ) : null}

        {!google.disponible && !apple.disponible ? (
          <Text style={styles.error}>
            No se puede crear la cuenta desde este dispositivo. Prueba desde el navegador en
            app.udeca.app.
          </Text>
        ) : null}

        <Text style={styles.legal}>
          Al crear tu cuenta aceptas los términos y la política de privacidad de UDECA.
        </Text>
      </Card>

      <Text style={styles.tiposTitulo}>Puedes entrar como</Text>
      {TIPOS.map((tipo) => (
        <View key={tipo.titulo} style={styles.tipo}>
          <View style={styles.tipoIcono}>
            <Ionicons name={tipo.icono} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipoTitulo}>{tipo.titulo}</Text>
            <Text style={styles.tipoTexto}>{tipo.texto}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.tiposPie}>Lo eliges al terminar de entrar.</Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
        <Link href="/(auth)/login" asChild>
          <Text style={styles.link}> Entrar</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  heroGlow: {
    position: 'absolute',
    top: -spacing.lg,
    left: -600,
    right: -600,
    height: 380,
  },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  title: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  formCard: { padding: spacing.lg },
  hueco: { marginTop: spacing.sm },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md, lineHeight: 19 },
  legal: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  tiposTitulo: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  tipo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tipoIcono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipoTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  tipoTexto: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  tiposPie: {
    ...typography.small,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { ...typography.body, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
});
