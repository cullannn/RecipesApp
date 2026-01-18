import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { useEffect, useState } from 'react';

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
    background: '#B6DCC6',
    outline: '#E0E0E0',
  },
  fonts: {
    ...MD3LightTheme.fonts,
    displayLarge: { fontFamily: 'Montserrat_700Bold', fontWeight: '700' },
    displayMedium: { fontFamily: 'Montserrat_500Medium', fontWeight: '500' },
    bodyLarge: { fontFamily: 'Montserrat_400Regular', fontWeight: '400' },
    bodyMedium: { fontFamily: 'Montserrat_400Regular', fontWeight: '400' },
    labelLarge: { fontFamily: 'Montserrat_400Regular', fontWeight: '400' },
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function UserStoreRehydration() {
  const userId = useAuthStore((state) => state.userId);
  const [authHydrated, setAuthHydrated] = useState(() =>
    useAuthStore.persist?.hasHydrated?.() ?? true
  );

  useEffect(() => {
    const onFinish = useAuthStore.persist?.onFinishHydration?.(() => setAuthHydrated(true));
    if (!authHydrated) {
      setAuthHydrated(useAuthStore.persist?.hasHydrated?.() ?? true);
    }
    return onFinish;
  }, [authHydrated]);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
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
  }, [authHydrated, userId]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_700Bold,
  });

  const colorScheme = useColorScheme();

  useEffect(() => {
    if (fontsLoaded) {
      if (!Text.defaultProps) {
        Text.defaultProps = {};
      }
      const existingStyle = Text.defaultProps.style;
      Text.defaultProps.style = [
        existingStyle,
        { fontFamily: 'Montserrat_400Regular' },
      ];
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={materialTheme}>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <SafeAreaProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <UserStoreRehydration />
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen
                  name="recipe/[id]"
                  options={{
                    title: 'Recipe',
                    headerStyle: { backgroundColor: '#FFFFFF' },
                    headerTintColor: '#1F1F1F',
                    headerBackVisible: false,
                    headerBackTitleVisible: false,
                    headerBackButtonMenuEnabled: false,
                    headerLeftContainerStyle: styles.backButtonContainer,
                    headerLeft: () => (
                      <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                        android_ripple={{ color: 'transparent' }}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color="#1B7F3A" />
                      </Pressable>
                    ),
                  }}
                />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="dark" />
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PaperProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  backButtonContainer: {
    backgroundColor: 'transparent',
    paddingLeft: 12,
  },
  backButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
});
