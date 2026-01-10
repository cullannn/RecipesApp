import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMealPlanStore } from '@/src/state/useMealPlanStore';

const mealOptions = [3, 5, 7];

export default function PlanScreen() {
  const { mealsRequested, setMealsRequested } = useMealPlanStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meal plan</Text>
      <Text style={styles.subtitle}>Choose how many meals to plan this week.</Text>

      <View style={styles.optionRow}>
        {mealOptions.map((count) => (
          <Pressable
            key={count}
            style={[styles.optionChip, mealsRequested === count && styles.optionChipActive]}
            onPress={() => setMealsRequested(count)}>
            <Text style={styles.optionText}>{count} meals</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderTitle}>Your plan will appear here</Text>
        <Text style={styles.placeholderText}>
          We will use your pinned recipes, preferences, and deals to build a weekly plan.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f1f1f1',
  },
  optionChipActive: {
    backgroundColor: '#d6f2e9',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 13,
    color: '#666',
  },
});
