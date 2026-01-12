import { useMemo } from 'react';
import type { Recipe } from '@/src/types';
import recipes from '@/src/fixtures/recipes/recipes.json';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';

export function useRecipes(): Recipe[] {
  const aiRecipes = useMealPlanStore((state) => state.aiRecipes);
  return useMemo(() => [...aiRecipes, ...recipes], [aiRecipes]);
}
