import { useQuery } from '@tanstack/react-query';
import type { DealItem, DealsQuery } from '@/src/types';
import { getDealsProvider } from '@/src/providers/dealsProvider';
import { normalizePostalCode } from '@/src/utils/postalCode';

const excludedCategories = new Set(['household', 'other']);

const isExcludedCategory = (category?: string) =>
  Boolean(category && excludedCategories.has(category.toLowerCase()));

export function useDeals(query: DealsQuery) {
  const normalizedPostal = normalizePostalCode(query.postalCode);
  return useQuery<DealItem[]>({
    queryKey: ['deals', normalizedPostal, query.stores, query.categories],
    enabled: Boolean(normalizedPostal),
    queryFn: async () => {
      const provider = await getDealsProvider();
      const deals = await provider.searchDeals({
        ...query,
        postalCode: normalizedPostal ?? '',
      });
      const filtered = deals.filter((deal) => !isExcludedCategory(deal.category));
      const storeCounts = filtered.reduce<Map<string, number>>((acc, deal) => {
        acc.set(deal.store, (acc.get(deal.store) ?? 0) + 1);
        return acc;
      }, new Map());
      return filtered.filter((deal) => (storeCounts.get(deal.store) ?? 0) >= 10);
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 60,
  });
}
