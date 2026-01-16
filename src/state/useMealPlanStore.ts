import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MealPlan, Recipe, RecipeHistoryEntry } from '@/src/types';
import { createUserScopedStorage } from './storage';

type MealPlanState = {
  mealsRequested: number;
  maxCookTimeMins?: number;
  servings?: number;
  cuisineThemes: string[];
  aiPrompt: string;
  aiRecipes: Recipe[];
  recipeHistory: RecipeHistoryEntry[];
  pinnedRecipeIds: string[];
  plan?: MealPlan;
  setMealsRequested: (count: number) => void;
  setMaxCookTimeMins: (mins?: number) => void;
  setServings: (servings?: number) => void;
  setCuisineThemes: (themes: string[]) => void;
  setAiPrompt: (prompt: string) => void;
  setAiRecipes: (recipes: Recipe[]) => void;
  addHistoryEntry: (entry: RecipeHistoryEntry) => void;
  removeHistoryRecipe: (recipeId: string, dateKey: string) => void;
  restoreHistoryRecipe: (recipe: Recipe, dateKey: string) => void;
  togglePinnedRecipe: (recipeId: string) => void;
  setPlan: (plan: MealPlan) => void;
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      mealsRequested: 3,
      maxCookTimeMins: undefined,
      servings: undefined,
      cuisineThemes: [],
      aiPrompt: '',
      aiRecipes: [],
      recipeHistory: [],
      pinnedRecipeIds: [],
      plan: undefined,
      setMealsRequested: (mealsRequested) => set({ mealsRequested }),
      setMaxCookTimeMins: (maxCookTimeMins) => set({ maxCookTimeMins }),
      setServings: (servings) => set({ servings }),
      setCuisineThemes: (cuisineThemes) => set({ cuisineThemes }),
      setAiPrompt: (aiPrompt) => set({ aiPrompt }),
      setAiRecipes: (aiRecipes) => set({ aiRecipes }),
      addHistoryEntry: (entry) =>
        set((state) => ({ recipeHistory: [entry, ...state.recipeHistory] })),
      removeHistoryRecipe: (recipeId, dateKey) =>
        set((state) => ({
          recipeHistory: state.recipeHistory
            .map((entry) => {
              const entryDateKey = new Date(entry.createdAt).toISOString().slice(0, 10);
              if (entryDateKey !== dateKey) {
                return entry;
              }
              const nextRecipes = entry.recipes.filter((recipe) => recipe.id !== recipeId);
              return { ...entry, recipes: nextRecipes };
            })
            .filter((entry) => entry.recipes.length > 0),
        })),
      restoreHistoryRecipe: (recipe, dateKey) =>
        set((state) => {
          const next = [...state.recipeHistory];
          const entryIndex = next.findIndex(
            (entry) => new Date(entry.createdAt).toISOString().slice(0, 10) === dateKey
          );
          if (entryIndex === -1) {
            return {
              recipeHistory: [
                { id: `history-${dateKey}`, createdAt: `${dateKey}T00:00:00.000Z`, recipes: [recipe] },
                ...next,
              ],
            };
          }
          const entry = next[entryIndex];
          const exists = entry.recipes.some((item) => item.id === recipe.id);
          if (exists) {
            return { recipeHistory: next };
          }
          next[entryIndex] = { ...entry, recipes: [recipe, ...entry.recipes] };
          return { recipeHistory: next };
        }),
      togglePinnedRecipe: (recipeId) => {
        const current = get().pinnedRecipeIds;
        const exists = current.includes(recipeId);
        set({
          pinnedRecipeIds: exists ? current.filter((id) => id !== recipeId) : [...current, recipeId],
        });
      },
      setPlan: (plan) => set({ plan }),
    }),
    { name: 'dealchef-meal-plan-v2', storage: createUserScopedStorage() }
  )
);
