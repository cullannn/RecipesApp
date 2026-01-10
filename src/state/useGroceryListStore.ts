import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GroceryListItem } from '@/src/types';
import { appStorage } from './storage';

type GroceryListState = {
  items: GroceryListItem[];
  setItems: (items: GroceryListItem[]) => void;
  toggleChecked: (itemId: string) => void;
  clearChecked: () => void;
};

export const useGroceryListStore = create<GroceryListState>()(
  persist(
    (set, get) => ({
      items: [],
      setItems: (items) => set({ items }),
      toggleChecked: (itemId) => {
        const items = get().items.map((item) =>
          item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        set({ items });
      },
      clearChecked: () => {
        const items = get().items.map((item) => ({ ...item, checked: false }));
        set({ items });
      },
    }),
    { name: 'dealchef-grocery-list', storage: appStorage }
  )
);
