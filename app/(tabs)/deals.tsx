import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useDeals } from '@/src/hooks/useDeals';
import { useRecipes } from '@/src/hooks/useRecipes';
import { useDealsStore } from '@/src/state/useDealsStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { normalizeName } from '@/src/utils/normalization';
import { matchDealToIngredient } from '@/src/utils/matching';

export default function DealsScreen() {
  const { postalCode } = usePreferencesStore();
  const recipes = useRecipes();
  const { savedDealIds, toggleSavedDeal } = useDealsStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [onlyIngredients, setOnlyIngredients] = useState(false);

  const dealsQuery = useDeals({
    postalCode,
    stores: selectedStore ? [selectedStore] : undefined,
    categories: selectedCategory ? [selectedCategory] : undefined,
  });

  const ingredientSet = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        set.add(normalizeName(ingredient.name));
      });
    });
    return set;
  }, [recipes]);

  const deals = useMemo(() => {
    if (!dealsQuery.data) {
      return [];
    }
    if (!onlyIngredients) {
      return dealsQuery.data;
    }
    return dealsQuery.data.filter((deal) => {
      const normalized = normalizeName(deal.title);
      return ingredientSet.has(normalized) || Array.from(ingredientSet).some((name) => normalized.includes(name));
    });
  }, [dealsQuery.data, ingredientSet, onlyIngredients]);

  const stores = useMemo(() => {
    const list = new Set<string>();
    dealsQuery.data?.forEach((deal) => list.add(deal.store));
    return Array.from(list);
  }, [dealsQuery.data]);

  const categories = useMemo(() => {
    const list = new Set<string>();
    dealsQuery.data?.forEach((deal) => list.add(deal.category));
    return Array.from(list);
  }, [dealsQuery.data]);

  if (!postalCode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Add your postal code to see Toronto deals.</Text>
        <Text style={styles.subtitle}>Go to Settings to set your location.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <Text style={styles.sectionTitle}>Filters</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Only ingredients</Text>
          <Switch value={onlyIngredients} onValueChange={setOnlyIngredients} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        <Pressable
          style={[styles.chip, !selectedStore && styles.chipActive]}
          onPress={() => setSelectedStore(null)}>
          <Text style={styles.chipText}>All stores</Text>
        </Pressable>
        {stores.map((store) => (
          <Pressable
            key={store}
            style={[styles.chip, selectedStore === store && styles.chipActive]}
            onPress={() => setSelectedStore(store)}>
            <Text style={styles.chipText}>{store}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        <Pressable
          style={[styles.chip, !selectedCategory && styles.chipActive]}
          onPress={() => setSelectedCategory(null)}>
          <Text style={styles.chipText}>All categories</Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[styles.chip, selectedCategory === category && styles.chipActive]}
            onPress={() => setSelectedCategory(category)}>
            <Text style={styles.chipText}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.subtitle}>
            {dealsQuery.isLoading ? 'Loading deals...' : 'No deals found for that filter.'}
          </Text>
        }
        renderItem={({ item }) => {
          const isSaved = savedDealIds.includes(item.id);
          const isIngredient = recipes.some((recipe) =>
            recipe.ingredients.some((ingredient) => matchDealToIngredient(item, ingredient.name))
          );
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Pressable onPress={() => toggleSavedDeal(item.id)}>
                  <Text style={styles.saveText}>{isSaved ? 'Saved' : 'Save'}</Text>
                </Pressable>
              </View>
              <Text style={styles.cardMeta}>{item.store}</Text>
              <Text style={styles.cardMeta}>
                CAD {item.price.toFixed(2)} / {item.unit}
              </Text>
              <Text style={styles.cardMeta}>
                {item.validFrom} - {item.validTo}
              </Text>
              {isIngredient && <Text style={styles.badge}>Recipe ingredient</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
  },
  chipsRow: {
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f1f1',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#d6f2e9',
  },
  chipText: {
    fontSize: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  cardMeta: {
    fontSize: 13,
    color: '#555',
  },
  saveText: {
    fontSize: 13,
    color: '#0b6e4f',
    fontWeight: '600',
  },
  badge: {
    marginTop: 6,
    fontSize: 12,
    color: '#0b6e4f',
  },
});
