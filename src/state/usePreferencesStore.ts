import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUserScopedStorage } from './storage';
import { useAuthStore } from './useAuthStore';

type PreferencesState = {
  postalCode: string;
  dietaryPreferences: string[];
  allergies: string;
  householdSize?: number;
  favoriteStores: string[];
  setPostalCode: (postalCode: string) => void;
  setDietaryPreferences: (preferences: string[]) => void;
  setAllergies: (allergies: string) => void;
  setHouseholdSize: (size?: number) => void;
  setFavoriteStores: (stores: string[]) => void;
  toggleFavoriteStore: (store: string) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      postalCode: '',
      dietaryPreferences: [],
      allergies: '',
      householdSize: undefined,
      favoriteStores: [],
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
    }),
    {
      name: 'dealchef-preferences',
      storage: createUserScopedStorage(() => useAuthStore.getState().userId),
    }
  )
);
