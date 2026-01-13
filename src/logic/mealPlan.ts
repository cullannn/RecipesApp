import type { DealItem, GroceryListItem, MealPlan, Recipe, RecipeIngredient } from '@/src/types';
import { normalizeName } from '@/src/utils/normalization';
import { matchDealToIngredient, scoreRecipe } from '@/src/utils/matching';

type PlanOptions = {
  mealsRequested: number;
  recipes: Recipe[];
  deals: DealItem[];
  pinnedRecipeIds?: string[];
  constraints?: MealPlan['constraints'];
  favoriteStores?: string[];
};

function buildPlanId(): string {
  return `plan-${Date.now()}`;
}

function applyConstraints(recipes: Recipe[], constraints?: MealPlan['constraints']): Recipe[] {
  if (!constraints) {
    return recipes;
  }
  const dietaryPrefs = (constraints.dietary ?? [])
    .map((pref) => normalizeName(pref))
    .filter((pref) => pref && pref !== 'none');
  return recipes.filter((recipe) => {
    if (dietaryPrefs.length > 0) {
      const tags = (recipe.tags ?? []).map((tag) => normalizeName(tag));
      const matchesAll = dietaryPrefs.every((pref) => tags.includes(pref));
      if (!matchesAll) {
        return false;
      }
    }
    if (constraints.maxCookTimeMins && recipe.cookTimeMins > constraints.maxCookTimeMins) {
      return false;
    }
    if (constraints.servings && recipe.servings < constraints.servings) {
      return false;
    }
    return true;
  });
}

type SelectionResult = {
  recipes: Recipe[];
  totalScore: number;
  matchedDealsCount: number;
};

function getRecipeMatchedDeals(recipe: Recipe, deals: DealItem[]): Set<string> {
  const matched = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    const deal = deals.find((candidate) => matchDealToIngredient(candidate, ingredient.name));
    if (deal) {
      matched.add(deal.id);
    }
  }
  return matched;
}

function selectRecipesForDeals(options: {
  mealsRequested: number;
  recipes: Recipe[];
  deals: DealItem[];
  pinnedRecipeIds: string[];
  dietaryPrefs?: string[];
  cuisineThemes?: string[];
  aiPrompt?: string;
}): SelectionResult {
  const { mealsRequested, recipes, deals, pinnedRecipeIds } = options;
  const normalizedDealIngredients = deals.map((deal) => normalizeName(deal.title)).filter(Boolean);
  const pinned = recipes.filter((recipe) => pinnedRecipeIds.includes(recipe.id));
  const remaining = recipes
    .filter((recipe) => !pinnedRecipeIds.includes(recipe.id))
    .sort((a, b) => {
      const scoreDiff =
        scoreRecipe(b, deals, {
          dietary: options.dietaryPrefs,
          cuisines: options.cuisineThemes,
          prompt: options.aiPrompt,
        }) -
        scoreRecipe(a, deals, {
          dietary: options.dietaryPrefs,
          cuisines: options.cuisineThemes,
          prompt: options.aiPrompt,
        });
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const titleDiff = a.title.localeCompare(b.title);
      if (titleDiff !== 0) {
        return titleDiff;
      }
      return a.id.localeCompare(b.id);
    });

  const selected: Recipe[] = [];
  const selectedIngredients = new Set<string>();
  const coveredDealIngredients = new Set<string>();

  const hasDealMatch = (recipe: Recipe) => getRecipeMatchedDeals(recipe, deals).size > 0;

  const addRecipe = (recipe: Recipe) => {
    selected.push(recipe);
    recipe.ingredients.forEach((ingredient) => {
      const normalized = normalizeName(ingredient.name);
      if (normalized) {
        selectedIngredients.add(normalized);
      }
      if (normalized && normalizedDealIngredients.includes(normalized)) {
        coveredDealIngredients.add(normalized);
      }
    });
  };

  for (const recipe of pinned) {
    if (selected.length >= mealsRequested) {
      break;
    }
    if (!selected.find((existing) => existing.id === recipe.id)) {
      addRecipe(recipe);
    }
  }

  const matchingCandidates = remaining.filter((recipe) => hasDealMatch(recipe));
  const primaryPool = matchingCandidates.length >= mealsRequested ? matchingCandidates : remaining;

  while (selected.length < mealsRequested && remaining.length > 0) {
    if (primaryPool.length === 0) {
      break;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < primaryPool.length; i += 1) {
      const recipe = primaryPool[i];
      const ingredientNames = recipe.ingredients
        .map((ingredient) => normalizeName(ingredient.name))
        .filter(Boolean);
      const overlapCount = ingredientNames.filter((name) => selectedIngredients.has(name)).length;
      const newIngredientCount = ingredientNames.filter((name) => !selectedIngredients.has(name)).length;
      const newDealCoverage = ingredientNames.filter(
        (name) => normalizedDealIngredients.includes(name) && !coveredDealIngredients.has(name)
      ).length;
      const baseScore = scoreRecipe(recipe, deals, {
        dietary: options.dietaryPrefs,
        cuisines: options.cuisineThemes,
        prompt: options.aiPrompt,
      });
      const reuseScore = overlapCount * 2 + newDealCoverage * 3 - newIngredientCount;
      const candidateScore = baseScore + reuseScore;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = i;
      }
    }
    const [chosen] = primaryPool.splice(bestIndex, 1);
    const remainingIndex = remaining.findIndex((recipe) => recipe.id === chosen.id);
    if (remainingIndex !== -1) {
      remaining.splice(remainingIndex, 1);
    }
    addRecipe(chosen);
  }

  const totalScore = selected.reduce(
    (sum, recipe) =>
      sum +
      scoreRecipe(recipe, deals, {
        dietary: options.dietaryPrefs,
        cuisines: options.cuisineThemes,
        prompt: options.aiPrompt,
      }),
    0
  );
  const matchedDealsCount = selected.reduce((count, recipe) => {
    return count + getRecipeMatchedDeals(recipe, deals).size;
  }, 0);
  return { recipes: selected, totalScore, matchedDealsCount };
}

function pickBestStore(deals: DealItem[], recipes: Recipe[], options: {
  mealsRequested: number;
  pinnedRecipeIds: string[];
  dietaryPrefs?: string[];
  cuisineThemes?: string[];
  aiPrompt?: string;
  favoriteStores?: string[];
}): { store?: string; selection: SelectionResult } {
  if (deals.length === 0) {
    return {
      store: options.favoriteStores?.[0],
      selection: selectRecipesForDeals({
        mealsRequested: options.mealsRequested,
        recipes,
        deals,
        pinnedRecipeIds: options.pinnedRecipeIds,
        dietaryPrefs: options.dietaryPrefs,
        cuisineThemes: options.cuisineThemes,
        aiPrompt: options.aiPrompt,
      }),
    };
  }
  const dealsByStore = new Map<string, DealItem[]>();
  for (const deal of deals) {
    const list = dealsByStore.get(deal.store) ?? [];
    list.push(deal);
    dealsByStore.set(deal.store, list);
  }

  let bestStore: string | undefined;
  let bestSelection: SelectionResult | undefined;
  const favoriteOrder = new Map(
    (options.favoriteStores ?? []).map((store, index) => [normalizeName(store), index])
  );
  const storeMatchInfo: Array<{
    store: string;
    matchedDealsCount: number;
    totalDeals: number;
  }> = [];
  for (const [store, storeDeals] of dealsByStore.entries()) {
    const selection = selectRecipesForDeals({
      mealsRequested: options.mealsRequested,
      recipes,
      deals: storeDeals,
      pinnedRecipeIds: options.pinnedRecipeIds,
      dietaryPrefs: options.dietaryPrefs,
      cuisineThemes: options.cuisineThemes,
      aiPrompt: options.aiPrompt,
    });
    storeMatchInfo.push({
      store,
      matchedDealsCount: selection.matchedDealsCount,
      totalDeals: storeDeals.length,
    });
    const storeRank = favoriteOrder.get(normalizeName(store));
    const bestRank = bestStore ? favoriteOrder.get(normalizeName(bestStore)) : undefined;
    if (
      !bestSelection ||
      selection.matchedDealsCount > bestSelection.matchedDealsCount ||
      (selection.matchedDealsCount === bestSelection.matchedDealsCount &&
        selection.totalScore > bestSelection.totalScore) ||
      (selection.matchedDealsCount === bestSelection.matchedDealsCount &&
        selection.totalScore === bestSelection.totalScore &&
        ((storeRank !== undefined && bestRank !== undefined && storeRank < bestRank) ||
          (storeRank !== undefined && bestRank === undefined) ||
          (storeRank === undefined && bestRank === undefined && store.localeCompare(bestStore ?? '') < 0)))
    ) {
      bestSelection = selection;
      bestStore = store;
    }
  }

  if (__DEV__ && storeMatchInfo.length > 0) {
    console.info('[meal-plan] store match info', storeMatchInfo);
    console.info('[meal-plan] selected store', {
      store: bestStore,
      matchedDeals: bestSelection?.matchedDealsCount ?? 0,
    });
  }

  return {
    store: bestSelection && bestSelection.matchedDealsCount > 0 ? bestStore : undefined,
    selection: bestSelection ?? { recipes: [], totalScore: 0, matchedDealsCount: 0 },
  };
}

export function generateMealPlan(options: PlanOptions): MealPlan {
  const { mealsRequested, deals, pinnedRecipeIds = [], constraints } = options;
  const filteredRecipes = applyConstraints(options.recipes, constraints);
  const dietaryPrefs = constraints?.dietary;
  const cuisineThemes = constraints?.cuisineThemes;
  const aiPrompt = constraints?.aiPrompt;

  const { store, selection } = pickBestStore(deals, filteredRecipes, {
    mealsRequested,
    pinnedRecipeIds,
    dietaryPrefs,
    cuisineThemes,
    aiPrompt,
    favoriteStores: options.favoriteStores,
  });

  return {
    id: buildPlanId(),
    mealsRequested,
    recipes: selection.recipes,
    createdAt: new Date().toISOString(),
    selectedStore: store,
    constraints,
  };
}

type QuantityAccumulator = {
  unit: string;
  numericTotal: number;
  hasNumeric: boolean;
  parts: string[];
};

function accumulateQuantity(acc: QuantityAccumulator, ingredient: RecipeIngredient): QuantityAccumulator {
  const numeric = typeof ingredient.quantity === 'number' ? ingredient.quantity : null;
  if (numeric !== null && ingredient.unit === acc.unit) {
    acc.numericTotal += numeric;
    acc.hasNumeric = true;
  } else {
    acc.parts.push(`${ingredient.quantity} ${ingredient.unit}`.trim());
  }
  return acc;
}

function buildQuantityString(acc: QuantityAccumulator): string {
  const parts = [...acc.parts];
  if (acc.hasNumeric) {
    parts.unshift(`${acc.numericTotal} ${acc.unit}`.trim());
  }
  return parts.join(' + ');
}

export function buildGroceryList(plan: MealPlan, deals: DealItem[]): GroceryListItem[] {
  const itemMap = new Map<string, { item: GroceryListItem; acc: QuantityAccumulator }>();

  for (const recipe of plan.recipes) {
    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeName(ingredient.name);
      const unit = ingredient.unit || '';
      const key = `${normalizedName}|${unit}`;
      const matchedDeal = deals.find((deal) => matchDealToIngredient(deal, ingredient.name));

      if (!itemMap.has(key)) {
        const acc: QuantityAccumulator = {
          unit,
          numericTotal: 0,
          hasNumeric: false,
          parts: [],
        };
        const listItem: GroceryListItem = {
          id: key,
          name: ingredient.name,
          totalQuantity: '',
          category: ingredient.category,
          checked: false,
          matchedDeal: matchedDeal
            ? { store: matchedDeal.store, price: matchedDeal.price, dealId: matchedDeal.id }
            : undefined,
        };
        itemMap.set(key, { item: listItem, acc });
      }

      const entry = itemMap.get(key);
      if (entry) {
        accumulateQuantity(entry.acc, ingredient);
        entry.item.totalQuantity = buildQuantityString(entry.acc);
      }
    }
  }

  return Array.from(itemMap.values()).map((entry) => entry.item);
}
