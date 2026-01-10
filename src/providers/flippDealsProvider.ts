import type { DealItem, DealsProvider, DealsQuery } from './dealsProvider';

export const flippDealsProvider: DealsProvider = {
  async searchDeals(_query: DealsQuery): Promise<DealItem[]> {
    // TODO: Implement Flipp provider after MVP, behind feature flag.
    return [];
  },
};
