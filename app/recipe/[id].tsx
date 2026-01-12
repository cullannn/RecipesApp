import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useRecipes } from '@/src/hooks/useRecipes';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipes = useRecipes();
  const { recipeHistory } = useMealPlanStore();
  const recipe =
    recipes.find((item) => item.id === id) ??
    recipeHistory.flatMap((entry) => entry.recipes).find((item) => item.id === id);

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Recipe not found.</Text>
      </View>
    );
  }

  const heroImage = useRemoteImage(recipe.title, recipe.imageUrl ?? null, { kind: 'recipe' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {heroImage ? <Image source={{ uri: heroImage }} style={styles.heroImage} /> : null}
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.meta}>
        {recipe.cookTimeMins} mins • Serves {recipe.servings}
      </Text>
      <Text style={styles.sectionTitle}>Ingredients</Text>
      {recipe.ingredients.map((ingredient, index) => (
        <Text key={`${ingredient.name}-${index}`} style={styles.ingredient}>
          {ingredient.quantity} {ingredient.unit} {ingredient.name}
        </Text>
      ))}

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
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  meta: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
    color: '#1F1F1F',
  },
  ingredient: {
    fontSize: 13,
    color: '#1F1F1F',
    marginBottom: 4,
  },
  step: {
    fontSize: 13,
    color: '#1F1F1F',
    marginBottom: 6,
  },
});
