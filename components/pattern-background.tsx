import { Dimensions, StyleSheet, View } from 'react-native';

const DOT_SIZE = 2;
const DOT_SPACING = 26;
const DOT_OPACITY = 0.22;

export function PatternBackground() {
  const { width, height } = Dimensions.get('window');
  const columns = Math.ceil(width / DOT_SPACING);
  const rows = Math.ceil(height / DOT_SPACING);
  const dots = [];

  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= columns; col += 1) {
      const left = col * DOT_SPACING;
      const top = row * DOT_SPACING;
      dots.push(
        <View
          key={`${row}-${col}`}
          style={[styles.dot, { left, top }]}
        />
      );
    }
  }

  return <View pointerEvents="none" style={styles.container}>{dots}</View>;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: `rgba(255, 255, 255, ${DOT_OPACITY})`,
  },
});
