import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Card, IconButton, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';

import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export default function RecipesScreen() {
  const { recipeHistory, removeHistoryRecipe, restoreHistoryRecipe } = useMealPlanStore();
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoState, setUndoState] = useState<{
    recipe?: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number };
    dateKey?: string;
  } | null>(null);

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
      entry.recipes.forEach((recipe) => {
        if (bucket.seen.has(recipe.id)) {
          return;
        }
        bucket.items.push(recipe);
        bucket.seen.add(recipe.id);
      });
    });
    return Array.from(grouped.values()).map(({ dateKey, title, items }) => ({
      dateKey,
      title,
      data: items,
    }));
  }, [recipeHistory]);

  const renderRecipeItem = (
    item: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number },
    dateKey: string
  ) => (
    <RecipeListItem
      item={item}
      dateKey={dateKey}
      onRemove={(recipeId, removeDateKey, recipe) => {
        removeHistoryRecipe(recipeId, removeDateKey);
        setUndoState({ recipe, dateKey: removeDateKey });
        setUndoVisible(true);
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <GradientTitle text="Recipes" style={styles.title} />
      </View>
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
                    <View key={item.id}>{renderRecipeItem(item, section.dateKey)}</View>
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

function RecipeListItem({
  item,
  dateKey,
  onRemove,
}: {
  item: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number };
  dateKey: string;
  onRemove: (recipeId: string, dateKey: string, recipe: { id: string; title: string; imageUrl?: string | null; cookTimeMins: number; servings: number }) => void;
}) {
  const imageUrl = useRemoteImage(item.title, item.imageUrl ?? null, { kind: 'recipe' });
  return (
    <Card style={styles.card} onPress={() => router.push(`/recipe/${item.id}`)}>
      <View style={styles.cardClip}>
        <View style={styles.coverWrap}>
          <Image
            key={imageUrl ?? fallbackImage}
            source={{ uri: imageUrl ?? fallbackImage }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="none"
          />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#D9DEE6',
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
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverWrap: {
    position: 'relative',
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
});
