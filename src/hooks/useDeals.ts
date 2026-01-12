import { useQuery } from '@tanstack/react-query';
import type { DealItem, DealsQuery } from '@/src/types';
import { getDealsProvider } from '@/src/providers/dealsProvider';
import { normalizePostalCode } from '@/src/utils/postalCode';

const excludedCategories = new Set(['household']);

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
      return deals.filter((deal) => !isExcludedCategory(deal.category));
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 60,
  });
}
