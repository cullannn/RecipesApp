import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

type DealsState = {
  savedDealIds: string[];
  toggleSavedDeal: (dealId: string) => void;
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
    }),
    { name: 'dealchef-saved-deals', storage: appStorage }
  )
);
