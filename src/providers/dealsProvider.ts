import type { DealItem, DealsQuery } from '@/src/types';

export type { DealItem, DealsQuery };

export type DealsProvider = {
  searchDeals: (query: DealsQuery) => Promise<DealItem[]>;
};

export type DealsProviderId = 'mock' | 'flipp' | 'bestco' | 'local-scrape';

const providerId = (process.env.EXPO_PUBLIC_USE_DEALS_PROVIDER ??
  process.env.USE_DEALS_PROVIDER ??
  'mock') as DealsProviderId;

export function getDealsProviderId(): DealsProviderId {
  if (providerId === 'flipp') {
    return 'flipp';
  }
  if (providerId === 'bestco') {
    return 'bestco';
  }
  if (providerId === 'local-scrape') {
    return 'local-scrape';
  }
  return 'mock';
}

export async function getDealsProvider(): Promise<DealsProvider> {
  const { getDealsProvider } = await import('./providersRegistry');
  return getDealsProvider();
}
