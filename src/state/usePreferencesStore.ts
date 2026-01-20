import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUserScopedStorage } from './storage';
import { useAuthStore } from './useAuthStore';

type PantryCategory =
  | 'Baking Supplies'
  | 'Canned Goods'
  | 'Grains & Pasta'
  | 'Condiments & Sauces'
  | 'Oils & Vinegars'
  | 'Herbs & Spices'
  | 'Others';

type PantryItem = {
  name: string;
  category: PantryCategory;
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

type PreferencesState = {
  postalCode: string;
  dietaryPreferences: string[];
  allergies: string;
  householdSize?: number;
  favoriteStores: string[];
  pantryItems: PantryItem[];
  onboardingComplete: boolean;
  setPostalCode: (postalCode: string) => void;
  setDietaryPreferences: (preferences: string[]) => void;
  setAllergies: (allergies: string) => void;
  setHouseholdSize: (size?: number) => void;
  setFavoriteStores: (stores: string[]) => void;
  toggleFavoriteStore: (store: string) => void;
  addPantryItem: (item: string, category: PantryCategory) => void;
  removePantryItem: (item: PantryItem) => void;
  setOnboardingComplete: (complete: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      postalCode: '',
      dietaryPreferences: [],
      allergies: '',
      householdSize: undefined,
      favoriteStores: [],
      pantryItems: [],
      onboardingComplete: false,
      setPostalCode: (postalCode) => set({ postalCode }),
      setDietaryPreferences: (dietaryPreferences) => set({ dietaryPreferences }),
      setAllergies: (allergies) => set({ allergies }),
      setHouseholdSize: (householdSize) => set({ householdSize }),
      setFavoriteStores: (favoriteStores) => set({ favoriteStores }),
      toggleFavoriteStore: (store) =>
        set((state) => {
          const normalized = store.trim();
          if (!normalized) {
            return state;
          }
          const exists = state.favoriteStores.includes(normalized);
          return {
            favoriteStores: exists
              ? state.favoriteStores.filter((item) => item !== normalized)
              : [...state.favoriteStores, normalized],
          };
        }),
      addPantryItem: (item, category) =>
        set((state) => {
          const normalized = toTitleCase(item.trim());
          if (!normalized) {
            return state;
          }
          const exists = state.pantryItems.some(
            (existing) =>
              existing.name.toLowerCase() === normalized.toLowerCase() &&
              existing.category === category
          );
          if (exists) {
            return state;
          }
          return { pantryItems: [...state.pantryItems, { name: normalized, category }] };
        }),
      removePantryItem: (item) =>
        set((state) => ({
          pantryItems: state.pantryItems.filter(
            (existing) =>
              !(
                existing.name.toLowerCase() === item.name.toLowerCase() &&
                existing.category === item.category
              )
          ),
        })),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
    }),
    {
      name: 'dealchef-preferences',
      storage: createUserScopedStorage(() => useAuthStore.getState().userId),
      version: 1,
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return state;
        }
        const anyState = state as PreferencesState & {
          pantryItems?: Array<string | PantryItem>;
          onboardingComplete?: boolean;
        };
        const rawItems = anyState.pantryItems ?? [];
        const migratedItems = rawItems.map((item) => {
          if (typeof item === 'string') {
            return { name: item, category: 'Others' as PantryCategory };
          }
          return item;
        });
        const inferredComplete =
          typeof anyState.onboardingComplete === 'boolean'
            ? anyState.onboardingComplete
            : Boolean(
                anyState.postalCode ||
                  (anyState.favoriteStores && anyState.favoriteStores.length > 0) ||
                  (anyState.dietaryPreferences && anyState.dietaryPreferences.length > 0) ||
                  anyState.allergies ||
                  anyState.householdSize ||
                  migratedItems.length > 0
              );
        return { ...anyState, pantryItems: migratedItems, onboardingComplete: inferredComplete };
      },
    }
  )
);
