import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTabPress } from '@/components/haptic-tab';

type AnimatedTabIconProps = {
  name: Parameters<typeof IconSymbol>[0]['name'];
  focused: boolean;
  size?: number;
};

export function AnimatedTabIcon({ name, focused, size = 28 }: AnimatedTabIconProps) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressed = useTabPress();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: pressed || focused ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [focused, pressed, progress]);

  return (
    <View style={{ width: size, height: size }}>
      <IconSymbol name={name} size={size} color="#8A9096" />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activeLayer,
          {
            opacity: progress,
          },
        ]}>
        <IconSymbol name={name} size={size} color="#1B7F3A" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
