import type { DealItem, Recipe } from '@/src/types';
import { normalizeName, normalizeTokens } from './normalization';

const STOP_TOKENS = new Set([
  'fresh',
  'frozen',
  'lean',
  'extra',
  'large',
  'small',
  'medium',
  'boneless',
  'bone',
  'in',
  'skinless',
  'pack',
  'bag',
  'block',
  'each',
  'assorted',
  'mixed',
  'chopped',
  'sliced',
  'diced',
  'minced',
  'ground',
]);

function filterTokens(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 2 && !STOP_TOKENS.has(token));
}

export function matchDealToIngredient(deal: DealItem, ingredientName: string): boolean {
  const dealName = normalizeName(deal.title);
  const ingredient = normalizeName(ingredientName);
  if (!dealName || !ingredient) {
    return false;
  }
  if (dealName.includes(ingredient) || ingredient.includes(dealName)) {
    return true;
  }
  const dealTokens = filterTokens(normalizeTokens(deal.title));
  const ingredientTokens = filterTokens(normalizeTokens(ingredientName));
  if (dealTokens.length === 0 || ingredientTokens.length === 0) {
    return false;
  }
  const dealSet = new Set(dealTokens);
  const shared = ingredientTokens.filter((token) => dealSet.has(token));
  return shared.length >= 1;
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

type ScoreOptions = {
  dietary?: string[];
  cuisines?: string[];
  prompt?: string;
};

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

function scoreCuisineBoost(recipe: Recipe, cuisines?: string[]): number {
  if (!cuisines || cuisines.length === 0) {
    return 0;
  }
  const normalized = cuisines.map((cuisine) => normalizeName(cuisine)).filter(Boolean);
  if (normalized.length === 0) {
    return 0;
  }
  const tags = (recipe.tags ?? []).map((tag) => normalizeName(tag));
  const title = normalizeName(recipe.title);
  let score = 0;
  for (const cuisine of normalized) {
    if (tags.includes(cuisine) || title.includes(cuisine)) {
      score += 4;
    }
  }
  return score;
}

function scorePromptBoost(recipe: Recipe, prompt?: string): number {
  if (!prompt) {
    return 0;
  }
  const tokens = normalizeName(prompt)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
  if (tokens.length === 0) {
    return 0;
  }
  const haystack = `${normalizeName(recipe.title)} ${(recipe.tags ?? [])
    .map((tag) => normalizeName(tag))
    .join(' ')}`;
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1.5;
    }
  }
  return score;
}

export function scoreRecipe(recipe: Recipe, deals: DealItem[], options?: ScoreOptions): number {
  const matches = getRecipeDealMatches(recipe, deals);
  const matchCount = new Set(matches.map((deal) => deal.id)).size;
  const nonDealCount = recipe.ingredients.length - matches.length;
  const savingsScore = scoreDealSavings(matches);
  const preferenceScore = scorePreferenceMatch(recipe, options?.dietary);
  const cuisineScore = scoreCuisineBoost(recipe, options?.cuisines);
  const promptScore = scorePromptBoost(recipe, options?.prompt);
  return matchCount * 10 + savingsScore + preferenceScore + cuisineScore + promptScore - nonDealCount;
}
