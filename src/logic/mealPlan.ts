import type { DealItem, GroceryListItem, MealPlan, Recipe, RecipeIngredient } from '@/src/types';
import { normalizeName } from '@/src/utils/normalization';
import { matchDealToIngredient, scoreRecipe } from '@/src/utils/matching';

type PlanOptions = {
  mealsRequested: number;
  recipes: Recipe[];
  deals: DealItem[];
  pinnedRecipeIds?: string[];
  constraints?: MealPlan['constraints'];
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
};

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

  while (selected.length < mealsRequested && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const recipe = remaining[i];
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
    const [chosen] = remaining.splice(bestIndex, 1);
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
  return { recipes: selected, totalScore };
}

function pickBestStore(deals: DealItem[], recipes: Recipe[], options: {
  mealsRequested: number;
  pinnedRecipeIds: string[];
  dietaryPrefs?: string[];
  cuisineThemes?: string[];
  aiPrompt?: string;
}): { store?: string; selection: SelectionResult } {
  if (deals.length === 0) {
    return {
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
    if (
      !bestSelection ||
      selection.totalScore > bestSelection.totalScore ||
      (selection.totalScore === bestSelection.totalScore && store.localeCompare(bestStore ?? '') < 0)
    ) {
      bestSelection = selection;
      bestStore = store;
    }
  }

  return {
    store: bestStore,
    selection: bestSelection ?? { recipes: [], totalScore: 0 },
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
