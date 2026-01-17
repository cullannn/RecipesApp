import { StyleSheet, Text, View } from 'react-native';
import { GradientTitle } from '@/components/gradient-title';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <GradientTitle text="Explore" style={styles.title} />
      <Text style={styles.subtitle}>
        Keep track of new features here. For now, focus on deals, recipes, and your plan.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#B6DCC6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 13,
    color: '#5F6368',
  },
});
