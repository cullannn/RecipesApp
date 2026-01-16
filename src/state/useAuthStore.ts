import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

type AuthProfile = {
  userId: string;
  name: string;
  email: string;
  photoUrl: string;
};

type AuthState = AuthProfile & {
  setUser: (profile: AuthProfile) => void;
  clearUser: () => void;
};

const emptyProfile: AuthProfile = {
  userId: '',
  name: '',
  email: '',
  photoUrl: '',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...emptyProfile,
      setUser: (profile) => set({ ...profile }),
      clearUser: () => set({ ...emptyProfile }),
    }),
    { name: 'dealchef-auth', storage: appStorage }
  )
);
