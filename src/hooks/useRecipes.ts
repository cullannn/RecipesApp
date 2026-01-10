import { useMemo } from 'react';
import type { Recipe } from '@/src/types';
import recipes from '@/src/fixtures/recipes/recipes.json';

export function useRecipes(): Recipe[] {
  return useMemo(() => recipes, []);
}
