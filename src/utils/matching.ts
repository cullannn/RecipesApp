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
  'organic',
  'baby',
  'english',
  'green',
  'red',
  'white',
  'yellow',
  'golden',
  'whole',
  'seedless',
  'sweet',
  'value',
  'jumbo',
  'mini',
  'premium',
  'select',
  'choice',
  'shoulder',
  'loin',
  'rib',
  'ribs',
  'chop',
  'chops',
  'breast',
  'thigh',
  'thighs',
  'leg',
  'steak',
  'roast',
  'tenderloin',
  'sirloin',
  'flank',
  'round',
  'brisket',
  'chuck',
]);

const BLOCKLIST_TOKENS = new Set([
  'maker',
  'appliance',
  'blender',
  'mixer',
  'kettle',
  'toaster',
  'microwave',
  'oven',
  'airfryer',
  'fryer',
  'cookware',
  'kitchenware',
  'utensil',
  'cutlery',
  'knife',
  'skillet',
  'wok',
]);

function filterTokens(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 2 && !STOP_TOKENS.has(token));
}

export function matchDealToIngredient(deal: DealItem, ingredientName: string): boolean {
  const dealTokensRaw = normalizeTokens(deal.title);
  const ingredientTokensRaw = normalizeTokens(ingredientName);
  if (dealTokensRaw.length === 0 || ingredientTokensRaw.length === 0) {
    return false;
  }
  if (dealTokensRaw.some((token) => BLOCKLIST_TOKENS.has(token))) {
    return false;
  }
  const dealTokens = filterTokens(dealTokensRaw);
  const ingredientTokens = filterTokens(ingredientTokensRaw);
  if (dealTokens.length === 0 || ingredientTokens.length === 0) {
    return false;
  }
  const dealSet = new Set(dealTokens);
  if (ingredientTokens.length === 1) {
    const target = ingredientTokens[0];
    if (!dealSet.has(target)) {
      return false;
    }
    return dealTokens.length === 1;
  }
  const shared = ingredientTokens.filter((token) => dealSet.has(token));
  return shared.length >= ingredientTokens.length;
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
