import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';

type LogoWithShimmerProps = {
  isActive: boolean;
  tintColor?: string;
  size?: number;
  style?: ViewStyle;
};

export function LogoWithShimmer({
  isActive,
  tintColor = '#1F1F1F',
  size = 32,
  style,
}: LogoWithShimmerProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      shimmer.stopAnimation();
      shimmer.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isActive, shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const activeTint = '#1B7F3A';

  return (
    <Animated.View
      style={[
        { opacity: isActive ? opacity : 1 },
        isActive ? styles.glow : null,
        style,
      ]}>
      <Image
        source={require('../assets/logos/app-logo/forkcast-logo-transparent.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
        tintColor={isActive ? activeTint : tintColor}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: '#1B7F3A',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
