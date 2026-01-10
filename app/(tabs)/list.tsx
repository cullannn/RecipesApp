import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { useDeals } from '@/src/hooks/useDeals';
import { buildGroceryList } from '@/src/logic/mealPlan';
import { useGroceryListStore } from '@/src/state/useGroceryListStore';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { getCategorySection } from '@/src/utils/categories';

const categoryOrder = ['Produce', 'Meat', 'Dairy', 'Pantry', 'Frozen', 'Other'];

type Section = {
  title: string;
  data: ReturnType<typeof buildGroceryList>;
};

export default function GroceryListScreen() {
  const { postalCode } = usePreferencesStore();
  const dealsQuery = useDeals({ postalCode });
  const { plan } = useMealPlanStore();
  const { items, planId, setItems, toggleChecked, clearChecked } = useGroceryListStore();
  const [sortByStore, setSortByStore] = useState(false);

  useEffect(() => {
    if (!plan) {
      return;
    }
    if (!dealsQuery.data && !dealsQuery.isLoading) {
      return;
    }
    const next = buildGroceryList(plan, dealsQuery.data ?? []);
    const checkedMap = new Map(items.map((item) => [item.id, item.checked]));
    const merged = next.map((item) => ({
      ...item,
      checked: checkedMap.get(item.id) ?? item.checked,
    }));
    const existingMap = new Map(items.map((item) => [item.id, item]));
    const hasChanges =
      planId !== plan.id ||
      merged.length !== items.length ||
      merged.some((item) => {
        const existing = existingMap.get(item.id);
        if (!existing) {
          return true;
        }
        if (existing.checked !== item.checked) {
          return true;
        }
        if (existing.totalQuantity !== item.totalQuantity) {
          return true;
        }
        const existingDeal = existing.matchedDeal?.dealId ?? '';
        const nextDeal = item.matchedDeal?.dealId ?? '';
        return existingDeal !== nextDeal;
      });
    if (!hasChanges) {
      return;
    }
    setItems(merged, plan.id);
  }, [plan, planId, dealsQuery.data, dealsQuery.isLoading, items, setItems]);

  const sections = useMemo<Section[]>(() => {
    if (items.length === 0) {
      return [];
    }
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = sortByStore
        ? item.matchedDeal?.store ?? 'No deal'
        : getCategorySection(item.category);
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }
    const sortedKeys = sortByStore
      ? Array.from(grouped.keys()).sort()
      : categoryOrder.filter((key) => grouped.has(key)).concat(
          Array.from(grouped.keys()).filter((key) => !categoryOrder.includes(key)).sort()
        );
    return sortedKeys.map((key) => ({ title: key, data: grouped.get(key) ?? [] }));
  }, [items, sortByStore]);

  const shareList = async () => {
    if (items.length === 0) {
      return;
    }
    const lines = items.map((item) => {
      const dealText = item.matchedDeal
        ? ` (${item.matchedDeal.store} $${item.matchedDeal.price.toFixed(2)})`
        : '';
      return `${item.checked ? '[x]' : '[ ]'} ${item.name} - ${item.totalQuantity}${dealText}`;
    });
    await Share.share({
      title: 'Grocery list',
      message: lines.join('\n'),
    });
  };

  if (!plan) {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grocery list</Text>
      <View style={styles.controlsRow}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sort by store</Text>
          <Switch value={sortByStore} onValueChange={setSortByStore} />
        </View>
        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={clearChecked}>
            <Text style={styles.secondaryButtonText}>Clear checks</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={shareList}>
            <Text style={styles.primaryButtonText}>Share</Text>
          </Pressable>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.placeholderText}>
            {dealsQuery.isLoading ? 'Loading deals...' : 'No items found for this plan.'}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.itemRow} onPress={() => toggleChecked(item.id)}>
            <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
              {item.checked ? <Text style={styles.checkboxLabel}>✓</Text> : null}
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.totalQuantity}
                {item.matchedDeal
                  ? ` • ${item.matchedDeal.store} $${item.matchedDeal.price.toFixed(2)}`
                  : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
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
  controlsRow: {
    gap: 12,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#0b6e4f',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: '#f1f1f1',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
  },
  list: {
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0b6e4f',
    borderColor: '#0b6e4f',
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemMeta: {
    fontSize: 12,
    color: '#666',
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
