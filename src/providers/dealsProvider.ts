import type { DealItem, DealsQuery } from '@/src/types';

export type { DealItem, DealsQuery };

export type DealsProvider = {
  searchDeals: (query: DealsQuery) => Promise<DealItem[]>;
};

export type DealsProviderId = 'mock' | 'flipp';

const providerId = (process.env.EXPO_PUBLIC_USE_DEALS_PROVIDER ??
  process.env.USE_DEALS_PROVIDER ??
  'mock') as DealsProviderId;

export function getDealsProviderId(): DealsProviderId {
  return providerId === 'flipp' ? 'flipp' : 'mock';
}

export async function getDealsProvider(): Promise<DealsProvider> {
  const { getDealsProvider } = await import('./providersRegistry');
  return getDealsProvider();
}
