import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { useDeals } from '@/src/hooks/useDeals';
import { useRecipes } from '@/src/hooks/useRecipes';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { getRecipeDealMatches, scoreRecipe } from '@/src/utils/matching';

export default function RecipesScreen() {
  const { postalCode, dietaryPreferences } = usePreferencesStore();
  const recipes = useRecipes();
  const dealsQuery = useDeals({ postalCode });

  const rankedRecipes = useMemo(() => {
    const deals = dealsQuery.data ?? [];
    return [...recipes].sort((a, b) => {
      const scoreDiff =
        scoreRecipe(b, deals, dietaryPreferences) - scoreRecipe(a, deals, dietaryPreferences);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const titleDiff = a.title.localeCompare(b.title);
      if (titleDiff !== 0) {
        return titleDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }, [recipes, dealsQuery.data, dietaryPreferences]);

  return (
    <View style={styles.container}>
      <FlatList
        data={rankedRecipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const matches = getRecipeDealMatches(item, dealsQuery.data ?? []);
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/recipe/${item.id}`)}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
              ) : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.cookTimeMins} mins • Serves {item.servings}
              </Text>
              <Text style={styles.cardMeta}>
                {matches.length} deal ingredients matched
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#555',
  },
});
