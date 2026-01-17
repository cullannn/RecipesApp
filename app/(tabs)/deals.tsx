import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View, Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Card, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
import { LogoWithShimmer } from '@/components/logo-with-shimmer';
import { useDeals } from '@/src/hooks/useDeals';
import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { getStoreDisplayName, normalizeStoreName, resolveStoreLogo, shouldIgnoreStore } from '@/src/utils/storeLogos';
import { getGtaCityForPostalCode } from '@/src/utils/postalCode';

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
const loadingFallbackIcon = 'basket-outline';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FilterItem = memo(function FilterItem({
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
});

const DealCard = memo(function DealCard({
  item,
  onPress,
}: {
  item: {
    id: string;
    title: string;
    store: string;
      price: number | null;
    wasPrice?: number;
    unit: string;
    validFrom?: string;
    validTo?: string;
    imageUrl?: string;
  };
  onPress?: () => void;
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
  const priceAvailable = typeof item.price === 'number' && Number.isFinite(item.price);
  const resolvedWasPrice =
    typeof item.wasPrice === 'number'
      ? item.wasPrice
      : priceAvailable
      ? buildWasPrice(item.price ?? 0)
      : undefined;
  const hasSavings =
    priceAvailable && typeof resolvedWasPrice === 'number' && resolvedWasPrice > (item.price ?? 0);
  const savingsPercent = hasSavings
    ? Math.round(((resolvedWasPrice! - (item.price ?? 0)) / resolvedWasPrice!) * 100)
    : null;
  const pressScale = useRef(new Animated.Value(1)).current;
  const animateCardScale = useCallback(
    (value: number) => {
      Animated.timing(pressScale, {
        toValue: value,
        duration: 160,
        easing: Easing.out(Easing.circle),
        useNativeDriver: true,
      }).start();
    },
    [pressScale]
  );
  const handlePressIn = useCallback(() => animateCardScale(0.96), [animateCardScale]);
  const handlePressOut = useCallback(() => animateCardScale(1), [animateCardScale]);
  return (
    <AnimatedPressable
      style={[styles.cardPressable, { transform: [{ scale: pressScale }] }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Card style={styles.card}>
        <View style={styles.cardClip}>
          <View style={styles.cardRow}>
            <View style={styles.thumbWrap}>
              <Image
                key={imageUrl ?? fallbackImage}
                source={{ uri: imageUrl ?? fallbackImage }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="none"
              />
              <View style={styles.thumbBadge} pointerEvents="none">
                <MaterialCommunityIcons name="chevron-right" size={12} color="#1B7F3A" />
              </View>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {priceAvailable ? (
                  hasSavings ? (
                    <>
                      <Text style={styles.priceWas}>Was CAD {resolvedWasPrice?.toFixed(2)}</Text>
                      {'  '}Now CAD {(item.price ?? 0).toFixed(2)} / {item.unit}
                    </>
                  ) : (
                    <>CAD {(item.price ?? 0).toFixed(2)} / {item.unit}</>
                  )
                ) : (
                  <>
                    <Text style={styles.priceWas}>On Sale - Click To View</Text>
                  </>
                )}
              </Text>
              {savingsPercent !== null ? (
                <Text style={styles.cardSavings}>Save {savingsPercent}%</Text>
              ) : null}
            </View>
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  );
});

function DealImageModal({
  deal,
  onClose,
}: {
  deal: { title: string; imageUrl?: string } | null;
  onClose: () => void;
}) {
  const imageUrl = useRemoteImage(deal?.title ?? '', deal?.imageUrl ?? null, { kind: 'deal' });
  return (
    <Modal animationType="fade" transparent visible={Boolean(deal)} onRequestClose={onClose}>
      <Pressable style={styles.imageModalBackdrop} onPress={onClose}>
        <Pressable style={styles.imageModalCard} onPress={() => {}}>
          {deal ? (
            <>
              <Image
                source={{ uri: imageUrl ?? fallbackImage }}
                style={styles.imageModalImage}
                contentFit="contain"
                cachePolicy="none"
              />
              <Pressable style={styles.imageModalClose} onPress={onClose} accessibilityLabel="Close deal image">
                <MaterialCommunityIcons name="close" size={18} color="#1F1F1F" />
              </Pressable>
              <Text style={styles.imageModalTitle}>{deal.title}</Text>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
function LoadingDealsSplash() {
  const spinValue = useRef(new Animated.Value(0)).current;
  const floatValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    spinAnim.start();
    floatAnim.start();
    return () => {
      spinAnim.stop();
      floatAnim.stop();
    };
  }, [spinValue, floatValue]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const float = floatValue.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  return (
    <View style={styles.loadingWrap}>
          <Animated.View style={[styles.loadingHalo, { transform: [{ translateY: float }] }]}>
            <Animated.View style={[styles.loadingIconWrap, { transform: [{ rotate: spin }] }]}>
              <Animated.Image
                source={require('../../assets/logos/app-logo/forkcast-logo-transparent.png')}
                style={styles.loadingIconImage}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>
      <Text style={styles.loadingText}>Refreshing the flyers...</Text>
      <Text style={styles.loadingSubtext}>Grabbing the freshest grocery deals for you.</Text>
    </View>
  );
}

const sortStoresByPreference = (stores: string[], favorites: string[]) => {
  if (favorites.length === 0) {
    return stores.slice().sort((a, b) => a.localeCompare(b));
  }
  const favoriteOrder = new Map(
    favorites.map((store, index) => [normalizeStoreName(store), index])
  );
  return stores.slice().sort((a, b) => {
    const aRank = favoriteOrder.get(normalizeStoreName(a));
    const bRank = favoriteOrder.get(normalizeStoreName(b));
    if (aRank !== undefined && bRank !== undefined) {
      return aRank - bRank;
    }
    if (aRank !== undefined) {
      return -1;
    }
    if (bRank !== undefined) {
      return 1;
    }
    return a.localeCompare(b);
  });
};

const buildStoreFilterList = (stores: string[], favorites: string[]) => {
  const normalizedToStore = new Map<string, string>();
  favorites.forEach((store) => {
    normalizedToStore.set(normalizeStoreName(store), store);
  });
  stores.forEach((store) => {
    const key = normalizeStoreName(store);
    if (!normalizedToStore.has(key)) {
      normalizedToStore.set(key, store);
    }
  });
  const favoriteKeys = favorites.map((store) => normalizeStoreName(store));
  const favoriteList = favoriteKeys
    .map((key) => normalizedToStore.get(key))
    .filter(Boolean) as string[];
  const remaining = Array.from(normalizedToStore.values()).filter(
    (store) => !favoriteKeys.includes(normalizeStoreName(store))
  );
  return [...favoriteList, ...remaining.sort((a, b) => a.localeCompare(b))];
};

export default function DealsScreen() {
  const { postalCode, favoriteStores } = usePreferencesStore();
  const { isGeneratingPlan } = useMealPlanStore();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<{ title: string; imageUrl?: string } | null>(null);
  const chevronAnims = useRef(new Map<string, Animated.Value>());
  const dealsQuery = useDeals({
    postalCode,
    stores: selectedStore ? [selectedStore] : undefined,
    categories: selectedCategory ? [selectedCategory] : undefined,
  });

  const deals = useMemo(
    () =>
      (dealsQuery.data ?? []).filter((deal) => !shouldIgnoreStore(deal.store)),
    [dealsQuery.data]
  );
  const cityLabel = useMemo(
    () => (postalCode ? getGtaCityForPostalCode(postalCode) : null),
    [postalCode]
  );
  const searchScale = useRef(new Animated.Value(1)).current;
  const animateSearchScale = useCallback(
    (value: number) => {
      Animated.timing(searchScale, {
        toValue: value,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [searchScale]
  );

  const stores = useMemo(() => {
    if (selectedStore) {
      return [selectedStore];
    }
    const list = new Set<string>();
    deals.forEach((deal) => list.add(deal.store));
    if (list.size === 0) {
      return [];
    }
    return buildStoreFilterList(Array.from(list), favoriteStores);
  }, [deals, favoriteStores, selectedStore]);

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
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredDeals = normalizedSearch
      ? deals.filter((deal) => deal.title.toLowerCase().includes(normalizedSearch))
      : deals;
    filteredDeals.forEach((deal) => {
      const range = formatRange(deal.validFrom, deal.validTo);
      const key = `${deal.store}__${range}`;
      const existing = groups.get(key);
      if (existing) {
        existing.deals.push(deal);
        return;
      }
      groups.set(key, { key, store: deal.store, range, deals: [deal] });
    });
    const grouped = Array.from(groups.values());
    if (favoriteStores.length === 0) {
      return grouped.sort((a, b) => a.store.localeCompare(b.store));
    }
    const favoriteOrder = new Map(
      favoriteStores.map((store, index) => [normalizeStoreName(store), index])
    );
    return grouped.sort((a, b) => {
      const aRank = favoriteOrder.get(normalizeStoreName(a.store));
      const bRank = favoriteOrder.get(normalizeStoreName(b.store));
      if (aRank !== undefined && bRank !== undefined) {
        return aRank - bRank;
      }
      if (aRank !== undefined) {
        return -1;
      }
      if (bRank !== undefined) {
        return 1;
      }
      return a.store.localeCompare(b.store);
    });
  }, [deals, favoriteStores, searchQuery]);

  const sections = useMemo(
    () =>
      groupedDeals.map((group) => ({
        ...group,
        data: collapsedGroups.has(group.key) ? [] : group.deals,
      })),
    [groupedDeals, collapsedGroups]
  );

  useEffect(() => {
    groupedDeals.forEach((group) => {
      if (!chevronAnims.current.has(group.key)) {
        chevronAnims.current.set(
          group.key,
          new Animated.Value(collapsedGroups.has(group.key) ? 0 : 1)
        );
      }
    });
  }, [groupedDeals, collapsedGroups]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      const isCollapsed = next.has(key);
      const progress = chevronAnims.current.get(key) ?? new Animated.Value(isCollapsed ? 0 : 1);
      if (!chevronAnims.current.has(key)) {
        chevronAnims.current.set(key, progress);
      }
      Animated.spring(progress, {
        toValue: isCollapsed ? 1 : 0,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);


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
  const hasPostalCode = Boolean(postalCode);

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: { key: string; store: string; range: string; data: typeof deals };
    }) => {
      const isCollapsed = collapsedGroups.has(section.key);
      const chevronProgress =
        chevronAnims.current.get(section.key) ?? new Animated.Value(isCollapsed ? 0 : 1);
      const rotate = chevronProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['-90deg', '0deg'],
      });
      const scale = chevronProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      });
      const displayStoreName = getStoreDisplayName(section.store);
      return (
        <View style={[styles.groupHeaderCard, isCollapsed && styles.groupHeaderCollapsed]}>
          <Pressable onPress={() => toggleGroup(section.key)} style={styles.groupHeader}>
            <View style={styles.groupHeaderRow}>
              {resolveStoreLogo(section.store) ? (
                <RNImage
                  source={resolveStoreLogo(section.store)}
                  style={styles.groupHeaderLogo}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={styles.groupTitle}>
                {displayStoreName} {section.range}
              </Text>
              <View style={styles.groupHeaderSpacer} />
              <Animated.View style={[styles.groupToggle, { transform: [{ scale }] }]}>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <MaterialCommunityIcons name="chevron-down-circle" size={20} color="#1B7F3A" />
                </Animated.View>
              </Animated.View>
            </View>
          </Pressable>
        </View>
      );
    },
    [collapsedGroups, toggleGroup]
  );

  const renderDealItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: (typeof deals)[number];
      index: number;
      section: { data: typeof deals };
    }) => {
      const isLast = index === section.data.length - 1;
      const isFirst = index === 0;
      return (
        <View style={[styles.groupItemRow, isFirst && styles.groupItemRowFirst, isLast && styles.groupItemRowLast]}>
          <DealCard
            item={item}
            onPress={() => setSelectedDeal({ title: item.title, imageUrl: item.imageUrl })}
          />
        </View>
      );
    },
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {!hasPostalCode ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Add your postal code to see GTA deals.</Text>
          <Text style={styles.subtitle}>Go to Settings to set your location.</Text>
        </View>
      ) : (
        <>
          <Modal animationType="fade" transparent visible={searchModalVisible} onRequestClose={() => setSearchModalVisible(false)}>
            <View style={styles.searchModalBackdrop}>
              <View style={styles.searchModalContent}>
            <Text style={styles.searchModalTitle}>Search deals</Text>
            <TextInput
              mode="outlined"
              placeholder="Steak, Ribs, Salmon, Eggs..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              textColor="#2A2F34"
              placeholderTextColor="#9AA0A6"
              left={<TextInput.Icon icon="magnify" color="#7A8086" />}
              right={
                searchQuery ? (
                  <TextInput.Icon icon="close-circle" color="#7A8086" onPress={() => setSearchQuery('')} />
                ) : null
              }
            />
            <Button
              mode="contained"
              buttonColor="#1B7F3A"
              textColor="#FFFFFF"
              style={styles.searchModalButton}
              onPress={() => setSearchModalVisible(false)}>
              Done
            </Button>
          </View>
        </View>
      </Modal>
      <DealImageModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <LogoWithShimmer isActive={isGeneratingPlan} tintColor="#1B1B1B" size={32} />
            <Text style={styles.headerTitle}>{cityLabel ? `Deals in ${cityLabel}` : 'Deals'}</Text>
          </View>
          <AnimatedPressable
            style={[styles.searchButton, { transform: [{ scale: searchScale }] }]}
            onPress={() => setSearchModalVisible(true)}
            onPressIn={() => animateSearchScale(0.9)}
            onPressOut={() => animateSearchScale(1)}>
            <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" />
          </AnimatedPressable>
        </View>
      </View>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <FilterItem
            label="All Stores"
            selected={!selectedStore}
            onPress={() => startTransition(() => setSelectedStore(null))}
          />
          {stores.map((store) => (
            <FilterItem
              key={store}
              label={getStoreDisplayName(store)}
              selected={selectedStore === store}
              onPress={() => startTransition(() => setSelectedStore(store))}
              imageSource={resolveStoreLogo(store)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <FilterItem
            label="All"
            selected={!selectedCategory}
            onPress={() => startTransition(() => setSelectedCategory(null))}
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
                onPress={() => startTransition(() => setSelectedCategory(category))}
                iconName={iconName}
              />
            );
          })}
        </ScrollView>
      </View>

          <View style={styles.listWrapper}>
            <PatternBackground />
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              style={styles.listSurface}
              renderSectionHeader={renderSectionHeader}
              renderItem={renderDealItem}
              ListEmptyComponent={
                dealsQuery.isLoading ? (
                  <LoadingDealsSplash />
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.subtitle}>
                      {dealsQuery.isError
                        ? 'Waiting for the local scraper to finish. Hold tight!'
                        : 'No deals found for that filter.'}
                    </Text>
                    {dealsQuery.isError ? (
                      <Button mode="contained" compact onPress={() => dealsQuery.refetch()}>
                        Retry
                      </Button>
                    ) : null}
                  </View>
                )
              }
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={9}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              stickySectionHeadersEnabled={false}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 6,
    marginBottom: 8,
  },
  searchInput: {
    height: 40,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  searchButton: {
    backgroundColor: '#1B7F3A',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchModalContent: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  searchModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  searchModalButton: {
    marginTop: 6,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imageModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 420,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  imageModalImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#F1F3F4',
  },
  imageModalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1B7F3A',
  },
  imageModalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    gap: 6,
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
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  loadingHalo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(27, 127, 58, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(27, 127, 58, 0.15)',
  },
  loadingIconImage: {
    width: 54,
    height: 54,
    tintColor: '#1B7F3A',
  },
  loadingText: {
    fontSize: 16,
    color: '#2A2F34',
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 13,
    color: '#7A8086',
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
  groupHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    overflow: 'hidden',
    borderBottomWidth: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  groupHeaderCollapsed: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  groupHeader: {
    backgroundColor: '#D8EFDF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CFE8D7',
    alignItems: 'center',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  groupHeaderLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  groupHeaderSpacer: {
    flex: 1,
  },
  groupToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  groupBody: {
    padding: 12,
  },
  groupItemRow: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E6E9EF',
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  groupItemRowFirst: {
    paddingTop: 10,
  },
  groupItemRowLast: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomWidth: 1,
    borderColor: '#E6E9EF',
    paddingBottom: 8,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  listWrapper: {
    flex: 1,
    backgroundColor: '#D9DEE6',
  },
  listSurface: {
    backgroundColor: 'transparent',
  },
  card: {
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
  },
  cardPressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardMeta: {
    fontSize: 12,
    color: '#5F6368',
  },
  priceWas: {
    color: '#9AA0A6',
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
    borderWidth: 1,
    borderColor: 'rgba(27, 127, 58, 0.35)',
    backgroundColor: '#F1F3F4',
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27, 127, 58, 0.35)',
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
