import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';

export const appStorage = createJSONStorage(() => AsyncStorage);

function getUserStorageKey() {
  const userId = useAuthStore.getState().userId;
  return userId || 'guest';
}

export function createUserScopedStorage() {
  return createJSONStorage(() => ({
    getItem: (name) => AsyncStorage.getItem(`${name}:${getUserStorageKey()}`),
    setItem: (name, value) => AsyncStorage.setItem(`${name}:${getUserStorageKey()}`, value),
    removeItem: (name) => AsyncStorage.removeItem(`${name}:${getUserStorageKey()}`),
  }));
}
