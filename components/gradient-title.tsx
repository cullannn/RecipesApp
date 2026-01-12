import { Platform, StyleSheet, Text, UIManager, type TextStyle } from 'react-native';

type GradientTitleProps = {
  text: string;
  style?: TextStyle;
  colors?: string[];
};

let MaskedViewComponent: React.ComponentType<any> | null = null;
let LinearGradientComponent: React.ComponentType<any> | null = null;
try {
  MaskedViewComponent = require('@react-native-masked-view/masked-view').default ?? null;
  LinearGradientComponent = require('expo-linear-gradient').LinearGradient ?? null;
} catch {
  MaskedViewComponent = null;
  LinearGradientComponent = null;
}

const canRenderGradient =
  Platform.OS !== 'web' &&
  MaskedViewComponent &&
  LinearGradientComponent &&
  UIManager.getViewManagerConfig('RNCMaskedView') &&
  UIManager.getViewManagerConfig('ExpoLinearGradient');

export function GradientTitle({ text, style, colors }: GradientTitleProps) {
  if (!canRenderGradient) {
    return <Text style={[styles.text, style]}>{text}</Text>;
  }
  const MaskedView = MaskedViewComponent;
  const LinearGradient = LinearGradientComponent;
  return (
    <MaskedView
      style={styles.container}
      maskElement={<Text style={[styles.text, style]}>{text}</Text>}>
      <LinearGradient
        colors={colors ?? ['#1B7F3A', '#5BBE6C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}>
        <Text style={[styles.text, style, styles.fill]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
  },
  fill: {
    color: 'transparent',
  },
});
