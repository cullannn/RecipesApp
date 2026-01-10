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

function scorePreferenceMatch(recipe: Recipe, preferences?: string[]): number {
  if (!preferences || preferences.length === 0) {
    return 0;
  }
  const normalizedPrefs = preferences
    .map((pref) => normalizeName(pref))
    .filter((pref) => pref && pref !== 'none');
  if (normalizedPrefs.length === 0) {
    return 0;
  }
  const tags = (recipe.tags ?? []).map((tag) => normalizeName(tag));
  if (tags.length === 0) {
    return -normalizedPrefs.length * 2;
  }
  let score = 0;
  for (const pref of normalizedPrefs) {
    score += tags.includes(pref) ? 5 : -2;
  }
  return score;
}

function scoreDealSavings(matches: DealItem[]): number {
  return matches.reduce((total, deal) => total + Math.min(10, deal.price), 0);
}

export function scoreRecipe(recipe: Recipe, deals: DealItem[], preferences?: string[]): number {
  const matches = getRecipeDealMatches(recipe, deals);
  const matchCount = new Set(matches.map((deal) => deal.id)).size;
  const nonDealCount = recipe.ingredients.length - matches.length;
  const savingsScore = scoreDealSavings(matches);
  const preferenceScore = scorePreferenceMatch(recipe, preferences);
  return matchCount * 10 + savingsScore + preferenceScore - nonDealCount;
}
