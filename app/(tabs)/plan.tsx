import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { useDeals } from '@/src/hooks/useDeals';
import { useRecipes } from '@/src/hooks/useRecipes';
import { buildGroceryList, generateMealPlan } from '@/src/logic/mealPlan';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';

const mealOptions = [3, 5, 7];

function formatScaledQuantity(
  quantity: number | string,
  unit: string,
  scale: number
): string {
  if (typeof quantity === 'number') {
    const scaled = Number.isFinite(scale) ? quantity * scale : quantity;
    const rounded = Math.round(scaled * 100) / 100;
    return `${rounded} ${unit}`.trim();
  }
  return `${quantity} ${unit}`.trim();
}

export default function PlanScreen() {
  const recipes = useRecipes();
  const { postalCode, dietaryPreferences } = usePreferencesStore();
  const dealsQuery = useDeals({ postalCode });
  const {
    mealsRequested,
    maxCookTimeMins,
    servings,
    pinnedRecipeIds,
    plan,
    setMealsRequested,
    setMaxCookTimeMins,
    setServings,
    setPlan,
  } = useMealPlanStore();

  const [maxCookInput, setMaxCookInput] = useState(maxCookTimeMins ? String(maxCookTimeMins) : '');
  const [servingsInput, setServingsInput] = useState(servings ? String(servings) : '');
  const [error, setError] = useState('');

  const effectiveServings = servings && servings > 0 ? servings : undefined;

  const pinnedRecipes = useMemo(
    () => recipes.filter((recipe) => pinnedRecipeIds.includes(recipe.id)),
    [recipes, pinnedRecipeIds]
  );

  const handleMaxCookChange = (value: string) => {
    setMaxCookInput(value);
    const parsed = Number.parseInt(value, 10);
    setMaxCookTimeMins(Number.isFinite(parsed) ? parsed : undefined);
  };

  const handleServingsChange = (value: string) => {
    setServingsInput(value);
    const parsed = Number.parseInt(value, 10);
    setServings(Number.isFinite(parsed) ? parsed : undefined);
  };

  const handleGeneratePlan = () => {
    if (!postalCode) {
      setError('Add a postal code in Settings to generate a plan.');
      return;
    }
    setError('');
    const generated = generateMealPlan({
      mealsRequested,
      recipes,
      deals: dealsQuery.data ?? [],
      pinnedRecipeIds,
      constraints: {
        dietary: dietaryPreferences,
        maxCookTimeMins,
        servings,
      },
    });
    setPlan(generated);
  };

  const groceryList = useMemo(() => {
    if (!plan) {
      return [];
    }
    const scopedDeals = plan.selectedStore
      ? (dealsQuery.data ?? []).filter((deal) => deal.store === plan.selectedStore)
      : dealsQuery.data ?? [];
    return buildGroceryList(plan, scopedDeals);
  }, [plan, dealsQuery.data]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Meal plan</Text>
      <Text style={styles.subtitle}>Choose how many meals to plan this week.</Text>

      <View style={styles.optionRow}>
        {mealOptions.map((count) => (
          <Pressable
            key={count}
            style={[styles.optionChip, mealsRequested === count && styles.optionChipActive]}
            onPress={() => setMealsRequested(count)}>
            <Text style={styles.optionText}>{count} meals</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Text style={styles.label}>Max cook time (mins)</Text>
          <TextInput
            style={styles.input}
            value={maxCookInput}
            onChangeText={handleMaxCookChange}
            keyboardType="number-pad"
            placeholder="45"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Servings</Text>
          <TextInput
            style={styles.input}
            value={servingsInput}
            onChangeText={handleServingsChange}
            keyboardType="number-pad"
            placeholder="2"
          />
        </View>
      </View>

      {pinnedRecipes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pinned recipes</Text>
          {pinnedRecipes.map((recipe) => (
            <Text key={recipe.id} style={styles.sectionItem}>
              {recipe.title}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.primaryButton} onPress={handleGeneratePlan}>
        <Text style={styles.primaryButtonText}>
          {plan ? 'Regenerate plan' : 'Generate plan'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.planSection}>
        <Text style={styles.sectionTitle}>This week</Text>
        {plan?.selectedStore ? (
          <Text style={styles.planStore}>Shop at: {plan.selectedStore}</Text>
        ) : null}
        {effectiveServings ? (
          <Text style={styles.planStore}>Servings target: {effectiveServings}</Text>
        ) : null}
        {plan?.recipes.length ? (
          plan.recipes.map((recipe, index) => (
            <View key={recipe.id} style={styles.planCard}>
              {recipe.imageUrl ? (
                <Image source={{ uri: recipe.imageUrl }} style={styles.planImage} />
              ) : null}
              <Text style={styles.planTitle}>
                {index + 1}. {recipe.title}
              </Text>
              <Text style={styles.planMeta}>
                {recipe.cookTimeMins} mins • Serves {effectiveServings ?? recipe.servings}
              </Text>
              <Text style={styles.planMetaTitle}>Ingredients</Text>
              {recipe.ingredients.map((ingredient, ingredientIndex) => {
                const scaled = formatScaledQuantity(
                  ingredient.quantity,
                  ingredient.unit,
                  effectiveServings ? effectiveServings / recipe.servings : 1
                );
                return (
                  <Text key={`${recipe.id}-ingredient-${ingredientIndex}`} style={styles.planMeta}>
                    {scaled} {ingredient.name}
                  </Text>
                );
              })}
            </View>
          ))
        ) : (
          <Text style={styles.placeholderText}>
            {dealsQuery.isLoading ? 'Loading deals...' : 'Generate a plan to see recipes here.'}
          </Text>
        )}
      </View>

      {plan?.recipes.length ? (
        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}>Grocery list</Text>
          {groceryList.length ? (
            groceryList.map((item) => (
              <View key={item.id} style={styles.groceryRow}>
                <View style={styles.groceryCheck} />
                <View style={styles.groceryText}>
                  <Text style={styles.groceryName}>{item.name}</Text>
                  <Text style={styles.groceryMeta}>
                    Buy: {item.totalQuantity}
                    {item.matchedDeal
                      ? ` • ${item.matchedDeal.store} $${item.matchedDeal.price.toFixed(2)}`
                      : plan?.selectedStore
                        ? ` • ${plan.selectedStore}`
                        : ''}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>No grocery items yet.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f1f1f1',
  },
  optionChipActive: {
    backgroundColor: '#d6f2e9',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 13,
    color: '#666',
  },
  primaryButton: {
    backgroundColor: '#0b6e4f',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#c0392b',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionItem: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  planSection: {
    marginTop: 8,
  },
  planImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  planStore: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  planCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  planMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  planMetaTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groceryCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#bbb',
    marginTop: 2,
    marginRight: 10,
  },
  groceryText: {
    flex: 1,
  },
  groceryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  groceryMeta: {
    fontSize: 12,
    color: '#666',
  },
});
