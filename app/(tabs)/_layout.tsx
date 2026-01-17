import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { AnimatedTabIcon } from '@/components/animated-tab-icon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/state/useAuthStore';

export default function TabLayout() {
  useColorScheme();
  const userId = useAuthStore((state) => state.userId);
  if (!userId) {
    return <Redirect href="/login" />;
  }
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B7F3A',
        tabBarInactiveTintColor: '#8A9096',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: 68,
          paddingBottom: 0,
          paddingTop: 6,
          paddingHorizontal: 24,
          marginHorizontal: 0,
          marginBottom: 0,
          borderRadius: 0,
          overflow: 'visible',
          shadowColor: '#1A73E8',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 16,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Deals',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon size={28} name="tag.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon size={28} name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon size={28} name="fork.knife" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <AnimatedTabIcon size={28} name="gearshape.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="list" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="preferences" options={{ href: null }} />
    </Tabs>
  );
}
