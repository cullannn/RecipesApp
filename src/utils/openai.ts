import type { Recipe, RecipeIngredient } from '@/src/types';
import { useAuthStore } from '@/src/state/useAuthStore';

type OpenAiRecipePayload = {
  title: string;
  servings: number;
  cookTimeMins: number;
  tags?: string[];
  imageUrl?: string | null;
  ingredients: {
    name: string;
    quantity: number | string;
    unit: string;
    category?: string;
  }[];
  steps: string[];
};

const AI_BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'http://localhost:8787';
const REQUEST_TIMEOUT_MS = 120000;

function toSafeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeIngredient(input: OpenAiRecipePayload['ingredients'][number]): RecipeIngredient {
  return {
    name: String(input.name ?? '').trim(),
    quantity:
      typeof input.quantity === 'number' || typeof input.quantity === 'string'
        ? input.quantity
        : '',
    unit: String(input.unit ?? '').trim(),
    category: String(input.category ?? 'Other'),
  };
}

function normalizeStep(step: unknown): string {
  if (step === null || step === undefined) {
    return '';
  }
  if (typeof step === 'string' || typeof step === 'number') {
    return String(step).trim();
  }
  if (typeof step === 'object') {
    const candidate =
      (step as { text?: unknown }).text ??
      (step as { step?: unknown }).step ??
      (step as { instruction?: unknown }).instruction ??
      (step as { description?: unknown }).description ??
      (step as { details?: unknown }).details ??
      (step as { content?: unknown }).content ??
      (step as { value?: unknown }).value;
    if (candidate !== undefined && candidate !== null) {
      return String(candidate).trim();
    }
  }
  return '';
}

function normalizeSteps(steps: unknown): string[] {
  if (Array.isArray(steps)) {
    return steps.map((step) => normalizeStep(step)).filter(Boolean);
  }
  if (typeof steps === 'string') {
    return steps
      .split(/\r?\n|(?:^|\s)\d+\.\s+/g)
      .map((step) => step.trim())
      .filter(Boolean);
  }
  if (steps && typeof steps === 'object') {
    const candidate = steps as { items?: unknown; steps?: unknown };
    if (Array.isArray(candidate.items)) {
      return candidate.items.map((step) => normalizeStep(step)).filter(Boolean);
    }
    if (Array.isArray(candidate.steps)) {
      return candidate.steps.map((step) => normalizeStep(step)).filter(Boolean);
    }
  }
  return [];
}

function buildRecipeId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `ai-${slug || 'recipe'}-${index + 1}`;
}

function coerceRecipes(payload: unknown): Recipe[] {
  const items = Array.isArray(payload) ? payload : (payload as { recipes?: unknown[] })?.recipes;
  if (!Array.isArray(items)) {
    return [];
  }
  const recipes: Recipe[] = [];
  items.forEach((item, index) => {
    const data = item as OpenAiRecipePayload;
    const title = String(data.title ?? '').trim();
    if (!title) {
      return;
    }
    recipes.push({
      id: buildRecipeId(title, index),
      title,
      imageUrl: data.imageUrl ?? undefined,
      servings: toSafeNumber(data.servings, 2),
      cookTimeMins: toSafeNumber(data.cookTimeMins, 30),
      tags: Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : [],
      ingredients: Array.isArray(data.ingredients)
        ? data.ingredients.map((ingredient) => normalizeIngredient(ingredient))
        : [],
      steps: normalizeSteps(data.steps),
    });
  });
  return recipes;
}

export async function generateRecipesFromPrompt(input: {
  prompt: string;
  cuisines: string[];
  count?: number;
  servings?: number;
  maxCookTimeMins?: number;
  dietaryPreferences?: string[];
  allergies?: string;
}): Promise<{ recipes: Recipe[]; cuisineFallback: boolean }> {
  const userId = useAuthStore.getState().userId;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${AI_BASE_URL}/api/ai/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: input.prompt,
        cuisines: input.cuisines,
        count: input.count,
        servings: input.servings,
        maxCookTimeMins: input.maxCookTimeMins,
        dietaryPreferences: input.dietaryPreferences,
        allergies: input.allergies,
        ...(userId ? { userId } : {}),
      }),
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError'
    ) {
      throw new Error('AI request timed out. Check the proxy server and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return {
    recipes: coerceRecipes(data),
    cuisineFallback: Boolean(data?.cuisineFallback),
  };
}
