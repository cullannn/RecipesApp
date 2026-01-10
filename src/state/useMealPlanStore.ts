import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MealPlan } from '@/src/types';
import { appStorage } from './storage';

type MealPlanState = {
  mealsRequested: number;
  maxCookTimeMins?: number;
  servings?: number;
  pinnedRecipeIds: string[];
  plan?: MealPlan;
  setMealsRequested: (count: number) => void;
  setMaxCookTimeMins: (mins?: number) => void;
  setServings: (servings?: number) => void;
  togglePinnedRecipe: (recipeId: string) => void;
  setPlan: (plan: MealPlan) => void;
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      mealsRequested: 3,
      maxCookTimeMins: undefined,
      servings: undefined,
      pinnedRecipeIds: [],
      plan: undefined,
      setMealsRequested: (mealsRequested) => set({ mealsRequested }),
      setMaxCookTimeMins: (maxCookTimeMins) => set({ maxCookTimeMins }),
      setServings: (servings) => set({ servings }),
      togglePinnedRecipe: (recipeId) => {
        const current = get().pinnedRecipeIds;
        const exists = current.includes(recipeId);
        set({
          pinnedRecipeIds: exists ? current.filter((id) => id !== recipeId) : [...current, recipeId],
        });
      },
      setPlan: (plan) => set({ plan }),
    }),
    { name: 'dealchef-meal-plan', storage: appStorage }
  )
);
