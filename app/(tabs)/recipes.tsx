import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Card, IconButton, Snackbar, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';

import { PatternBackground } from '@/components/pattern-background';
import { LogoWithShimmer } from '@/components/logo-with-shimmer';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function RecipesScreen() {
  const { recipeHistory, removeHistoryRecipe, restoreHistoryRecipe, isGeneratingPlan } =
    useMealPlanStore();
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoState, setUndoState] = useState<{
    recipe?: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number };
    dateKey?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sections = useMemo(() => {
    const grouped = new Map<
      string,
      { dateKey: string; title: string; items: typeof recipeHistory[number]['recipes']; seen: Set<string> }
    >();
    const entries = [...recipeHistory].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    entries.forEach((entry) => {
      const createdAt = new Date(entry.createdAt);
      const dateKey = createdAt.toISOString().slice(0, 10);
      const label = createdAt.toLocaleDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { dateKey, title: label, items: [], seen: new Set() });
      }
      const bucket = grouped.get(dateKey);
      if (!bucket) {
        return;
      }
      const filteredRecipes = normalizedSearch
        ? entry.recipes.filter((recipe) => recipe.title.toLowerCase().includes(normalizedSearch))
        : entry.recipes;
      filteredRecipes.forEach((recipe) => {
        if (bucket.seen.has(recipe.id)) {
          return;
        }
        bucket.items.push(recipe);
        bucket.seen.add(recipe.id);
      });
    });
    return Array.from(grouped.values())
      .map(({ dateKey, title, items }) => ({
        dateKey,
        title,
        data: items,
      }))
      .filter((section) => section.data.length > 0);
  }, [recipeHistory, normalizedSearch]);

  const handleRemove = useCallback(
    (
      recipeId: string,
      removeDateKey: string,
      recipe: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number }
    ) => {
      removeHistoryRecipe(recipeId, removeDateKey);
      setUndoState({ recipe, dateKey: removeDateKey });
      setUndoVisible(true);
    },
    [removeHistoryRecipe]
  );
  const handlePress = useCallback((id: string) => {
    router.push(`/recipe/${id}`);
  }, []);

  const searchScale = useRef(new Animated.Value(1)).current;
  const animateSearchScale = useCallback(
    (value: number) => {
      Animated.timing(searchScale, {
        toValue: value,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [searchScale]
  );
  const openSearchModal = useCallback(() => {
    setSearchInput(searchQuery);
    setSearchModalVisible(true);
  }, [searchQuery]);
  const handleSearchSubmit = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setSearchModalVisible(false);
  }, [searchInput]);
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchInput('');
    setSearchModalVisible(false);
  }, []);
  const closeSearchModal = useCallback(() => setSearchModalVisible(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <LogoWithShimmer isActive={isGeneratingPlan} tintColor="#1F1F1F" size={32} />
            <View>
              <Text style={styles.headerTitle}>Recipes</Text>
            </View>
          </View>
          <AnimatedPressable
            style={[styles.searchButton, { transform: [{ scale: searchScale }] }]}
            onPress={openSearchModal}
            onPressIn={() => animateSearchScale(0.9)}
            onPressOut={() => animateSearchScale(1)}>
            <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" />
          </AnimatedPressable>
        </View>
      </View>
      <Modal animationType="fade" transparent visible={searchModalVisible} onRequestClose={closeSearchModal}>
        <View style={styles.searchModalBackdrop}>
          <View style={styles.searchModalContent}>
            <Text style={styles.searchModalTitle}>Search recipes</Text>
            <TextInput
              mode="outlined"
              placeholder="Salmon, Beef, Noodles..."
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={handleSearchSubmit}
              style={styles.searchModalInput}
              textColor="#2A2F34"
              placeholderTextColor="#9AA0A6"
              left={<TextInput.Icon icon="magnify" color="#7A8086" />}
              right={
                searchInput ? (
                  <TextInput.Icon icon="close-circle" color="#7A8086" onPress={() => setSearchInput('')} />
                ) : undefined
              }
            />
            <Button
              mode="contained"
              buttonColor="#1B7F3A"
              textColor="#FFFFFF"
              style={styles.searchModalButton}
              onPress={handleSearchSubmit}>
              Done
            </Button>
          </View>
        </View>
      </Modal>
      <View style={styles.contentSurface}>
        <PatternBackground />
        {sections.length === 0 ? (
          <Text style={styles.emptyText}>No plans yet. Generate a plan to see recipes here.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {sections.map((section) => (
              <View key={section.dateKey} style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <View style={styles.sectionBody}>
                  {section.data.map((item) => (
                    <View key={item.id}>
                      <RecipeListItem
                        item={item}
                        dateKey={section.dateKey}
                        onRemove={handleRemove}
                        onPress={handlePress}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <Snackbar
        visible={undoVisible}
        onDismiss={() => setUndoVisible(false)}
        duration={4000}
        action={{
          label: 'Undo',
          onPress: () => {
            if (!undoState?.recipe || !undoState.dateKey) {
              return;
            }
            restoreHistoryRecipe(undoState.recipe, undoState.dateKey);
            setUndoVisible(false);
            setUndoState(null);
          },
        }}>
        Recipe removed.
      </Snackbar>
    </SafeAreaView>
  );
}

const RecipeListItem = memo(function RecipeListItem({
  item,
  dateKey,
  onRemove,
  onPress,
}: {
  item: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number };
  dateKey: string;
  onRemove: (recipeId: string, dateKey: string, recipe: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number }) => void;
  onPress: (recipeId: string) => void;
}) {
  const imageUrl = useRemoteImage(item.title, item.imageUrl ?? null, { kind: 'recipe' });
  const isPlaceholder =
    !imageUrl ||
    imageUrl === fallbackImage ||
    imageUrl.includes('unsplash.com') ||
    imageUrl.includes('source.unsplash.com');
  const shimmerValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isPlaceholder) {
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isPlaceholder, shimmerValue]);
  const shimmerOpacity = shimmerValue.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] });
  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = useCallback(
    (value: number) => {
      Animated.timing(scale, {
        toValue: value,
        duration: 140,
        easing: Easing.out(Easing.circle),
        useNativeDriver: true,
      }).start();
    },
    [scale]
  );
  return (
    <AnimatedPressable
      style={[styles.cardPressable, { transform: [{ scale }] }]}
      onPress={() => onPress(item.id)}
      onPressIn={() => animateScale(0.96)}
      onPressOut={() => animateScale(1)}
      accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.cardClip}>
          <View style={styles.coverWrap}>
            <Image
              key={imageUrl ?? fallbackImage}
              source={{ uri: imageUrl ?? fallbackImage }}
              style={styles.cover}
              contentFit="cover"
              cachePolicy="none"
            />
            {isPlaceholder ? (
              <Animated.View style={[styles.imageShimmer, { opacity: shimmerOpacity }]} />
            ) : null}
            <IconButton
              icon="close"
              size={16}
              onPress={() => onRemove(item.id, dateKey, item)}
              style={styles.removeButton}
              accessibilityLabel="Remove recipe from history"
            />
          </View>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardContentRow}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.cookTimeMins} mins • Serves {item.servings}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={26}
                onPress={() => router.push(`/recipe/${item.id}`)}
                style={styles.actionButton}
                iconColor="#1B7F3A"
                accessibilityLabel="View recipe details"
              />
            </View>
          </Card.Content>
        </View>
      </Card>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#D9DEE6',
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B7F3A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: '#D8EFDF',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sectionBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#5F6368',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardPressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverWrap: {
    position: 'relative',
  },
  imageShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  cover: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    color: '#1F1F1F',
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    margin: 0,
    backgroundColor: 'transparent',
    padding: 0,
    width: 32,
    alignItems: 'flex-end',
    shadowColor: '#1B7F3A',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#5F6368',
  },
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  searchModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  searchModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  searchModalInput: {
    height: 40,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  searchModalButton: {
    marginTop: 6,
  },
});
