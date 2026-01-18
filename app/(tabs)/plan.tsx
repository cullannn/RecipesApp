import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button, Chip, IconButton, Snackbar, TextInput } from 'react-native-paper';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';

import { useDeals } from '@/src/hooks/useDeals';
import { PatternBackground } from '@/components/pattern-background';
import { LogoWithShimmer } from '@/components/logo-with-shimmer';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useRecipes } from '@/src/hooks/useRecipes';
import type { DealItem, MealPlan } from '@/src/types';
import { buildGroceryList, generateMealPlan } from '@/src/logic/mealPlan';
import { useGroceryListStore } from '@/src/state/useGroceryListStore';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { matchDealToIngredient } from '@/src/utils/matching';
import { normalizeName, normalizeTokens } from '@/src/utils/normalization';
import { getStoreDisplayName, shouldIgnoreStore } from '@/src/utils/storeLogos';
import { generateRecipesFromPrompt } from '@/src/utils/openai';
import { useDealsStore } from '@/src/state/useDealsStore';

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

const TOP_SAVINGS_ALLOWED_TOKENS = new Set([
  'fresh',
  'frozen',
  'organic',
  'boneless',
  'skinless',
  'lean',
  'extra',
  'large',
  'small',
  'medium',
  'whole',
  'seedless',
  'sweet',
  'baby',
  'green',
  'red',
  'white',
  'yellow',
]);

function strictMatchTopSavings(dealTitle: string, ingredientName: string): boolean {
  const dealTokens = normalizeTokens(dealTitle).filter((token) => token.length > 2);
  const ingredientTokens = normalizeTokens(ingredientName).filter((token) => token.length > 2);
  if (dealTokens.length === 0 || ingredientTokens.length === 0) {
    return false;
  }
  const ingredientSet = new Set(ingredientTokens);
  for (const token of ingredientTokens) {
    if (!dealTokens.includes(token)) {
      return false;
    }
  }
  const extras = dealTokens.filter((token) => !ingredientSet.has(token));
  if (extras.length > 2) {
    return false;
  }
  return extras.every((token) => TOP_SAVINGS_ALLOWED_TOKENS.has(token));
}

function normalizePantryName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function canonicalizePantryName(value: string): string {
  const normalized = normalizePantryName(value);
  const tokens = normalized
    .split(' ')
    .filter((token) => token && !PANTRY_IGNORE_TOKENS.has(token));
  const cleaned = tokens.join(' ');
  const simplified = cleaned || normalized;
  if (simplified === 'vegetable oil' || simplified === 'cooking oil') {
    return 'cooking oil';
  }
  return simplified;
}

const PANTRY_IGNORE_TOKENS = new Set([
  'cooked',
  'fresh',
  'frozen',
  'chopped',
  'minced',
  'sliced',
  'diced',
  'ground',
  'shredded',
  'grated',
  'crushed',
  'peeled',
  'trimmed',
  'boneless',
  'skinless',
  'small',
  'large',
  'medium',
  'extra',
  'virgin',
  'low',
  'fat',
  'unsalted',
  'salted',
  'organic',
]);

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RecipeCard = memo(function RecipeCard({
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
  onPress?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const imageUrl = useRemoteImage(recipe.title, recipe.imageUrl ?? null);
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
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(recipe.id);
    }
  }, [onPress, recipe.id]);
  const handleRemove = useCallback(() => {
    if (onRemove) {
      onRemove(recipe.id);
    }
  }, [onRemove, recipe.id]);
  const imageSource = imageUrl
    ? imageUrl.includes('/api/image-file/')
      ? 'openai'
      : imageUrl.includes('source.unsplash.com')
        ? 'unsplash'
        : 'remote'
    : 'default';
  const imageId = imageUrl ? imageUrl.split('?')[0].split('/').pop() ?? '' : '';
  const imageDebug = imageId ? `${imageSource} (${imageId})` : imageSource;
  const [scale] = useState(() => new Animated.Value(1));
  const animateScale = useCallback(
    (toValue: number) => {
      Animated.timing(scale, {
        toValue,
        duration: 140,
        easing: Easing.out(Easing.circle),
        useNativeDriver: true,
      }).start();
    },
    [scale]
  );
  const handlePressIn = useCallback(() => animateScale(0.96), [animateScale]);
  const handlePressOut = useCallback(() => animateScale(1), [animateScale]);
  return (
    <AnimatedPressable
      style={[styles.planCardPressable, { transform: [{ scale }] }]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button">
      <View style={styles.planCardWrap}>
        <View style={styles.planCard}>
          <View style={styles.planCardClip}>
            <View style={styles.coverWrap}>
              <Image
                key={imageUrl ?? fallbackImage}
                source={{ uri: imageUrl ?? fallbackImage }}
                style={styles.cover}
                contentFit="cover"
                cachePolicy="none"
              />
              {isPlaceholder ? (
                <>
                  <Animated.View style={[styles.imageShimmer, { opacity: shimmerOpacity }]} />
                  <Image
                    source={require('../../assets/logos/app-logo/forkcast-logo-transparent.png')}
                    style={[styles.coverLogoOverlay, { opacity: 0.95 }]}
                    contentFit="contain"
                    tintColor="#FFFFFF"
                  />
                </>
              ) : null}
              {onRemove ? (
                <IconButton
                  icon="close"
                  size={18}
                  onPress={handleRemove}
                  style={styles.removeButton}
                  accessibilityLabel="Remove recipe from plan"
                />
              ) : null}
            </View>
            <View style={styles.planCardContent}>
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
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
});

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
  const { postalCode, dietaryPreferences, allergies, householdSize, favoriteStores, pantryItems } =
    usePreferencesStore();
  const dealsQuery = useDeals({ postalCode });
  const filteredDeals = useMemo(
    () => (dealsQuery.data ?? []).filter((deal) => !shouldIgnoreStore(deal.store)),
    [dealsQuery.data]
  );
  const { savedDealIds } = useDealsStore();
  const favoriteDealIdsForPlan = useMemo(() => {
    if (savedDealIds.length === 0 || filteredDeals.length === 0) {
      return [];
    }
    const valid = new Set(filteredDeals.map((deal) => deal.id));
    return savedDealIds.filter((id) => valid.has(id));
  }, [filteredDeals, savedDealIds]);
  const preferredIngredients = useMemo(() => {
    if (favoriteDealIdsForPlan.length === 0) {
      return [];
    }
    return filteredDeals
      .filter((deal) => favoriteDealIdsForPlan.includes(deal.id))
      .map((deal) => deal.title)
      .filter(Boolean)
      .slice(0, 6);
  }, [favoriteDealIdsForPlan, filteredDeals]);
  const pantryCatalog = useMemo(
    () =>
      pantryItems.map((item) => ({
        name: canonicalizePantryName(item.name),
        raw: item.name,
      })),
    [pantryItems]
  );

  const pantryMatches = useCallback(
    (name: string) => {
      const canonical = canonicalizePantryName(name);
      if (!canonical) {
        return false;
      }
      return pantryCatalog.some((pantry) => {
        if (!pantry.name) {
          return false;
        }
        if (pantry.name === canonical) {
          return true;
        }
        return pantry.name.includes(canonical) || canonical.includes(pantry.name);
      });
    },
    [pantryCatalog]
  );
  const { items: groceryItems, planId, setItems, toggleChecked } = useGroceryListStore();
  const {
    mealsRequested,
    maxCookTimeMins,
    servings,
    isGeneratingPlan,
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
    setIsGeneratingPlan,
    setCuisineThemes,
    setAiPrompt,
    setAiRecipes,
    setPlan,
  } = useMealPlanStore();

  const [maxCookInput, setMaxCookInput] = useState('');
  const [maxCookTouched, setMaxCookTouched] = useState(false);
  const [mealsDraft, setMealsDraft] = useState(mealsRequested);
  const sliderProgress = useSharedValue(mealsRequested);
  const sliderMin = useSharedValue(1);
  const sliderMax = useSharedValue(14);
  const handleMealsChange = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      sliderProgress.value = rounded;
      setMealsDraft(rounded);
    },
    [sliderProgress]
  );
  const handleMealsComplete = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      sliderProgress.value = rounded;
      setMealsDraft(rounded);
      setMealsRequested(rounded);
    },
    [setMealsRequested, sliderProgress]
  );
  const [servingsInput, setServingsInput] = useState('');
  const [servingsTouched, setServingsTouched] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [generatingMode, setGeneratingMode] = useState<'update' | 'full' | null>(null);
  const canUpdatePlan = (plan?.recipes.length ?? 0) < mealsRequested;
  const [undoState, setUndoState] = useState<{
    previousPlan?: MealPlan;
  } | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const handlePressRecipe = useCallback((id: string) => {
    router.push(`/recipe/${id}`);
  }, []);
  const handleRemoveRecipe = useCallback(
    (id: string) => {
      if (!plan) {
        return;
      }
      const previousPlan = plan;
      const remaining = plan.recipes.filter((item) => item.id !== id);
      setPlan({ ...plan, recipes: remaining, mealsRequested: remaining.length });
      setUndoState({ previousPlan });
      setUndoVisible(true);
      refreshGroceryList({ ...plan, recipes: remaining, mealsRequested: remaining.length });
    },
    [plan, setPlan, refreshGroceryList]
  );

  useEffect(() => {
    if (servingsTouched || maxCookTouched) {
      return;
    }
    if (servings === undefined) {
      const defaultServings = householdSize || 2;
      setServings(defaultServings);
      if (householdSize) {
        setServingsInput(String(defaultServings));
      }
      return;
    }
  }, [servings, householdSize, setServings, servingsTouched, maxCookTouched]);
  useEffect(() => {
    sliderProgress.value = mealsRequested;
    setMealsDraft(mealsRequested);
  }, [mealsRequested, sliderProgress]);

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
    setMaxCookTouched(true);
    const parsed = Number.parseInt(value, 10);
    setMaxCookTimeMins(Number.isFinite(parsed) ? parsed : undefined);
  };

  const handleServingsChange = (value: string) => {
    setServingsInput(value);
    setServingsTouched(true);
    const parsed = Number.parseInt(value, 10);
    setServings(Number.isFinite(parsed) ? parsed : undefined);
  };

  const refreshGroceryList = useCallback(
    (planToUse?: MealPlan) => {
      if (!planToUse) {
        return;
      }
      const scopedDeals = planToUse.selectedStore
        ? filteredDeals.filter((deal) => deal.store === planToUse.selectedStore)
        : filteredDeals;
      const next = buildGroceryList(planToUse, scopedDeals);
      const checkedMap = new Map(groceryItems.map((item) => [item.id, item.checked]));
      const merged = next.map((item) => {
        const pantryChecked = pantryMatches(item.name);
        return {
          ...item,
          checked: pantryChecked || (checkedMap.get(item.id) ?? item.checked),
        };
      });
      const existingMap = new Map(groceryItems.map((item) => [item.id, item]));
      const hasChanges =
        planId !== planToUse.id ||
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
      setItems(merged, planToUse.id);
    },
    [filteredDeals, groceryItems, pantryMatches, planId, setItems]
  );

  const orderedGroceryItems = useMemo(() => {
    if (!groceryItems.length) {
      return groceryItems;
    }
    return [...groceryItems].sort((a, b) => {
      if (a.checked === b.checked) {
        return 0;
      }
      return a.checked ? 1 : -1;
    });
  }, [groceryItems]);

  const handleGeneratePlan = async (mode: 'update' | 'full' = 'update') => {
    setError('');
    setInfo('');
    setIsGeneratingPlan(true);
    setGeneratingMode(mode);
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (mode === 'full') {
      setPlan(undefined as unknown as MealPlan);
    }
    if (!postalCode) {
      setError('Add a postal code in Settings to generate a plan.');
      setIsGeneratingPlan(false);
      setGeneratingMode(null);
      return;
    }
    if (aiPrompt.trim() && dealsQuery.isLoading) {
      setInfo('Deals are still loading. Plan will generate without them for now.');
    }
    try {
      let recipesForPlan = recipes;
      let planPinnedIds: string[] = [];
      if (aiPrompt.trim()) {
        const { recipes: generated, cuisineFallback } = await generateRecipesFromPrompt({
          prompt: aiPrompt.trim(),
          cuisines: selectedCuisines,
          count: mealsRequested,
          servings,
          maxCookTimeMins,
          dietaryPreferences,
          allergies,
          preferredIngredients,
        });
        if (generated.length === 0) {
          setError('No recipes matched that cooking vibe. Try another prompt.');
          setInfo('');
          return;
        }
        if (generated.length < mealsRequested) {
          let merged = [...generated];
          let attempt = 0;
          while (merged.length < mealsRequested && attempt < 2) {
            const needed = mealsRequested - merged.length;
            const excludeTitles = merged.map((recipe) => recipe.title).filter(Boolean);
            const { recipes: followup } = await generateRecipesFromPrompt({
              prompt: aiPrompt.trim(),
              cuisines: selectedCuisines,
              count: needed,
              servings,
              maxCookTimeMins,
              dietaryPreferences,
              allergies,
              preferredIngredients,
              excludeTitles,
            });
            merged = [...merged, ...followup].filter(
              (recipe, index, list) =>
                index ===
                list.findIndex(
                  (item) => item.title.toLowerCase().trim() === recipe.title.toLowerCase().trim()
                )
            );
            attempt += 1;
          }
          let usedLocalTopUp = false;
          if (merged.length < mealsRequested) {
            const existingTitles = new Set(
              merged.map((recipe) => recipe.title.toLowerCase().trim())
            );
            const fallbackPool = recipes.filter(
              (recipe) => !existingTitles.has(recipe.title.toLowerCase().trim())
            );
            const remaining = mealsRequested - merged.length;
            merged.push(...fallbackPool.slice(0, remaining));
            usedLocalTopUp = true;
          }
          console.log('[plan] ai followup results', {
            requested: mealsRequested,
            aiInitial: generated.length,
            aiFollowup: Math.max(0, merged.length - generated.length),
            final: Math.min(mealsRequested, merged.length),
            usedLocalTopUp,
          });
          generated.splice(0, generated.length, ...merged.slice(0, mealsRequested));
        }
        setAiRecipes(generated);
        recipesForPlan = generated;
        if (cuisineFallback && selectedCuisines.length > 0) {
          setInfo('AI used your prompt but could not guarantee cuisine tags.');
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
        deals: filteredDeals,
        pinnedRecipeIds: Array.from(new Set([...pinnedRecipeIds, ...planPinnedIds])),
        favoriteStores,
        favoriteDealIds: favoriteDealIdsForPlan,
        constraints: {
          dietary: dietaryPreferences,
          cuisineThemes: selectedCuisines,
          aiPrompt,
          maxCookTimeMins: maxCookTimeMins ?? 60,
          servings,
        },
      });
      console.log('[plan] generated recipes count', {
        requested: mealsRequested,
        returned: generated.recipes.length,
        source: aiPrompt.trim() ? 'ai' : 'local',
      });
      setPlan(generated);
      refreshGroceryList(generated);
      addHistoryEntry({
        id: generated.id,
        createdAt: generated.createdAt,
        recipes: generated.recipes,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI recipes.';
      setError(message);
      setInfo('');
      return;
    } finally {
      setIsGeneratingPlan(false);
      setGeneratingMode(null);
    }
  };

  useEffect(() => {
    refreshGroceryList(plan);
  }, [plan, refreshGroceryList]);

  const topSavings = useMemo(() => {
    if (!plan) {
      return { deals: [], store: undefined as string | undefined };
    }
    const allDeals = filteredDeals ?? [];
    const favoriteDeals = favoriteDealIdsForPlan.length
      ? allDeals.filter((deal) => favoriteDealIdsForPlan.includes(deal.id))
      : [];
    const ingredientEntries = plan.recipes
      .flatMap((recipe) => recipe.ingredients)
      .map((ingredient) => ({
        name: ingredient.name?.trim() ?? '',
        category: ingredient.category?.toLowerCase() ?? '',
      }))
      .filter((ingredient) => ingredient.name);
    const uniqueIngredientKeys = new Set<string>();
    const ingredientList = ingredientEntries.filter((ingredient) => {
      const key = `${ingredient.name.toLowerCase()}::${ingredient.category}`;
      if (uniqueIngredientKeys.has(key)) {
        return false;
      }
      uniqueIngredientKeys.add(key);
      return true;
    });
    const matchesIngredient = (deal: DealItem, ingredientName: string) => {
      const normalizedDeal = normalizeName(deal.title);
      const normalizedIngredient = normalizeName(ingredientName);
      if (!normalizedDeal || !normalizedIngredient) {
        return false;
      }
      if (normalizedDeal.includes('dried') && !normalizedIngredient.includes('dried')) {
        return false;
      }
      const ingredientTokens = normalizeTokens(ingredientName).filter((token) => token.length > 2);
      const dealTokens = normalizeTokens(deal.title).filter((token) => token.length > 2);
      const compactDeal = normalizedDeal.replace(/\s+/g, '');
      const compactIngredient = normalizedIngredient.replace(/\s+/g, '');
      if (!normalizedDeal.includes(normalizedIngredient) && !compactDeal.includes(compactIngredient)) {
        return false;
      }
      if (ingredientTokens.length === 1) {
        const target = ingredientTokens[0];
        if (!dealTokens.includes(target)) {
          return false;
        }
        const extras = dealTokens.filter((token) => token !== target);
        if (extras.length > 0 && !extras.every((token) => TOP_SAVINGS_ALLOWED_TOKENS.has(token))) {
          return false;
        }
      }
      return matchDealToIngredient(deal, ingredientName);
    };
    const matchesIngredientRelaxed = (deal: DealItem, ingredientName: string) => {
      const normalizedDeal = normalizeName(deal.title);
      const normalizedIngredient = normalizeName(ingredientName);
      if (!normalizedDeal || !normalizedIngredient) {
        return false;
      }
      if (normalizedDeal.includes('dried') && !normalizedIngredient.includes('dried')) {
        return false;
      }
      const compactDeal = normalizedDeal.replace(/\s+/g, '');
      const compactIngredient = normalizedIngredient.replace(/\s+/g, '');
      if (!normalizedDeal.includes(normalizedIngredient) && !compactDeal.includes(compactIngredient)) {
        return false;
      }
      return matchDealToIngredient(deal, ingredientName);
    };
    const storeCounts = new Map<string, { priced: number; total: number; protein: number }>();
    ingredientList.forEach((ingredient) => {
      const isProtein = ['meat', 'seafood', 'protein'].includes(ingredient.category);
      const matches = allDeals.filter((deal) => matchesIngredient(deal, ingredient.name));
      matches.forEach((deal) => {
        const entry = storeCounts.get(deal.store) ?? { priced: 0, total: 0, protein: 0 };
        if (typeof deal.price === 'number' && Number.isFinite(deal.price)) {
          entry.priced += 1;
        }
        entry.total += 1;
        if (isProtein) {
          entry.protein += 1;
        }
        storeCounts.set(deal.store, entry);
      });
    });
    let fallbackStore: string | undefined;
    if (favoriteDeals.length > 0) {
      const favoriteStoreCounts = new Map<string, number>();
      favoriteDeals.forEach((deal) => {
        favoriteStoreCounts.set(deal.store, (favoriteStoreCounts.get(deal.store) ?? 0) + 1);
      });
      const sortedFavorites = Array.from(favoriteStoreCounts.entries()).sort((a, b) => b[1] - a[1]);
      fallbackStore = sortedFavorites[0]?.[0];
    }
    if (storeCounts.size > 0) {
      const sortedStores = Array.from(storeCounts.entries()).sort((a, b) => {
        const proteinDiff = b[1].protein - a[1].protein;
        if (proteinDiff !== 0) {
          return proteinDiff;
        }
        const totalDiff = b[1].total - a[1].total;
        if (totalDiff !== 0) {
          return totalDiff;
        }
        return b[1].priced - a[1].priced;
      });
      fallbackStore = fallbackStore ?? sortedStores[0][0];
    }
    const scopedDeals = fallbackStore
      ? allDeals.filter((deal) => deal.store === fallbackStore)
      : allDeals;
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
    const topSavingsExclusions = [
      'sauce',
      'gravy',
      'marinade',
      'dip',
      'salsa',
      'dressing',
      'seasoning',
      'chip',
      'chips',
      'crisps',
      'ramyeon',
      'ramen',
      'noodles',
      'dumpling',
      'snack',
      'cookie',
      'cake',
      'dorayaki',
      'juice',
      'drink',
      'beverage',
      'smoothie',
      'sparkling',
      'soda',
      'water',
      'breeze',
      'flower',
      'honeysuckle',
      'pan',
      'pot',
      'skillet',
      'wok',
      'baking sheet',
      'sheet pan',
      'cookware',
      'utensil',
      'knife',
    ];
    const spiceLikeExclusions = [
      'garlic',
      'ginger',
      'scallion',
      'green onion',
      'spring onion',
      'onion',
      'shallot',
      'chili',
      'pepper',
      'cilantro',
      'coriander',
      'parsley',
      'basil',
      'mint',
      'thyme',
      'rosemary',
      'sage',
      'dill',
      'bay leaf',
      'turmeric',
      'cumin',
      'paprika',
      'cardamom',
      'clove',
      'cinnamon',
    ];
    const spiceExceptions = ['sprout', 'shoot', 'greens', 'leaf', 'stalk', 'stem'];
    const filteredMatches = scopedDeals.filter((deal) => {
      const title = deal.title.toLowerCase();
      if (pantryStaples.some((staple) => title.includes(staple))) {
        return false;
      }
      if (topSavingsExclusions.some((term) => title.includes(term))) {
        return false;
      }
      if (spiceLikeExclusions.some((term) => title.includes(term))) {
        return spiceExceptions.some((term) => title.includes(term));
      }
      return true;
    });
    const sortedIngredients = [...ingredientList].sort((a, b) => {
      const aProtein = ['meat', 'seafood', 'protein'].includes(a.category);
      const bProtein = ['meat', 'seafood', 'protein'].includes(b.category);
      if (aProtein !== bProtein) {
        return aProtein ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    const ingredientMatches = sortedIngredients.flatMap((ingredient) =>
      filteredMatches.filter((deal) => matchesIngredient(deal, ingredient.name))
    );
    const uniqueMatches = new Map<string, DealItem>();
    ingredientMatches.forEach((deal) => {
      if (!uniqueMatches.has(deal.id)) {
        uniqueMatches.set(deal.id, deal);
      }
    });
    let deals = Array.from(uniqueMatches.values())
      .sort((a, b) => {
        const aCategory = a.category?.toLowerCase() ?? '';
        const bCategory = b.category?.toLowerCase() ?? '';
        const isAProtein = ['meat', 'seafood', 'protein'].includes(aCategory);
        const isBProtein = ['meat', 'seafood', 'protein'].includes(bCategory);
        if (isAProtein !== isBProtein) {
          return isAProtein ? -1 : 1;
        }
        const aPrice = Number.isFinite(a.price as number) ? (a.price as number) : null;
        const bPrice = Number.isFinite(b.price as number) ? (b.price as number) : null;
        if (aPrice === null && bPrice === null) {
          return a.title.localeCompare(b.title);
        }
        if (aPrice === null) {
          return 1;
        }
        if (bPrice === null) {
          return -1;
        }
        if (bPrice !== aPrice) {
          return bPrice - aPrice;
        }
        return a.title.localeCompare(b.title);
      });
    if (deals.length === 0) {
      const relaxedMatches = sortedIngredients.flatMap((ingredient) =>
        filteredMatches.filter((deal) => matchesIngredientRelaxed(deal, ingredient.name))
      );
      const relaxedUnique = new Map<string, DealItem>();
      relaxedMatches.forEach((deal) => {
        if (!relaxedUnique.has(deal.id)) {
          relaxedUnique.set(deal.id, deal);
        }
      });
      deals = Array.from(relaxedUnique.values()).sort((a, b) => {
        const aCategory = a.category?.toLowerCase() ?? '';
        const bCategory = b.category?.toLowerCase() ?? '';
        const isAProtein = ['meat', 'seafood', 'protein'].includes(aCategory);
        const isBProtein = ['meat', 'seafood', 'protein'].includes(bCategory);
        if (isAProtein !== isBProtein) {
          return isAProtein ? -1 : 1;
        }
        const aPrice = Number.isFinite(a.price as number) ? (a.price as number) : null;
        const bPrice = Number.isFinite(b.price as number) ? (b.price as number) : null;
        if (aPrice === null && bPrice === null) {
          return a.title.localeCompare(b.title);
        }
        if (aPrice === null) {
          return 1;
        }
        if (bPrice === null) {
          return -1;
        }
        if (bPrice !== aPrice) {
          return bPrice - aPrice;
        }
        return a.title.localeCompare(b.title);
      });
    }
    return { deals, store: deals.length > 0 ? fallbackStore : undefined };
  }, [plan, filteredDeals, favoriteDealIdsForPlan]);

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
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <LogoWithShimmer isActive={isGeneratingPlan} tintColor="#1F1F1F" size={32} />
            <View>
              <Text style={styles.headerTitle}>Plan</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <ScrollView style={styles.scrollSurface} contentContainerStyle={styles.content}>
      <View style={styles.mealPrefsCard}>
        <Text style={styles.sectionTitle}>Meal Preferences</Text>

        <Text style={styles.label}># of Meals this week</Text>
        <View style={styles.mealSliderRow}>
          <Slider
            style={styles.mealSlider}
            progress={sliderProgress}
            minimumValue={sliderMin}
            maximumValue={sliderMax}
            steps={13}
            forceSnapToStep
            stepTimingOptions={false}
            onValueChange={handleMealsChange}
            onSlidingComplete={handleMealsComplete}
            sliderHeight={4}
            renderBubble={() => null}
            renderMark={() => null}
            markWidth={0}
            theme={{
              minimumTrackTintColor: '#1B7F3A',
              maximumTrackTintColor: '#D0D5DA',
            }}
            thumbWidth={32}
            renderThumb={() => (
              <View style={styles.mealThumb}>
                <Text style={styles.mealThumbText}>{mealsDraft}</Text>
              </View>
            )}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.label}>Max cook time (mins)</Text>
            <TextInput
              mode="outlined"
              style={styles.input}
              contentStyle={styles.inputContent}
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
              contentStyle={styles.inputContent}
              value={servingsInput}
              onChangeText={handleServingsChange}
              keyboardType="number-pad"
              placeholder={householdSize ? String(householdSize) : '2'}
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
                  textStyle={styles.chipText}
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
            contentStyle={styles.promptInputContent}
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
            disabled={isGeneratingPlan || !canUpdatePlan || !(plan?.recipes?.length ?? 0)}
            style={styles.primaryButton}
            labelStyle={styles.buttonLabel}>
            {plan ? 'Update plan' : 'Generate plan'}
          </Button>
          <Button
            mode="contained"
            onPress={() => handleGeneratePlan('full')}
            loading={isGeneratingPlan && generatingMode === 'full'}
            disabled={isGeneratingPlan}
            buttonColor="#1B7F3A"
            textColor="#FFFFFF"
            style={styles.secondaryButton}
            labelStyle={styles.buttonLabel}>
            New plan
          </Button>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
      </View>

      {plan && (
        <View style={styles.topDealsBar}>
          <Text style={styles.sectionTitle}>Top Savings This Week</Text>
          {topSavings.store ? (
            <Text style={styles.planStore}>
              Go-to store: <Text style={styles.planStoreStrong}>{getStoreDisplayName(topSavings.store)}</Text>
            </Text>
          ) : null}
          {topSavings.deals.length > 0 ? (
            topSavings.deals.map((deal, index) => {
              const priceAvailable = typeof deal.price === 'number' && Number.isFinite(deal.price);
              const priceText = priceAvailable
                ? `CAD ${deal.price!.toFixed(2)} / ${deal.unit}`
                : 'On Sale - See Deals';
              return (
                <Text key={`${deal.id}-${index}`} style={styles.planMeta}>
                  {renderTopDealTitle(deal.title)} • {priceText}
                </Text>
              );
            })
          ) : (
            <Text style={styles.planMeta}>No matching deals yet.</Text>
          )}
        </View>
      )}

      <View style={[styles.planBlock, styles.planBlockTight]}>
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
                onPress={handlePressRecipe}
                onRemove={handleRemoveRecipe}
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
          {orderedGroceryItems.length ? (
            orderedGroceryItems.map((item, index) => {
              const isLast = index === orderedGroceryItems.length - 1;
              const pantryChecked = pantryMatches(item.name);
              const dealStore = item.matchedDeal?.store;
              const dealStoreLabel = dealStore ? getStoreDisplayName(dealStore) : null;
              const dealPrice = typeof item.matchedDeal?.price === 'number' ? `$${item.matchedDeal!.price.toFixed(2)}` : null;
              const planStoreLabel = plan?.selectedStore ? getStoreDisplayName(plan.selectedStore) : null;
              const dealMeta =
                dealStoreLabel && dealPrice
                  ? ` • ${dealStoreLabel} ${dealPrice}`
                  : planStoreLabel
                    ? ` • ${planStoreLabel}`
                    : '';
              return (
                <Pressable
                  key={item.id}
                  style={[styles.groceryRow, isLast && styles.groceryRowLast]}
                  onPress={() => toggleChecked(item.id)}>
                  <View style={[styles.checkboxBox, item.checked && styles.checkboxBoxChecked]}>
                    {item.checked ? <Text style={styles.checkboxMark}>X</Text> : null}
                  </View>
                  <View style={styles.groceryText}>
                    <Text style={[styles.groceryName, item.checked && styles.groceryChecked]}>
                      {item.name}
                      {item.checked && pantryChecked ? ' (In Pantry)' : ''}
                    </Text>
                    <Text style={styles.groceryMeta}>
                      Buy: {item.totalQuantity}
                      {dealMeta}
                    </Text>
                  </View>
                </Pressable>
              );
            })
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
            refreshGroceryList(undoState.previousPlan);
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
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#B6DCC6',
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
    marginBottom: 2,
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 16,
    fontWeight: '600',
  },
  mealSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  mealSlider: {
    flex: 1,
    height: 36,
  },
  mealThumb: {
    width: 32,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1B7F3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealThumbText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
    fontSize: 11,
    color: '#5F6368',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 34,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  inputContent: {
    fontSize: 12,
  },
  promptInput: {
    height: 56,
    textAlignVertical: 'top',
    borderRadius: 14,
  },
  promptInputContent: {
    fontSize: 12,
    lineHeight: 16,
    paddingTop: 6,
    paddingBottom: 6,
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
  chipText: {
    fontSize: 11,
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
  buttonLabel: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
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
    marginTop: 12,
  },
  planBlockTight: {
    marginTop: 5,
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
  planCardWrap: {
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#7CCB93',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7CCB93',
    overflow: 'hidden',
  },
  planCardClip: {
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  planCardPressable: {
    borderRadius: 10,
    overflow: 'visible',
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
    height: 150,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  coverLogoOverlay: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignSelf: 'center',
    top: '50%',
    transform: [{ translateY: -40 }],
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
  },
  planCardContent: {
    padding: 12,
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
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  groceryRowLast: {
    borderBottomWidth: 0,
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
