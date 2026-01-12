import type { DealItem, DealsProvider, DealsQuery } from './dealsProvider';
import { mockDealsProvider } from './mockDealsProvider';
import { normalizePostalCode } from '@/src/utils/postalCode';

const BASE_URL = process.env.EXPO_PUBLIC_DEALS_SERVER_URL ?? 'http://localhost:8790';
const REQUEST_TIMEOUT_MS = 4000;

function applyFilters(items: DealItem[], query: DealsQuery): DealItem[] {
  let results = items;
  if (query.stores && query.stores.length > 0) {
    const storeSet = new Set(query.stores.map((store) => store.toLowerCase()));
    results = results.filter((deal) => storeSet.has(deal.store.toLowerCase()));
  }
  if (query.categories && query.categories.length > 0) {
    const categorySet = new Set(query.categories.map((category) => category.toLowerCase()));
    results = results.filter((deal) => categorySet.has(deal.category.toLowerCase()));
  }
  return results;
}

export const localScrapeDealsProvider: DealsProvider = {
  async searchDeals(query: DealsQuery): Promise<DealItem[]> {
    const normalizedPostal = normalizePostalCode(query.postalCode);
    if (!normalizedPostal) {
      return [];
    }
    const url = new URL('/api/deals', BASE_URL);
    url.searchParams.set('postalCode', normalizedPostal);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Deals server error: ${response.status}`);
      }
      const data = await response.json();
      const deals = Array.isArray(data?.deals) ? data.deals : [];
      return applyFilters(deals, query);
    } catch (error) {
      console.warn('Deals server unavailable, falling back to local fixtures.', error);
      return mockDealsProvider.searchDeals(query);
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
