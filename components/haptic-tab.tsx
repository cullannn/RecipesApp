import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const focused = props.accessibilityState?.selected;
  const pressableStyle =
    typeof props.style === 'function'
      ? (state: Parameters<NonNullable<typeof props.style>>[0]) => [
          props.style?.(state),
          focused && styles.focused,
        ]
      : [props.style, focused && styles.focused];

  return (
    <PlatformPressable
      {...props}
      style={pressableStyle}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
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
