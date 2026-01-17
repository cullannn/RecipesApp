import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
export const appStorage = createJSONStorage(() => AsyncStorage);

export function createUserScopedStorage(getUserId: () => string) {
  return createJSONStorage(() => ({
    getItem: (name) => AsyncStorage.getItem(`${name}:${getUserId() || 'guest'}`),
    setItem: (name, value) => AsyncStorage.setItem(`${name}:${getUserId() || 'guest'}`, value),
    removeItem: (name) => AsyncStorage.removeItem(`${name}:${getUserId() || 'guest'}`),
  }));
}
