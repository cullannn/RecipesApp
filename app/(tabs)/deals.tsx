import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
import { useDeals } from '@/src/hooks/useDeals';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { getGtaCityForPostalCode } from '@/src/utils/postalCode';

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

function FilterItem({
  label,
  selected,
  onPress,
  iconName,
  imageSource,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  imageSource?: number | string;
}) {
  const logoSource = typeof imageSource === 'string' ? { uri: imageSource } : imageSource;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterItem, selected && styles.filterItemSelected]}>
      {imageSource ? (
        <View style={styles.filterLogoWrap}>
          <RNImage source={logoSource} style={styles.filterLogo} resizeMode="contain" />
        </View>
      ) : iconName ? (
        <MaterialCommunityIcons name={iconName} size={16} color={selected ? '#1B7F3A' : '#8A9096'} />
      ) : (
        <View style={styles.filterLogoWrap}>
          <MaterialCommunityIcons name="storefront-outline" size={16} color={selected ? '#1B7F3A' : '#8A9096'} />
        </View>
      )}
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function DealCard({
  item,
}: {
  item: {
    id: string;
    title: string;
    store: string;
    price: number;
    wasPrice?: number;
    unit: string;
    validFrom?: string;
    validTo?: string;
    imageUrl?: string;
  };
}) {
  const imageUrl = useRemoteImage(item.title, item.imageUrl ?? null, { kind: 'deal' });
  const buildWasPrice = (price: number) => {
    if (!Number.isFinite(price)) {
      return undefined;
    }
    const uplift = price * 1.25;
    const rounded = Math.ceil(uplift * 100) / 100;
    const dollars = Math.floor(rounded);
    const candidate = Number((dollars + 0.99).toFixed(2));
    if (candidate <= price) {
      return Number((price + 1).toFixed(2));
    }
    return candidate;
  };
  const resolvedWasPrice =
    typeof item.wasPrice === 'number' ? item.wasPrice : buildWasPrice(item.price);
  const hasSavings = typeof resolvedWasPrice === 'number' && resolvedWasPrice > item.price;
  const savingsPercent = hasSavings
    ? Math.round(((resolvedWasPrice - item.price) / resolvedWasPrice) * 100)
    : null;
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <Image
          key={imageUrl ?? fallbackImage}
          source={{ uri: imageUrl ?? fallbackImage }}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="none"
        />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {hasSavings ? (
              <>
                <Text style={styles.priceWas}>Was CAD {resolvedWasPrice?.toFixed(2)}</Text>
                {'  '}Now CAD {item.price.toFixed(2)} / {item.unit}
              </>
            ) : (
              <>CAD {item.price.toFixed(2)} / {item.unit}</>
            )}
          </Text>
          {savingsPercent !== null ? (
            <Text style={styles.cardSavings}>Save {savingsPercent}%</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const storeLogoMap: Record<string, number | string> = {
  'no frills': require('../../assets/logos/official/no-frills.png'),
  loblaws: require('../../assets/logos/official/loblaws.png'),
  'real canadian superstore': require('../../assets/logos/official/real-canadian-superstore.png'),
  metro: require('../../assets/logos/official/metro.png'),
  freshco: require('../../assets/logos/official/freshco.png'),
  'food basics': require('../../assets/logos/official/food-basics.png'),
  walmart: require('../../assets/logos/official/walmart.png'),
  costco: require('../../assets/logos/official/costco.png'),
  longos: require('../../assets/logos/official/longos.png'),
  bestco: require('../../assets/logos/official/bestco.png'),
};

const normalizeStoreName = (store: string) =>
  store.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const resolveStoreLogo = (store: string) => {
  const normalized = normalizeStoreName(store);
  const candidates = [
    normalized,
    normalized.replace(/\s+/g, ''),
    normalized.replace('fresh foods', '').trim(),
    normalized.replace('real canadian ', '').trim(),
  ].filter(Boolean);
  for (const key of candidates) {
    const logo = storeLogoMap[key];
    if (logo) {
      return logo;
    }
  }
  return undefined;
};

export default function DealsScreen() {
  const { postalCode } = usePreferencesStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const dealsQuery = useDeals({
    postalCode,
    stores: selectedStore ? [selectedStore] : undefined,
    categories: selectedCategory ? [selectedCategory] : undefined,
  });

  const deals = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data]);
  const cityLabel = useMemo(
    () => (postalCode ? getGtaCityForPostalCode(postalCode) : null),
    [postalCode]
  );

  const stores = useMemo(() => {
    const list = new Set<string>();
    dealsQuery.data?.forEach((deal) => list.add(deal.store));
    return Array.from(list);
  }, [dealsQuery.data]);

  const groupedDeals = useMemo(() => {
    type Deal = (typeof deals)[number];
    type Group = { key: string; store: string; range: string; deals: Deal[] };
    const formatRange = (start?: string, end?: string) => {
      if (!start || !end) {
        return 'Current deals';
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return 'Current deals';
      }
      const format = (date: Date) =>
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `(${format(startDate)} to ${format(endDate)})`;
    };
    const groups = new Map<string, Group>();
    deals.forEach((deal) => {
      const range = formatRange(deal.validFrom, deal.validTo);
      const key = `${deal.store}__${range}`;
      const existing = groups.get(key);
      if (existing) {
        existing.deals.push(deal);
        return;
      }
      groups.set(key, { key, store: deal.store, range, deals: [deal] });
    });
    return Array.from(groups.values()).sort((a, b) => a.store.localeCompare(b.store));
  }, [deals]);

  const categories = useMemo(() => {
    const list = new Set<string>();
    dealsQuery.data?.forEach((deal) => {
      if (deal.category?.toLowerCase() === 'household') {
        return;
      }
      list.add(deal.category);
    });
    return Array.from(list);
  }, [dealsQuery.data]);

  const categoryIconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    produce: 'leaf',
    meat: 'food-steak',
    dairy: 'cup',
    pantry: 'package-variant-closed',
    frozen: 'snowflake',
    snacks: 'cookie',
    beverages: 'cup-water',
    household: 'spray-bottle',
    bakery: 'bread-slice',
    seafood: 'fish',
    deli: 'food-drumstick',
  };
  if (!postalCode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Add your postal code to see GTA deals.</Text>
        <Text style={styles.subtitle}>Go to Settings to set your location.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.filterBar}>
        <View style={styles.header}>
          <GradientTitle text={cityLabel ? `Deals in ${cityLabel}` : 'Deals'} style={styles.title} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <FilterItem label="All Stores" selected={!selectedStore} onPress={() => setSelectedStore(null)} />
          {stores.map((store) => (
            <FilterItem
              key={store}
              label={store}
              selected={selectedStore === store}
              onPress={() => setSelectedStore(store)}
              imageSource={resolveStoreLogo(store)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <FilterItem
            label="All"
            selected={!selectedCategory}
            onPress={() => setSelectedCategory(null)}
            iconName="apps"
          />
          {categories.map((category) => {
            const label = category ? category[0].toUpperCase() + category.slice(1) : category;
            const iconName =
              category && categoryIconMap[category.toLowerCase()] ? categoryIconMap[category.toLowerCase()] : undefined;
            return (
              <FilterItem
                key={category}
                label={label}
                selected={selectedCategory === category}
                onPress={() => setSelectedCategory(category)}
                iconName={iconName}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.listWrapper}>
        <PatternBackground />
        <FlatList
          data={groupedDeals}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          style={styles.listSurface}
          ListEmptyComponent={
            <Text style={styles.subtitle}>
              {dealsQuery.isLoading ? 'Loading deals...' : 'No deals found for that filter.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>
                  {item.store} {item.range}
                </Text>
              </View>
              <View style={styles.groupBody}>
                {item.deals.map((deal) => {
                  return (
                    <DealCard
                      key={deal.id}
                      item={deal}
                    />
                  );
                })}
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 6,
    marginBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f7f3',
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
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  chipsRow: {
    paddingHorizontal: 12,
    marginBottom: 6,
    paddingTop: 4,
  },
  filterItem: {
    marginRight: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
    alignItems: 'center',
    gap: 4,
  },
  filterItemSelected: {
    borderBottomWidth: 2,
    borderBottomColor: '#1B7F3A',
  },
  filterLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  filterLogoWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    color: '#5F6368',
    fontSize: 13,
  },
  filterTextSelected: {
    color: '#1B7F3A',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  groupHeader: {
    backgroundColor: '#D8EFDF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CFE8D7',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  groupBody: {
    padding: 12,
  },
  listWrapper: {
    flex: 1,
    backgroundColor: '#D9DEE6',
  },
  listSurface: {
    backgroundColor: 'transparent',
  },
  card: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6E9EF',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: '#5F6368',
  },
  priceWas: {
    color: '#9AA0A6',
    textDecorationLine: 'line-through',
  },
  cardSavings: {
    fontSize: 12,
    color: '#1B7F3A',
    fontWeight: '600',
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F3F4',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 4,
  },
});
