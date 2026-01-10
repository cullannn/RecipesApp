import { StyleSheet, Text, View } from 'react-native';

export default function GroceryListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grocery list</Text>
      <Text style={styles.subtitle}>Generate a meal plan to build your list.</Text>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderTitle}>No items yet</Text>
        <Text style={styles.placeholderText}>
          Once your plan is ready, we will combine ingredients and highlight deals.
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
