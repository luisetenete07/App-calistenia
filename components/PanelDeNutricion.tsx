import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { CardsSkeleton } from './Skeleton';
import { ScreenContainer } from './ScreenContainer';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import {
  createMealLog,
  getActiveNutritionPlanForClient,
  getMealLogsForClient,
} from '../lib/firestore/nutrition';
import {
  createProgressPhoto,
  deleteProgressPhoto,
  getProgressPhotosForClient,
} from '../lib/firestore/progressPhotos';
import { getMealBooksForTrainer } from '../lib/firestore/mealBooks';
import { updateUserProfile } from '../lib/firestore/users';
import { pickProgressPhoto } from '../lib/image';
import { MacroCalculator } from './MacroCalculator';
import { ContadorDePasos } from './ContadorDePasos';
import { BloqueDePeso } from './BloqueDePeso';
import { getWeightLogsForClient } from '../lib/firestore/weightLogs';
import { getStepLogsForClient, type StepLog } from '../lib/firestore/steps';
import { balanceDelDia, caloriasDePasos, pasosDeHoy, textoDelBalance } from '../lib/pasos';
import { conMiles } from '../lib/texto';
import type { WeightLog } from '../lib/types';
import { confirmar } from '../lib/confirmar';
import { Sheet } from './Sheet';
import { esHoy, fechaCorta } from '../lib/fechas';
import { fonts, colors, radius, spacing, tabularNums, typography } from '../lib/theme';
import {
  PHOTO_POSES,
  type MealBook,
  type MealLog,
  type NutritionPlan,
  type PhotoPose,
  type ProgressPhoto,
} from '../lib/types';

/**
 * Toda la nutrición: el peso, los pasos, los macros, las comidas, las libretas
 * del coach y las fotos de progreso.
 *
 * Era una pestaña propia de la app y ahora vive dentro de Progreso, en la
 * pestaña de Nutrición. El motivo es que las dos cosas se miran juntas: lo que
 * come y lo que pesa alguien es la mitad de la explicación de lo que le pasa
 * entrenando, y tenerlas en dos sitios distintos obligaba a saltar de una a
 * otra para entender una sola cosa. De paso, la barra de abajo baja de seis
 * pestañas a cinco, que es lo que cabe en un móvil sin apretar.
 *
 * Sigue cargando lo suyo: nadie de fuera tiene que saber qué necesita.
 */
export function PanelDeNutricion() {
  const { profile, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [books, setBooks] = useState<MealBook[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPose, setUploadingPose] = useState<PhotoPose | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  // El peso vive aquí desde que se sacó de Progreso: no sube ni baja por lo
  // que levantas, sube y baja por lo que comes. Y de paso es lo que permite
  // estimar el gasto de andar sin inventarse un peso medio.
  const [pesos, setPesos] = useState<WeightLog[]>([]);
  // Los pasos viven aquí porque son parte del presupuesto de calorías del día,
  // no una sección aparte: andar 12.000 pasos cambia lo que se puede cenar.
  const [pasos, setPasos] = useState<StepLog[]>([]);

  // El último peso apuntado, que es lo que necesita el contador de pasos para
  // estimar las calorías del día. Sin él no se estima nada, en vez de tirar de
  // un peso medio inventado.
  const ultimoPeso = pesos.length > 0 ? pesos[pesos.length - 1].weightKg : undefined;

  const load = useCallback(async () => {
    if (!profile) return;
    const [planData, mealData, photoData, bookData, pesoData, pasoData] = await Promise.all([
      getActiveNutritionPlanForClient(profile.uid),
      getMealLogsForClient(profile.uid),
      getProgressPhotosForClient(profile.uid),
      profile.trainerId ? getMealBooksForTrainer(profile.trainerId).catch(() => []) : Promise.resolve([]),
      getWeightLogsForClient(profile.uid).catch(() => []),
      getStepLogsForClient(profile.uid).catch(() => [] as StepLog[]),
    ]);
    setPlan(planData);
    setMeals(mealData);
    setPhotos(photoData);
    setBooks(bookData);
    setPesos(pesoData);
    setPasos(pasoData);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayMeals = useMemo(() => meals.filter((m) => esHoy(m.date)), [meals]);
  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  // Objetivos del día: el plan del coach manda; si no hay, los macros que el
  // propio alumno calculó (onboarding/calculadora) guardados en su perfil.
  const nt = profile?.nutritionTargets;
  const targets = plan
    ? {
        name: plan.name,
        dailyCalories: plan.dailyCalories,
        proteinG: plan.proteinG,
        carbsG: plan.carbsG,
        fatG: plan.fatG,
        fromCoach: true,
      }
    : nt
      ? {
          name: 'Mis macros',
          dailyCalories: nt.dailyCalories,
          proteinG: nt.proteinG,
          carbsG: nt.carbsG,
          fatG: nt.fatG,
          fromCoach: false,
        }
      : null;
  const mealTrainerId = plan?.trainerId ?? profile?.trainerId ?? '';

  // El presupuesto de hoy: lo del plan más lo que se ha ganado andando (ver
  // lib/pasos.ts). Se calcula aquí y no dentro de la tarjeta porque la cifra
  // grande y la rejilla de macros tienen que contar lo mismo.
  const kcalDeLosPasos = caloriasDePasos(pasosDeHoy(pasos)?.steps ?? 0, ultimoPeso);
  const balance = balanceDelDia(targets?.dailyCalories ?? 0, totals.calories, kcalDeLosPasos);

  const handleSaveMacros = async (result: {
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }, goal: string) => {
    if (!profile) return;
    setCalcOpen(false);
    try {
      await updateUserProfile(profile.uid, {
        nutritionTargets: { ...result, goal, updatedAt: Date.now() },
      });
      await refreshProfile();
      showToast('Macros actualizados');
    } catch {
      showToast('No se pudieron guardar los macros');
    }
  };

  const handleAddMeal = async () => {
    if (!profile) return;
    const cal = Number(calories) || 0;
    if (!mealName.trim() || cal <= 0) {
      setError('Indica un nombre y las calorías de la comida.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMealLog({
        trainerId: mealTrainerId,
        clientId: profile.uid,
        date: Date.now(),
        name: mealName.trim(),
        calories: cal,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
      });
      setMealName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      // Guardada: el panel se cierra solo. Quien registra una comida quiere
      // ver el anillo bajar, no volver a mirar un formulario vacío.
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async (pose: PhotoPose) => {
    if (!profile) return;
    setUploadingPose(pose);
    try {
      const imageURL = await pickProgressPhoto();
      if (imageURL) {
        await createProgressPhoto({
          trainerId: profile.trainerId ?? '',
          clientId: profile.uid,
          pose,
          imageURL,
          date: Date.now(),
        });
        await load();
        showToast('Foto subida');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de progreso', message);
      else showToast(message);
    } finally {
      setUploadingPose(null);
    }
  };


  const handleDeletePhoto = async (id: string) => {
    if (!(await confirmar('¿Borrar esta foto de progreso?'))) return;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteProgressPhoto(id);
      showToast('Foto borrada');
    } catch (e) {
      await load();
      showToast(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  if (loading) return <CardsSkeleton tarjetas={4} />;

  return (
    <>
      {/* El peso, lo primero: es la cifra que la gente viene a mirar y a
          apuntar, y es aquí —junto a las calorías, los macros y los pasos—
          donde significa algo. En Progreso estaba entre los entrenos y los
          ejercicios, que es justo lo que no la explica. */}
      <BloqueDePeso profile={profile} logs={pesos} onCambio={load} />

      {/* La tarjeta de HOY se pinta SIEMPRE, con macros o sin ellos.
          Estaba metida entera dentro del "si tiene objetivos", y el efecto era
          que a quien no había calculado sus macros se le escondían también las
          comidas y —peor— los pasos que le pide su entrenador. Andar no
          depende de haber hecho una calculadora. */}
      <Card accent style={styles.section}>
        {!targets ? (
          <>
            <Text style={styles.sectionTitle}>Hoy</Text>
            <EmptyState
              icon="restaurant-outline"
              title="Aún no tienes objetivos"
              subtitle="Calcula tus calorías y macros en 30 segundos, o espera a que tu entrenador te asigne un plan."
            />
            <Button title="Calcular mis macros" onPress={() => setCalcOpen(true)} />
          </>
        ) : (
          <>
            <View style={styles.hoyHeader}>
              <Text style={styles.sectionTitle}>Hoy</Text>
              <Text style={styles.planName}>{targets.name}</Text>
            </View>

            {/* Lo que queda por comer HOY, contando lo que se ha ganado
                andando. Los pasos suman al presupuesto en vez de restarse de
                lo comido: es la misma resta dicha al derecho, y así se
                entiende sin pensar. */}
            <View style={styles.calSummary}>
              <Text style={[styles.calBig, balance.pasado && { color: colors.danger }]}>
                {conMiles(Math.abs(balance.restantes))}
              </Text>
              <Text style={styles.calUnit}>
                {balance.pasado ? 'kcal de más' : 'kcal restantes'}
              </Text>
              <Text style={styles.calSub}>{textoDelBalance(balance)}</Text>
            </View>

            {/* Macros en rejilla 2x2: nunca se recortan en móvil. */}
            <View style={styles.macroGrid}>
              <MacroTile label="Calorías" consumed={totals.calories} target={balance.disponibles} unit="kcal" />
              <MacroTile label="Proteína" consumed={totals.proteinG} target={targets.proteinG} unit="g" />
              <MacroTile label="Carbohidratos" consumed={totals.carbsG} target={targets.carbsG} unit="g" />
              <MacroTile label="Grasas" consumed={totals.fatG} target={targets.fatG} unit="g" />
            </View>

            {/* Rehacer el cálculo, SIEMPRE, aunque el plan lo haya puesto el
                coach. Un cuerpo de hace seis meses y diez kilos no es el
                mismo, y hasta ahora quien tenía plan de entrenador no tenía
                forma de volver a la calculadora ni para mirar. Lo que calcule
                se guarda en SU ficha; mientras el coach tenga plan activo,
                manda el del coach. */}
            <Pressable onPress={() => setCalcOpen(true)} style={styles.recalcBtn} hitSlop={6}>
              <Ionicons name="calculator-outline" size={14} color={colors.primary} />
              <Text style={styles.recalcText}>
                {targets.fromCoach ? 'Rehacer mi ficha nutricional' : 'Recalcular mis macros'}
              </Text>
            </Pressable>
            {targets.fromCoach ? (
              <Text style={styles.recalcPista}>
                Mientras tu entrenador tenga un plan activo, manda el suyo.
              </Text>
            ) : null}
          </>
        )}

        {/* Las comidas y los pasos van fuera del "si tiene objetivos": se
            apuntan igual, con plan o sin él, y son la otra mitad de lo que
            pasa hoy. */}
        {targets ? (
          <>
            {/* Las comidas, DENTRO del conteo y no en una tarjeta debajo. Eran
                dos tarjetas para una sola cosa: cuánto llevas hoy y de qué.
                Apuntar una comida cambia la cifra de arriba, así que estar
                separadas obligaba a mirar en dos sitios el mismo número. */}
            <View style={styles.bloqueComidas}>
              <View style={styles.hoyHeader}>
                <Text style={styles.subtitulo}>Comidas de hoy</Text>
                {todayMeals.length > 0 ? (
                  <Text style={styles.mealCount}>
                    {todayMeals.length} · {conMiles(totals.calories)} kcal
                  </Text>
                ) : null}
              </View>
              {todayMeals.length === 0 ? (
                <Text style={styles.mutedText}>Todavía no has registrado comidas hoy.</Text>
              ) : (
                todayMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealMacros}>
                        P{meal.proteinG} · C{meal.carbsG} · G{meal.fatG}
                      </Text>
                    </View>
                    <Text style={styles.mealKcal}>{meal.calories} kcal</Text>
                  </View>
                ))
              )}
              <Button
                title="+ Añadir comida"
                variant="secondary"
                onPress={() => setFormOpen(true)}
                style={{ marginTop: spacing.md }}
              />
            </View>

          </>
        ) : null}

        {/* Y los pasos, en la misma tarjeta: son la otra mitad de la cifra de
            arriba. Ver el número que suma justo debajo del número al que suma
            es lo que hace que andar deje de ser un adorno. Se enseñan aunque
            no haya macros: el objetivo de pasos lo pone el ENTRENADOR, y
            escondérselo a quien no ha hecho la calculadora es esconderle lo
            que su coach le ha pedido. */}
        {profile ? (
          <ContadorDePasos
            profile={profile}
            pesoKg={ultimoPeso}
            registros={pasos}
            onCambio={load}
          />
        ) : null}
      </Card>

          {/* El formulario vivía siempre abierto: cinco campos vacíos ocupando
              media pantalla cada vez que entrabas, y las comidas del día
              —lo que se viene a mirar— empujadas por debajo. Ahora se pide
              cuando se va a usar. */}
          <Sheet
            visible={formOpen}
            onClose={() => setFormOpen(false)}
            titulo="Registrar comida"
          >
            <TextField placeholder="Ej. Desayuno" value={mealName} onChangeText={setMealName} />
            <View style={styles.row}>
              <TextField
                placeholder="Kcal"
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
                containerStyle={styles.smallField}
              />
              <TextField
                placeholder="Proteína (g)"
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
                containerStyle={styles.smallField}
              />
            </View>
            <View style={styles.row}>
              <TextField
                placeholder="Carbos (g)"
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
                containerStyle={styles.smallField}
              />
              <TextField
                placeholder="Grasas (g)"
                keyboardType="numeric"
                value={fat}
                onChangeText={setFat}
                containerStyle={styles.smallField}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Añadir comida" onPress={handleAddMeal} loading={saving} />
          </Sheet>

      {/* Libretas de comida del coach: recetas y platos por foto, dentro de la app. */}
      {books.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Libretas de tu coach</Text>
          <Text style={styles.hint}>Recetas y ejemplos de platos que ha preparado tu entrenador.</Text>
          {books.map((book) => (
            <View key={book.id} style={styles.bookBlock}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              {book.photos.length === 0 ? (
                <Text style={styles.mutedText}>Sin fotos todavía.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {book.photos.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.bookPhotoWrap}
                      onPress={() => setZoomPhoto(p.imageURL)}
                    >
                      <Image source={{ uri: p.imageURL }} style={styles.bookPhoto} resizeMode="cover" />
                      {p.caption ? <Text style={styles.bookCaption}>{p.caption}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
        </Card>
      ) : null}

      {/* Fotos de progreso (antes en la pestaña Progreso). */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Fotos de progreso</Text>
        <Text style={styles.hint}>
          Sube fotos de frente, perfil y espalda. Solo tú y tu entrenador las veréis.
        </Text>
        <View style={styles.poseRow}>
          {PHOTO_POSES.map((pose) => (
            <Button
              key={pose.key}
              title={pose.label}
              variant="secondary"
              onPress={() => handleAddPhoto(pose.key)}
              loading={uploadingPose === pose.key}
              /*
               * `compacto` no es un adorno: son tres botones en una fila de
               * móvil. Con el relleno normal (24 a cada lado) al texto le
               * quedaban 52 px para una palabra que mide 68, y "Frente",
               * "Perfil" y "Espalda" salían como "F…", "P…" y "E…".
               */
              compacto
              style={styles.poseBtn}
            />
          ))}
        </View>
        {photos.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no has subido fotos de progreso.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <Pressable
                key={p.id}
                style={styles.photoCard}
                onLongPress={() => handleDeletePhoto(p.id)}
                delayLongPress={350}
              >
                <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoInfo}>
                  <Text style={styles.photoPose}>
                    {PHOTO_POSES.find((x) => x.key === p.pose)?.label ?? p.pose}
                  </Text>
                  <Text style={styles.photoDate}>
                    {fechaCorta(p.date)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {photos.length > 0 ? (
          <Text style={styles.deleteHint}>Mantén pulsada una foto para borrarla.</Text>
        ) : null}
      </Card>

      {/* Foto ampliada (lightbox): pulsa fuera o la X para cerrar. */}
      <Modal visible={!!zoomPhoto} transparent animationType="fade" onRequestClose={() => setZoomPhoto(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomPhoto(null)}>
          {zoomPhoto ? (
            <Image source={{ uri: zoomPhoto }} style={styles.zoomImage} resizeMode="contain" />
          ) : null}
          <Pressable style={styles.zoomClose} onPress={() => setZoomPhoto(null)} hitSlop={8}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calculadora de macros (recalcular). */}
      <Modal visible={calcOpen} animationType="slide" onRequestClose={() => setCalcOpen(false)}>
        <ScreenContainer>
          <View style={styles.calcHeader}>
            <Text style={styles.title}>Calcular mis macros</Text>
            <Pressable onPress={() => setCalcOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <MacroCalculator submitLabel="Guardar mis macros" onDone={handleSaveMacros} />
        </ScreenContainer>
      </Modal>
    </>
  );
}

/** Casilla de macro para la rejilla 2x2, con mini barra de progreso. */
function MacroTile({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}) {
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  return (
    <View style={styles.macroTile}>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.macroValue}>
        <Text style={[styles.macroConsumed, over && { color: colors.danger }]}>
          {conMiles(Math.round(consumed))}
        </Text>
        <Text style={styles.macroTarget}>
          {' '}/ {conMiles(Math.round(target))} {unit}
        </Text>
      </Text>
      <View style={styles.macroTrack}>
        <View
          style={[
            styles.macroFill,
            { width: `${ratio * 100}%`, backgroundColor: over ? colors.danger : colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  subtitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  recalcPista: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 2 },
  // Las secciones de dentro de la tarjeta de hoy se separan con una línea, no
  // con hueco: así se lee como una sola tarjeta con partes y no como tres
  // tarjetas metidas a la fuerza en una.
  bloqueComidas: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { ...typography.small, color: colors.textFaint, marginBottom: spacing.sm, lineHeight: 18 },
  hoyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planName: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  calSummary: { alignItems: 'center', marginBottom: spacing.md },
  calBig: {
    ...typography.h1,
    ...tabularNums,
    color: colors.primaryBright,
    fontFamily: fonts.heading,
    fontSize: 44,
    lineHeight: 48,
  },
  calUnit: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  calSub: { ...typography.small, color: colors.textFaint, marginTop: 4 },
  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  recalcText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: { width: '92%', height: '80%' },
  zoomClose: { position: 'absolute', top: 44, right: 20 },
  // Rejilla 2x2 fiable en móvil: dos columnas al 48% con hueco entre ellas.
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  macroTile: {
    width: '48%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  macroLabel: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  macroValue: { marginTop: 2, marginBottom: spacing.xs },
  macroConsumed: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  macroTarget: { ...typography.small, color: colors.textFaint },
  macroTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  macroFill: { height: '100%', borderRadius: radius.full },
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1, minWidth: 0 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  mutedText: { ...typography.small, color: colors.textFaint },
  mealCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  mealMacros: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  mealKcal: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  bookBlock: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  bookTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },
  bookPhotoWrap: { marginRight: spacing.sm, width: 130 },
  bookPhoto: { width: 130, height: 165, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  bookCaption: { ...typography.small, color: colors.textMuted, marginTop: 4, fontSize: 11 },
  /*
   * Se parte en dos filas antes que cortar una palabra.
   *
   * Con `compacto` los tres caben en un móvil normal, pero en uno de 320 px a
   * "Espalda" le faltan quince píxeles. Con un ancho mínimo y permiso para
   * envolver, ahí se colocan dos arriba y uno abajo y se leen los tres. Es el
   * mismo criterio que ya usan las otras filas de botones de la app.
   */
  poseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  /*
   * Sin `paddingHorizontal`: este estilo va al ENVOLTORIO del botón, no a su
   * interior, así que ponerlo aquí no quitaba ni un píxel de relleno. Lo que
   * de verdad lo cambia es la propiedad `compacto`.
   */
  poseBtn: { flexGrow: 1, flexBasis: 92, minWidth: 92 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoCard: { width: '31%' },
  photo: { width: '100%', aspectRatio: 0.8, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoInfo: { marginTop: 4 },
  photoPose: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, fontSize: 11 },
  photoDate: { ...typography.small, color: colors.textFaint, fontSize: 10 },
  deleteHint: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
});
