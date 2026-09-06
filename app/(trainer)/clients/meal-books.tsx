import React, { useCallback, useState } from 'react';
import { frase } from '../../../lib/idioma';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { DragList } from '../../../components/DragList';
import { moveItem } from '../../../lib/useDragReorder';
import { TextField } from '../../../components/TextField';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import {
  createMealBook,
  deleteMealBook,
  getMealBooksForTrainer,
  updateMealBook,
} from '../../../lib/firestore/mealBooks';
import { pickMealPhoto } from '../../../lib/image';
import { confirmar } from '../../../lib/confirmar';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import type { MealBook } from '../../../lib/types';

// Tope de fotos por libreta: cada foto va comprimida dentro del documento y
// Firestore limita cada documento a 1 MB. Con este tope vamos sobrados.
const MAX_PHOTOS = 12;

export default function MealBooksScreen() {
  const { profile } = useAuth();
  const [books, setBooks] = useState<MealBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  // Libreta que se está renombrando (id) y el texto en curso.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyBook, setBusyBook] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setBooks(await getMealBooksForTrainer(profile.uid));
    } catch {
      showToast('No se pudieron cargar las libretas');
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );


  // Renombrar una libreta. Se guarda al confirmar (no en cada tecla) para no
  // escribir en Firestore con cada letra.
  const startRename = (book: MealBook) => {
    setRenaming(book.id);
    setRenameText(book.title);
  };
  const applyRename = async () => {
    const book = books.find((b) => b.id === renaming);
    const title = renameText.trim();
    setRenaming(null);
    if (!book || !title || title === book.title) return;
    setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, title } : b)));
    try {
      await updateMealBook(book.id, { title });
    } catch {
      showToast('No se pudo renombrar');
      setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, title: book.title } : b)));
    }
  };

  // Reordenar arrastrando. Se reescribe el `order` de TODAS: si solo se
  // tocaran las que cambian de sitio, las libretas antiguas sin `order`
  // seguirían sin tenerlo y la lista volvería a descolocarse.
  const reordenar = (from: number, to: number) => {
    const conOrden = moveItem(books, from, to).map((b, i) => ({ ...b, order: i }));
    setBooks(conOrden);
    conOrden.forEach((b, i) => {
      updateMealBook(b.id, { order: i }).catch(() => {});
    });
  };

  const handleCreate = async () => {
    if (!profile || !newTitle.trim()) return;
    setCreating(true);
    try {
      const order = books.length;
      const id = await createMealBook({
        trainerId: profile.uid,
        title: newTitle.trim(),
        photos: [],
        order,
      });
      setBooks((prev) => [
        ...prev,
        {
          id,
          trainerId: profile.uid,
          title: newTitle.trim(),
          photos: [],
          order,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      setNewTitle('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo crear la libreta');
    } finally {
      setCreating(false);
    }
  };

  const handleAddPhoto = async (book: MealBook) => {
    if (book.photos.length >= MAX_PHOTOS) {
      showToast(frase`Máximo ${MAX_PHOTOS} fotos por libreta. Crea otra libreta.`);
      return;
    }
    setBusyBook(book.id);
    try {
      const imageURL = await pickMealPhoto();
      if (imageURL) {
        const photos = [...book.photos, { id: `${Date.now()}`, imageURL }];
        setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, photos } : b)));
        await updateMealBook(book.id, { photos });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto', message);
      else showToast(message);
    } finally {
      setBusyBook(null);
    }
  };

  const handleRemovePhoto = async (book: MealBook, photoId: string) => {
    if (!(await confirmar('¿Quitar esta foto de la libreta?'))) return;
    const photos = book.photos.filter((p) => p.id !== photoId);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, photos } : b)));
    try {
      await updateMealBook(book.id, { photos });
    } catch {
      await load();
    }
  };

  const handleDeleteBook = async (book: MealBook) => {
    if (!(await confirmar(frase`¿Borrar la libreta "${book.title}"? Tus alumnos dejarán de verla.`)))
      return;
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    try {
      await deleteMealBook(book.id);
      showToast('Libreta borrada');
    } catch {
      await load();
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Libretas de comida</Text>
      <Text style={styles.subtitle}>
        Sube tus cuadernos de recetas y platos por foto. Los verán TODOS tus alumnos dentro
        de la app, al final de su pestaña de nutrición.
      </Text>

      <Card style={styles.createCard}>
        <Text style={styles.sectionTitle}>Nueva libreta</Text>
        {/* El marcador va corto: "Título (Ej. Recetas de desayuno)" no cabía en
            un móvil de 320 px y se leía sin cerrar el paréntesis. Y sobraba la
            palabra "Título", que ya la dice el encabezado de la tarjeta. */}
        <TextField
          placeholder="Ej. Recetas de desayuno"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <Button
          title="Crear libreta"
          onPress={handleCreate}
          loading={creating}
          disabled={!newTitle.trim()}
        />
      </Card>

      {books.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="Aún no tienes libretas"
          subtitle="Crea tu primera libreta y añade fotos de tus platos y recetas."
        />
      ) : (
        <DragList
          items={books}
          keyOf={(b) => b.id}
          onReorder={reordenar}
          handleOnly
          renderItem={(book, index, arrastrando, asa) => (
          <Card style={[styles.section, arrastrando && styles.sectionDragging]}>
            <View style={styles.bookHead}>
              {renaming === book.id ? (
                <TextInput
                  value={renameText}
                  onChangeText={setRenameText}
                  onBlur={applyRename}
                  onSubmitEditing={applyRename}
                  autoFocus
                  style={styles.renameInput}
                  placeholder="Nombre de la libreta"
                  placeholderTextColor={colors.textFaint}
                />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => startRename(book)}>
                  <View style={styles.titleRow}>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Ionicons name="pencil" size={13} color={colors.textFaint} />
                  </View>
                </Pressable>
              )}
              {/* Asa para reordenar: el título se toca para renombrar, así
                  que el arrastre necesita su propio sitio. */}
              <View {...asa} style={styles.dragHandle}>
                <Ionicons name="reorder-three" size={20} color={colors.textFaint} />
              </View>
              <Pressable onPress={() => handleDeleteBook(book)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
              </Pressable>
            </View>

            {book.photos.length === 0 ? (
              <Text style={styles.mutedText}>Aún no hay fotos en esta libreta.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {book.photos.map((p) => (
                  <View key={p.id} style={styles.photoWrap}>
                    <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                    <Pressable
                      onPress={() => handleRemovePhoto(book, p.id)}
                      style={styles.photoRemove}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={14} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            <Button
              title={busyBook === book.id ? 'Subiendo…' : 'Añadir foto'}
              variant="secondary"
              onPress={() => handleAddPhoto(book)}
              loading={busyBook === book.id}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.count}>
              {book.photos.length}/{MAX_PHOTOS} fotos
            </Text>
          </Card>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.lg },
  createCard: { marginBottom: spacing.md },
  section: { marginBottom: 0 },
  sectionDragging: { borderColor: colors.hairline },
  dragHandle: { padding: spacing.xs },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  bookHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  bookTitle: { ...typography.h3, color: colors.text, flex: 1 },
  mutedText: { ...typography.small, color: colors.textFaint },
  photoStrip: { marginVertical: spacing.xs },
  photoWrap: { marginRight: spacing.sm, position: 'relative' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  renameInput: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    paddingVertical: 2,
  },
  photo: { width: 120, height: 150, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { ...typography.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs },
});
