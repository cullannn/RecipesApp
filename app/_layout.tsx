import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/state/useAuthStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { useGroceryListStore } from '@/src/state/useGroceryListStore';
import { useDealsStore } from '@/src/state/useDealsStore';

const queryClient = new QueryClient();
const materialTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1A73E8',
    secondary: '#D2E3FC',
    surface: '#FFFFFF',
    background: '#F7F8FA',
    outline: '#E0E0E0',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate() {
  const userId = useAuthStore((state) => state.userId);
  const segments = useSegments();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist?.hasHydrated?.() ?? true
  );

  useEffect(() => {
    const onFinish = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true));
    if (!hydrated) {
      setHydrated(useAuthStore.persist?.hasHydrated?.() ?? true);
    }
    return onFinish;
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || segments.length === 0) {
      return;
    }
    const isLogin = segments[0] === 'login';
    if (!userId && !isLogin) {
      router.replace('/login');
      return;
    }
    if (userId && isLogin) {
      router.replace('/(tabs)/deals');
    }
  }, [hydrated, segments, router, userId]);

  useEffect(() => {
    if (usePreferencesStore.persist?.rehydrate) {
      usePreferencesStore.persist.rehydrate();
    }
    if (useMealPlanStore.persist?.rehydrate) {
      useMealPlanStore.persist.rehydrate();
    }
    if (useGroceryListStore.persist?.rehydrate) {
      useGroceryListStore.persist.rehydrate();
    }
    if (useDealsStore.persist?.rehydrate) {
      useDealsStore.persist.rehydrate();
    }
  }, [userId]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={materialTheme}>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGate />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen
                name="recipe/[id]"
                options={{
                  title: 'Recipe',
                  headerBackTitle: 'Back',
                  headerStyle: { backgroundColor: '#FFFFFF' },
                  headerTintColor: '#1F1F1F',
                }}
              />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
