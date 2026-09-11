import React, { useState } from 'react';
import { frase } from '../../lib/idioma';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { FREE_CLIENT_LIMIT } from '../../lib/subscription';
import type { UserRole } from '../../lib/types';

/**
 * El último paso de entrar con Google.
 *
 * Google da una identidad —nombre, correo, foto— pero no dice qué es esa
 * persona en UDECA, y el rol decide la app entera: con quién entrena, qué
 * pantallas ve y quién paga. Así que la primera vez hay que preguntarlo.
 *
 * Se pregunta AQUÍ y no antes de abrir Google a propósito. Elegir rol antes de
 * saber siquiera si la cuenta de Google va a funcionar es pedirle trabajo a
 * alguien por adelantado, y quien ya tenía cuenta no ve esta pantalla nunca:
 * su perfil ya existe y entra directo.
 */

const OPCIONES: { valor: UserRole; titulo: string; icono: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  {
    valor: 'client',
    titulo: 'Alumno',
    icono: 'person-outline',
    texto: 'Entrenas con tu entrenador, que te manda el plan. Hace falta su código.',
  },
  {
    valor: 'athlete',
    titulo: 'Atleta',
    icono: 'barbell-outline',
    texto: 'Entrenas por tu cuenta: tus rutinas, tu progreso y tu nutrición. Entras con un año entero por delante.',
  },
  {
    valor: 'trainer',
    titulo: 'Entrenador',
    icono: 'people-outline',
    texto: frase`Tus alumnos, tus cobros y tu negocio. El plan de entrada incluye ${FREE_CLIENT_LIMIT} alumnos.`,
  },
];

export default function CompletarCuentaScreen() {
  const { firebaseUser, completarPerfilDeGoogle, signOut } = useAuth();
  const [role, setRole] = useState<UserRole>('client');
  const [name, setName] = useState(firebaseUser?.displayName ?? '');
  const [codigo, setCodigo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Cerrar la sesión para entrar con otra cuenta.
   *
   * Si falla hay que DECIRLO. Antes se llamaba a `signOut` directamente desde
   * el `onPress`, así que un error se perdía en una promesa sin recoger y la
   * pantalla se quedaba igual: exactamente lo mismo que se ve cuando funciona
   * pero no te sacan de aquí, y sin forma de distinguir un caso del otro.
   */
  const salir = async () => {
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido cerrar la sesión.');
    }
  };

  const guardar = async () => {
    if (!name.trim()) {
      setError('Pon tu nombre para que tu entrenador sepa quién eres.');
      return;
    }
    if (role === 'client' && !codigo.trim()) {
      setError('Hace falta el código de tu entrenador.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await completarPerfilDeGoogle(role, name, codigo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.contenido}>
      <Text style={styles.titulo}>Ya casi</Text>
      <Text style={styles.subtitulo}>
        Has entrado como {firebaseUser?.email ?? 'tu cuenta de Google'}. Solo falta saber
        cómo vas a usar UDECA.
      </Text>

      <TextField
        label="Tu nombre"
        value={name}
        onChangeText={setName}
        placeholder="Nombre y apellido"
      />

      <Text style={styles.etiqueta}>¿Cómo entrenas?</Text>
      {OPCIONES.map((o) => {
        const activo = role === o.valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => setRole(o.valor)}
            style={[styles.opcion, activo && styles.opcionActiva]}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
          >
            <View style={[styles.icono, activo && styles.iconoActivo]}>
              <Ionicons
                name={o.icono}
                size={18}
                color={activo ? colors.primary : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.opcionTitulo, activo && { color: colors.primary }]}>
                {o.titulo}
              </Text>
              <Text style={styles.opcionTexto}>{o.texto}</Text>
            </View>
            <Ionicons
              name={activo ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={activo ? colors.primary : colors.textFaint}
            />
          </Pressable>
        );
      })}

      {role === 'client' ? (
        <TextField
          label="Código de tu entrenador"
          value={codigo}
          onChangeText={(v) => setCodigo(v.toUpperCase())}
          placeholder="Ej. AB12CD"
          autoCapitalize="characters"
          containerStyle={{ marginTop: spacing.md }}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Crear mi cuenta"
        onPress={guardar}
        loading={guardando}
        style={{ marginTop: spacing.md }}
      />
      {/* Salida para quien entró con la cuenta equivocada: sin esto se
          quedaría atrapado aquí, con sesión abierta y sin poder cambiarla.
          Quien saca de esta pantalla al cerrar la sesión es (auth)/_layout. */}
      <Pressable onPress={salir} hitSlop={8} style={styles.salir}>
        <Text style={styles.salirTexto}>Entrar con otra cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center' },
  titulo: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitulo: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  etiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  opcionActiva: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconoActivo: { backgroundColor: colors.background },
  opcionTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  opcionTexto: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
  salir: { alignSelf: 'center', paddingVertical: spacing.md },
  salirTexto: { ...typography.small, color: colors.textFaint },
});
