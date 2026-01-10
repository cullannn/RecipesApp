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
  return recipes.filter((recipe) => {
    if (constraints.maxCookTimeMins && recipe.cookTimeMins > constraints.maxCookTimeMins) {
      return false;
    }
    if (constraints.servings && recipe.servings < constraints.servings) {
      return false;
    }
    return true;
  });
}

export function generateMealPlan(options: PlanOptions): MealPlan {
  const { mealsRequested, deals, pinnedRecipeIds = [], constraints } = options;
  const filteredRecipes = applyConstraints(options.recipes, constraints);

  const pinned = filteredRecipes.filter((recipe) => pinnedRecipeIds.includes(recipe.id));
  const remaining = filteredRecipes
    .filter((recipe) => !pinnedRecipeIds.includes(recipe.id))
    .sort((a, b) => {
      const scoreDiff = scoreRecipe(b, deals) - scoreRecipe(a, deals);
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
  for (const recipe of pinned) {
    if (selected.length >= mealsRequested) {
      break;
    }
    if (!selected.find((existing) => existing.id === recipe.id)) {
      selected.push(recipe);
    }
  }
  for (const recipe of remaining) {
    if (selected.length >= mealsRequested) {
      break;
    }
    selected.push(recipe);
  }

  return {
    id: buildPlanId(),
    mealsRequested,
    recipes: selected,
    createdAt: new Date().toISOString(),
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
