import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createUserScopedStorage } from './storage';
import { useAuthStore } from './useAuthStore';

type DealsState = {
  savedDealIds: string[];
  toggleSavedDeal: (dealId: string) => void;
  pruneSavedDeals: (validIds: string[]) => void;
};

export const useDealsStore = create<DealsState>()(
  persist(
    (set, get) => ({
      savedDealIds: [],
      toggleSavedDeal: (dealId) => {
        const current = get().savedDealIds;
        const exists = current.includes(dealId);
        set({
          savedDealIds: exists ? current.filter((id) => id !== dealId) : [...current, dealId],
        });
      },
      pruneSavedDeals: (validIds) => {
        const validSet = new Set(validIds);
        const current = get().savedDealIds;
        const next = current.filter((id) => validSet.has(id));
        if (next.length !== current.length) {
          set({ savedDealIds: next });
        }
      },
    }),
    {
      name: 'dealchef-saved-deals',
      storage: createUserScopedStorage(() => useAuthStore.getState().userId),
    }
  )
);
