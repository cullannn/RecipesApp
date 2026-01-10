import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

type PreferencesState = {
  postalCode: string;
  dietaryPreferences: string[];
  allergies: string;
  householdSize?: number;
  setPostalCode: (postalCode: string) => void;
  setDietaryPreferences: (preferences: string[]) => void;
  setAllergies: (allergies: string) => void;
  setHouseholdSize: (size?: number) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      postalCode: '',
      dietaryPreferences: [],
      allergies: '',
      householdSize: undefined,
      setPostalCode: (postalCode) => set({ postalCode }),
      setDietaryPreferences: (dietaryPreferences) => set({ dietaryPreferences }),
      setAllergies: (allergies) => set({ allergies }),
      setHouseholdSize: (householdSize) => set({ householdSize }),
    }),
    { name: 'dealchef-preferences', storage: appStorage }
  )
);
