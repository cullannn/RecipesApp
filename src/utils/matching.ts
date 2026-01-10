import type { DealItem, Recipe } from '@/src/types';
import { normalizeName } from './normalization';

export function matchDealToIngredient(deal: DealItem, ingredientName: string): boolean {
  const dealName = normalizeName(deal.title);
  const ingredient = normalizeName(ingredientName);
  if (!dealName || !ingredient) {
    return false;
  }
  return dealName.includes(ingredient) || ingredient.includes(dealName);
}

export function getRecipeDealMatches(recipe: Recipe, deals: DealItem[]): DealItem[] {
  const matches: DealItem[] = [];
  for (const ingredient of recipe.ingredients) {
    const match = deals.find((deal) => matchDealToIngredient(deal, ingredient.name));
    if (match) {
      matches.push(match);
    }
  }
  return matches;
}

export function scoreRecipe(recipe: Recipe, deals: DealItem[]): number {
  const matches = getRecipeDealMatches(recipe, deals);
  const matchCount = new Set(matches.map((deal) => deal.id)).size;
  const nonDealCount = recipe.ingredients.length - matches.length;
  return matchCount * 10 - nonDealCount;
}
