import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { createContext, useContext, useState } from 'react';
import { StyleSheet } from 'react-native';

const TabPressContext = createContext(false);

export function useTabPress() {
  return useContext(TabPressContext);
}

export function HapticTab(props: BottomTabBarButtonProps) {
  const focused = props.accessibilityState?.selected;
  const [pressed, setPressed] = useState(false);
  const pressableStyle =
    typeof props.style === 'function'
      ? (state: Parameters<NonNullable<typeof props.style>>[0]) => [
          props.style?.(state),
          focused && styles.focused,
        ]
      : [props.style, focused && styles.focused];

  return (
    <TabPressContext.Provider value={pressed}>
      <PlatformPressable
        {...props}
        style={pressableStyle}
        onPressIn={(ev) => {
          setPressed(true);
          if (process.env.EXPO_OS === 'ios') {
            // Add a soft haptic feedback when pressing down on the tabs.
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(ev);
        }}
        onPressOut={(ev) => {
          setPressed(false);
          props.onPressOut?.(ev);
        }}
        onPress={(ev) => {
          setPressed(false);
          props.onPress?.(ev);
        }}>
        {props.children}
      </PlatformPressable>
    </TabPressContext.Provider>
  );
}

const styles = StyleSheet.create({
  focused: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#1B7F3A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
