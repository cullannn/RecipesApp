import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button, Card, Chip, IconButton, Snackbar, TextInput } from 'react-native-paper';
import { router } from 'expo-router';

import { useDeals } from '@/src/hooks/useDeals';
import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useRecipes } from '@/src/hooks/useRecipes';
import { buildGroceryList, generateMealPlan } from '@/src/logic/mealPlan';
import { useGroceryListStore } from '@/src/state/useGroceryListStore';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { matchDealToIngredient } from '@/src/utils/matching';
import { generateRecipesFromPrompt } from '@/src/utils/openai';

const mealOptions = [1, 3, 5, 7];
const cuisineOptions = [
  'Chinese',
  'Thai',
  'Italian',
  'Japanese',
  'Korean',
  'Mexican',
  'Vietnamese',
  'Indian',
  'Greek',
  'Mediterranean',
  'American',
];

const cuisineKeywords = [
  'chinese',
  'thai',
  'italian',
  'japanese',
  'korean',
  'mexican',
  'vietnamese',
  'indian',
  'greek',
  'mediterranean',
  'american',
];

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

function RecipeCard({
  recipe,
  index,
  servingsTarget,
  onPress,
  onRemove,
}: {
  recipe: {
    id: string;
    title: string;
    imageUrl?: string;
    cookTimeMins: number;
    servings: number;
    ingredients: { name: string; quantity: number | string; unit: string }[];
  };
  index: number;
  servingsTarget?: number;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const imageUrl = useRemoteImage(recipe.title, recipe.imageUrl ?? null);
  const imageSource = imageUrl
    ? imageUrl.includes('/api/image-file/')
      ? 'openai'
      : imageUrl.includes('source.unsplash.com')
        ? 'unsplash'
        : 'remote'
    : 'default';
  const imageId = imageUrl ? imageUrl.split('?')[0].split('/').pop() ?? '' : '';
  const imageDebug = imageId ? `${imageSource} (${imageId})` : imageSource;
  return (
    <Card style={styles.planCard} onPress={onPress}>
      <View style={styles.planCardClip}>
        <View style={styles.coverWrap}>
          <Image
            key={imageUrl ?? fallbackImage}
            source={{ uri: imageUrl ?? fallbackImage }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="none"
          />
          {onRemove ? (
            <IconButton
              icon="close"
              size={18}
              onPress={onRemove}
              style={styles.removeButton}
              accessibilityLabel="Remove recipe from plan"
            />
          ) : null}
        </View>
        <Card.Content style={styles.planCardContent}>
          <Text style={styles.planTitle}>
            {index + 1}. {recipe.title}
          </Text>
          <Text style={styles.planMeta}>
            {recipe.cookTimeMins} mins • Serves {servingsTarget ?? recipe.servings}
          </Text>
          <Text style={styles.planMetaTitle}>Ingredients</Text>
          {recipe.ingredients.map((ingredient, ingredientIndex) => {
            const scaled = formatScaledQuantity(
              ingredient.quantity,
              ingredient.unit,
              servingsTarget ? servingsTarget / recipe.servings : 1
            );
            return (
              <Text key={`${recipe.id}-ingredient-${ingredientIndex}`} style={styles.planMeta}>
                {scaled} <Text style={styles.ingredientName}>{ingredient.name}</Text>
              </Text>
            );
          })}
        </Card.Content>
      </View>
    </Card>
  );
}

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
  const { postalCode, dietaryPreferences, householdSize, favoriteStores } = usePreferencesStore();
  const dealsQuery = useDeals({ postalCode });
  const { items: groceryItems, planId, setItems, toggleChecked } = useGroceryListStore();
  const {
    mealsRequested,
    maxCookTimeMins,
    servings,
    cuisineThemes,
    aiPrompt,
    aiRecipes,
    recipeHistory,
    addHistoryEntry,
    pinnedRecipeIds,
    plan,
    setMealsRequested,
    setMaxCookTimeMins,
    setServings,
    setCuisineThemes,
    setAiPrompt,
    setAiRecipes,
    setPlan,
  } = useMealPlanStore();

  const [maxCookInput, setMaxCookInput] = useState(maxCookTimeMins ? String(maxCookTimeMins) : '');
  const [servingsInput, setServingsInput] = useState(servings ? String(servings) : '');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<'update' | 'full' | null>(null);
  const canUpdatePlan = (plan?.recipes.length ?? 0) < mealsRequested;
  const [undoState, setUndoState] = useState<{
    previousPlan?: MealPlan;
  } | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  useEffect(() => {
    if (servings === undefined && householdSize) {
      setServings(householdSize);
      setServingsInput(String(householdSize));
      return;
    }
    if (!servingsInput && servings) {
      setServingsInput(String(servings));
    }
  }, [servings, servingsInput, householdSize, setServings]);

  const effectiveServings = servings && servings > 0 ? servings : undefined;
  const recentRecipeIds = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ids = new Set<string>();
    recipeHistory.forEach((entry) => {
      const createdAt = Date.parse(entry.createdAt);
      if (Number.isNaN(createdAt) || createdAt < cutoff) {
        return;
      }
      entry.recipes.forEach((recipe) => ids.add(recipe.id));
    });
    return ids;
  }, [recipeHistory]);

  const promptCuisines = useMemo(() => {
    const normalized = aiPrompt.toLowerCase();
    return cuisineKeywords.filter((keyword) => normalized.includes(keyword));
  }, [aiPrompt]);
  const selectedCuisines = useMemo(
    () => Array.from(new Set([...cuisineThemes, ...promptCuisines])),
    [cuisineThemes, promptCuisines]
  );

  const toggleCuisine = (option: string) => {
    const normalized = option.toLowerCase();
    if (cuisineThemes.includes(normalized)) {
      setCuisineThemes(cuisineThemes.filter((item) => item !== normalized));
      return;
    }
    setCuisineThemes([...cuisineThemes, normalized]);
  };


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

  const handleGeneratePlan = async (mode: 'update' | 'full' = 'update') => {
    if (!postalCode) {
      setError('Add a postal code in Settings to generate a plan.');
      setInfo('');
      return;
    }
    if (aiPrompt.trim() && dealsQuery.isLoading) {
      setError('Deals are still loading. Try again in a moment.');
      setInfo('');
      return;
    }
    setError('');
    setInfo('');
    setIsGeneratingPlan(true);
    setGeneratingMode(mode);
    let recipesForPlan = recipes;
    let planPinnedIds: string[] = [];
    if (aiPrompt.trim()) {
      try {
        const { recipes: generated, cuisineFallback } = await generateRecipesFromPrompt({
          prompt: aiPrompt.trim(),
          cuisines: selectedCuisines,
          count: mealsRequested,
        });
        if (generated.length === 0) {
          setError('No recipes matched that cooking vibe. Try another prompt.');
          setInfo('');
          setIsGeneratingPlan(false);
          setGeneratingMode(null);
          return;
        }
        if (generated.length < mealsRequested) {
          const generatedIds = new Set(generated.map((recipe) => recipe.id));
          const fallbackPool = recipes.filter((recipe) => !generatedIds.has(recipe.id));
          const needed = mealsRequested - generated.length;
          generated.push(...fallbackPool.slice(0, needed));
        }
        setAiRecipes(generated);
        recipesForPlan = generated;
        if (cuisineFallback && selectedCuisines.length > 0) {
          setInfo('AI used your prompt but could not guarantee cuisine tags.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate AI recipes.';
        setError(message);
        setInfo('');
        setIsGeneratingPlan(false);
        setGeneratingMode(null);
        return;
      }
    } else if (aiRecipes.length > 0) {
      setAiRecipes([]);
      setInfo('');
    }
    if (mode === 'update' && plan?.recipes?.length) {
      planPinnedIds = plan.recipes.map((item) => item.id);
      const pinnedSet = new Set(planPinnedIds);
      recipesForPlan = [
        ...plan.recipes,
        ...recipesForPlan.filter(
          (item) => !pinnedSet.has(item.id) && !recentRecipeIds.has(item.id)
        ),
      ];
    } else {
      recipesForPlan = recipesForPlan.filter((item) => !recentRecipeIds.has(item.id));
    }
    const generated = generateMealPlan({
      mealsRequested,
      recipes: recipesForPlan,
      deals: dealsQuery.data ?? [],
      pinnedRecipeIds: Array.from(new Set([...pinnedRecipeIds, ...planPinnedIds])),
      favoriteStores,
      constraints: {
        dietary: dietaryPreferences,
        cuisineThemes: selectedCuisines,
        aiPrompt,
        maxCookTimeMins: maxCookTimeMins ?? 60,
        servings,
      },
    });
    setPlan(generated);
    addHistoryEntry({
      id: generated.id,
      createdAt: generated.createdAt,
      recipes: generated.recipes,
    });
    setIsGeneratingPlan(false);
    setGeneratingMode(null);
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

  useEffect(() => {
    if (!plan) {
      return;
    }
    if (!dealsQuery.data && !dealsQuery.isLoading) {
      return;
    }
    const checkedMap = new Map(groceryItems.map((item) => [item.id, item.checked]));
    const merged = groceryList.map((item) => ({
      ...item,
      checked: checkedMap.get(item.id) ?? item.checked,
    }));
    const existingMap = new Map(groceryItems.map((item) => [item.id, item]));
    const hasChanges =
      planId !== plan.id ||
      merged.length !== groceryItems.length ||
      merged.some((item) => {
        const existing = existingMap.get(item.id);
        if (!existing) {
          return true;
        }
        if (existing.checked !== item.checked) {
          return true;
        }
        if (existing.totalQuantity !== item.totalQuantity) {
          return true;
        }
        const existingDeal = existing.matchedDeal?.dealId ?? '';
        const nextDeal = item.matchedDeal?.dealId ?? '';
        return existingDeal !== nextDeal;
      });
    if (!hasChanges) {
      return;
    }
    setItems(merged, plan.id);
  }, [
    plan,
    planId,
    groceryList,
    groceryItems,
    setItems,
    dealsQuery.data,
    dealsQuery.isLoading,
  ]);

  const topDeals = useMemo(() => {
    if (!plan) {
      return [];
    }
    const allDeals = dealsQuery.data ?? [];
    const ingredientNames = plan.recipes.flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.name)
    );
    const matches = allDeals.filter((deal) =>
      ingredientNames.some((name) => matchDealToIngredient(deal, name))
    );
    const storeCounts = matches.reduce<Map<string, number>>((acc, deal) => {
      acc.set(deal.store, (acc.get(deal.store) ?? 0) + 1);
      return acc;
    }, new Map());
    let fallbackStore = plan.selectedStore;
    if (!fallbackStore) {
      const bestStore = Array.from(storeCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      fallbackStore = bestStore && bestStore[1] > 0 ? bestStore[0] : undefined;
    }
    const scopedDeals = fallbackStore
      ? allDeals.filter((deal) => deal.store === fallbackStore)
      : allDeals;
    const scopedMatches = scopedDeals.filter((deal) =>
      ingredientNames.some((name) => matchDealToIngredient(deal, name))
    );
    const pantryStaples = [
      'soy sauce',
      'hoisin sauce',
      'oyster sauce',
      'fish sauce',
      'salt',
      'sugar',
      'flour',
      'oil',
      'olive oil',
      'vegetable oil',
      'canola oil',
      'sesame oil',
      'vinegar',
      'rice vinegar',
      'black vinegar',
      'rice',
      'pasta',
      'noodles',
      'spice',
      'seasoning',
      'broth',
      'stock',
      'syrup',
      'ketchup',
      'mustard',
      'mayo',
      'mayonnaise',
    ];
    const filteredDeals = scopedMatches.filter((deal) => {
      const category = deal.category?.toLowerCase() ?? '';
      const title = deal.title.toLowerCase();
      if (pantryStaples.some((staple) => title.includes(staple))) {
        return false;
      }
      if (category === 'pantry') {
        return false;
      }
      return true;
    });
    return filteredDeals
      .sort((a, b) => {
        if (b.price !== a.price) {
          return b.price - a.price;
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, 5);
  }, [plan, dealsQuery.data]);

  const renderTopDealTitle = (title: string) => {
    const quantityRegex = /[, ]+\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?\s?(kg|g|lb|oz|l|ml|cl|pcs|ct|count|pack|pk|x)\b/gi;
    const segments: Array<{ text: string; bold: boolean }> = [];
    let lastIndex = 0;
    let inParens = false;
    const pushText = (text: string, bold: boolean) => {
      if (text) {
        segments.push({ text, bold });
      }
    };

    const chars = Array.from(title);
    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      if (char === '(' || char === ')') {
        const chunk = title.slice(lastIndex, i);
        pushText(chunk, !inParens);
        pushText(char, false);
        lastIndex = i + 1;
        inParens = char === '(' ? true : false;
      }
    }
    if (lastIndex < title.length) {
      pushText(title.slice(lastIndex), !inParens);
    }

    const withQuantities: Array<{ text: string; bold: boolean }> = [];
    segments.forEach((segment) => {
      if (!segment.bold) {
        withQuantities.push(segment);
        return;
      }
      let segmentIndex = 0;
      const regex = new RegExp(quantityRegex.source, quantityRegex.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(segment.text)) !== null) {
        if (match.index === undefined) {
          continue;
        }
        const matchText = match[0];
        const matchStart = match.index;
        if (matchStart > segmentIndex) {
          withQuantities.push({ text: segment.text.slice(segmentIndex, matchStart), bold: true });
        }
        withQuantities.push({ text: matchText, bold: false });
        segmentIndex = matchStart + matchText.length;
      }
      if (segmentIndex < segment.text.length) {
        withQuantities.push({ text: segment.text.slice(segmentIndex), bold: true });
      }
    });

    if (withQuantities.length === 0) {
      return <Text style={styles.planMetaStrong}>{title}</Text>;
    }
    return (
      <Text>
        {withQuantities.map((segment, index) => (
          <Text
            // eslint-disable-next-line react/no-array-index-key
            key={`${segment.text}-${index}`}
            style={segment.bold ? styles.planMetaStrong : undefined}>
            {segment.text}
          </Text>
        ))}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <GradientTitle text="Plan" style={styles.title} />
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <ScrollView style={styles.scrollSurface} contentContainerStyle={styles.content}>
      <View style={styles.mealPrefsCard}>
        <Text style={styles.sectionTitle}>Meal Preferences</Text>

        <Text style={styles.label}>Number of meals</Text>
        <View style={styles.optionRow}>
          {mealOptions.map((count) => (
            <Chip
              key={count}
              selected={mealsRequested === count}
              onPress={() => setMealsRequested(count)}
              style={[
                styles.optionChip,
                mealsRequested === count && styles.optionChipSelected,
              ]}
              selectedColor="#1F1F1F">
            {count}
          </Chip>
        ))}
      </View>

        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.label}>Max cook time (mins)</Text>
            <TextInput
              mode="outlined"
              style={styles.input}
              value={maxCookInput}
              onChangeText={handleMaxCookChange}
              keyboardType="number-pad"
              placeholder="60"
              textColor="#5F6368"
              placeholderTextColor="#B0B6BC"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Servings</Text>
            <TextInput
              mode="outlined"
              style={styles.input}
              value={servingsInput}
              onChangeText={handleServingsChange}
              keyboardType="number-pad"
              placeholder="2"
              textColor="#5F6368"
              placeholderTextColor="#B0B6BC"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Cuisine themes</Text>
          <View style={styles.chipRow}>
            {cuisineOptions.map((option) => {
              const normalized = option.toLowerCase();
              const active = cuisineThemes.includes(normalized);
              return (
                <Chip
                  key={option}
                  selected={active}
                  onPress={() => toggleCuisine(option)}
                  style={[styles.chip, active && styles.chipSelected]}
                  selectedColor="#1F1F1F">
                  {option}
                </Chip>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Cooking vibe</Text>
          <TextInput
            mode="outlined"
            style={[styles.input, styles.promptInput]}
            value={aiPrompt}
            onChangeText={setAiPrompt}
          placeholder="e.g., asian italian fusion"
            multiline
            textColor="#5F6368"
            placeholderTextColor="#B0B6BC"
          />
        </View>

        <View style={styles.actionRow}>
          <Button
            mode="contained"
            onPress={() => handleGeneratePlan('update')}
            loading={isGeneratingPlan && generatingMode === 'update'}
            disabled={isGeneratingPlan || !canUpdatePlan}
            style={styles.primaryButton}>
            {plan ? 'Update plan' : 'Generate plan'}
          </Button>
          <Button
            mode="contained"
            onPress={() => handleGeneratePlan('full')}
            loading={isGeneratingPlan && generatingMode === 'full'}
            disabled={isGeneratingPlan}
            buttonColor="#1B7F3A"
            textColor="#FFFFFF"
            style={styles.secondaryButton}>
            New plan
          </Button>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
      </View>

      {plan && (
        <View style={styles.topDealsBar}>
          <Text style={styles.sectionTitle}>Top Savings This Week</Text>
          {plan.selectedStore ? (
            <Text style={styles.planStore}>
              Go-to store: <Text style={styles.planStoreStrong}>{plan.selectedStore}</Text>
            </Text>
          ) : null}
          {topDeals.length > 0 ? (
            topDeals.map((deal) => (
              <Text key={deal.id} style={styles.planMeta}>
                {renderTopDealTitle(deal.title)} • CAD {deal.price.toFixed(2)} / {deal.unit}
              </Text>
            ))
          ) : (
            <Text style={styles.planMeta}>No matching deals yet.</Text>
          )}
        </View>
      )}

      <View style={styles.planBlock}>
        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}>Your Curated Recipes</Text>
          {effectiveServings ? (
            <Text style={styles.planStore}>Servings {effectiveServings}</Text>
          ) : null}
          {selectedCuisines.length ? (
            <Text style={styles.planStore}>
              Cuisine: {selectedCuisines.map((item) => item[0].toUpperCase() + item.slice(1)).join(', ')}
            </Text>
          ) : null}
          {plan?.recipes.length ? (
            plan.recipes.map((recipe, index) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                index={index}
                servingsTarget={effectiveServings}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                onRemove={() => {
                  if (!plan) {
                    return;
                  }
                  const previousPlan = plan;
                  const remaining = plan.recipes.filter((item) => item.id !== recipe.id);
                  setPlan({ ...plan, recipes: remaining, mealsRequested: remaining.length });
                  setUndoState({ previousPlan });
                  setUndoVisible(true);
                }}
              />
            ))
          ) : (
            <Text style={styles.placeholderText}>
              {dealsQuery.isLoading ? 'Loading deals...' : 'Generate a plan to see recipes here.'}
            </Text>
          )}
        </View>
      </View>

      {plan?.recipes.length ? (
        <View style={styles.planBlock}>
          <Text style={styles.sectionTitle}>Grocery List</Text>
          {groceryItems.length ? (
            groceryItems.map((item) => (
              <Pressable key={item.id} style={styles.groceryRow} onPress={() => toggleChecked(item.id)}>
                <View style={[styles.checkboxBox, item.checked && styles.checkboxBoxChecked]}>
                  {item.checked ? <Text style={styles.checkboxMark}>X</Text> : null}
                </View>
                <View style={styles.groceryText}>
                  <Text style={[styles.groceryName, item.checked && styles.groceryChecked]}>
                    {item.name}
                  </Text>
                  <Text style={styles.groceryMeta}>
                    Buy: {item.totalQuantity}
                    {item.matchedDeal
                      ? ` • ${item.matchedDeal.store} $${item.matchedDeal.price.toFixed(2)}`
                      : plan?.selectedStore
                        ? ` • ${plan.selectedStore}`
                        : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.placeholderText}>No grocery items yet.</Text>
          )}
        </View>
      ) : null}
        </ScrollView>
      </View>
      <Snackbar
        visible={undoVisible}
        onDismiss={() => setUndoVisible(false)}
        duration={4000}
        action={{
          label: 'Undo',
          onPress: () => {
            if (!undoState?.previousPlan) {
              return;
            }
            setPlan(undoState.previousPlan);
            setUndoVisible(false);
            setUndoState(null);
          },
        }}>
        Recipe removed.
      </Snackbar>
    </SafeAreaView>
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
  scrollSurface: {
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  mealPrefsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'stretch',
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 40,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  promptInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    borderRadius: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F1F3F4',
  },
  chipSelected: {
    backgroundColor: '#D8EFDF',
  },
  optionChip: {
    backgroundColor: '#F1F3F4',
  },
  optionChipSelected: {
    backgroundColor: '#D8EFDF',
  },
  placeholderText: {
    fontSize: 13,
    color: '#5F6368',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  error: {
    color: '#c0392b',
    marginBottom: 12,
  },
  info: {
    color: '#2c5aa0',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1B7F3A',
  },
  sectionItem: {
    fontSize: 12,
    color: '#6b635a',
    marginBottom: 4,
  },
  planSection: {
    marginTop: 8,
  },
  planBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    padding: 12,
    marginTop: 8,
  },
  topDealsBar: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
  },
  planImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  planStore: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 8,
  },
  planStoreStrong: {
    fontWeight: '700',
    color: '#1F1F1F',
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  planCardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverWrap: {
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
  },
  planCardContent: {
    paddingTop: 12,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1F1F1F',
  },
  planMeta: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 2,
  },
  planMetaStrong: {
    fontWeight: '700',
    color: '#1F1F1F',
  },
  ingredientName: {
    fontWeight: '700',
    color: '#1F1F1F',
  },
  planMetaTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: '#1F1F1F',
  },
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  groceryText: {
    flex: 1,
  },
  groceryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  groceryChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  checkboxBoxChecked: {
    backgroundColor: '#E7F4EC',
    borderColor: '#1B7F3A',
  },
  checkboxMark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B7F3A',
  },
  groceryMeta: {
    fontSize: 12,
    color: '#5F6368',
  },
});
