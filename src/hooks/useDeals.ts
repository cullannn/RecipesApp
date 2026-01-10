import { useQuery } from '@tanstack/react-query';
import type { DealItem, DealsQuery } from '@/src/types';
import { getDealsProvider } from '@/src/providers/dealsProvider';
import { normalizePostalCode } from '@/src/utils/postalCode';

export function useDeals(query: DealsQuery) {
  const normalizedPostal = normalizePostalCode(query.postalCode);
  return useQuery<DealItem[]>({
    queryKey: ['deals', normalizedPostal, query.stores, query.categories],
    enabled: Boolean(normalizedPostal),
    queryFn: async () => {
      const provider = await getDealsProvider();
      return provider.searchDeals({
        ...query,
        postalCode: normalizedPostal ?? '',
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}
