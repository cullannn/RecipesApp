import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Checkbox, Switch } from 'react-native-paper';

import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
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
    const scopedDeals = plan.selectedStore
      ? (dealsQuery.data ?? []).filter((deal) => deal.store === plan.selectedStore)
      : dealsQuery.data ?? [];
    const next = buildGroceryList(plan, scopedDeals);
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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.contentSurface}>
          <PatternBackground />
          <GradientTitle text="List" style={styles.title} />
          <Text style={styles.subtitle}>Generate a plan to build your list.</Text>

          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>No items yet</Text>
            <Text style={styles.placeholderText}>
              Once your plan is ready, we will combine ingredients and highlight deals.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <GradientTitle text="List" style={styles.title} />
        {plan.selectedStore ? (
          <Text style={styles.storeNote}>Shop at {plan.selectedStore}</Text>
        ) : null}
        <View style={styles.controlsRow}>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Sort by store</Text>
            <Switch value={sortByStore} onValueChange={setSortByStore} />
          </View>
          <View style={styles.actionsRow}>
            <Button mode="outlined" onPress={clearChecked} style={styles.secondaryButton}>
              Clear checks
            </Button>
            <Button mode="contained" onPress={shareList} style={styles.primaryButton}>
              Share
            </Button>
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
              <Checkbox status={item.checked ? 'checked' : 'unchecked'} />
              <View style={styles.itemText}>
                <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta}>
                  Buy: {item.totalQuantity}
                  {item.matchedDeal
                    ? ` • ${item.matchedDeal.store} $${item.matchedDeal.price.toFixed(2)}`
                    : plan.selectedStore
                      ? ` • ${plan.selectedStore}`
                      : ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#D9DEE6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 16,
  },
  storeNote: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 10,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    marginRight: 4,
  },
  secondaryButton: {
    marginRight: 4,
  },
  list: {
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 12,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  itemChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemMeta: {
    fontSize: 12,
    color: '#5F6368',
  },
  placeholderCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1F1F1F',
  },
  placeholderText: {
    fontSize: 13,
    color: '#5F6368',
  },
});
