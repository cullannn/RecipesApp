import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useDeals } from '@/src/hooks/useDeals';
import { useRecipes } from '@/src/hooks/useRecipes';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { matchDealToIngredient } from '@/src/utils/matching';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipes = useRecipes();
  const recipe = recipes.find((item) => item.id === id);
  const { postalCode } = usePreferencesStore();
  const dealsQuery = useDeals({ postalCode });
  const { pinnedRecipeIds, togglePinnedRecipe } = useMealPlanStore();

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Recipe not found.</Text>
      </View>
    );
  }

  const isPinned = pinnedRecipeIds.includes(recipe.id);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.meta}>
        {recipe.cookTimeMins} mins • Serves {recipe.servings}
      </Text>
      <Pressable style={styles.primaryButton} onPress={() => togglePinnedRecipe(recipe.id)}>
        <Text style={styles.primaryButtonText}>{isPinned ? 'Remove from plan' : 'Add to plan'}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Ingredients</Text>
      {recipe.ingredients.map((ingredient, index) => {
        const matched = dealsQuery.data?.some((deal) =>
          matchDealToIngredient(deal, ingredient.name)
        );
        return (
          <Text key={`${ingredient.name}-${index}`} style={styles.ingredient}>
            {ingredient.quantity} {ingredient.unit} {ingredient.name}
            {matched ? ' • deal' : ''}
          </Text>
        );
      })}

      <Text style={styles.sectionTitle}>Steps</Text>
      {recipe.steps.map((step, index) => (
        <Text key={`${recipe.id}-step-${index}`} style={styles.step}>
          {index + 1}. {step}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  ingredient: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  step: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: '#0b6e4f',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
