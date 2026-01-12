import type { DealItem, DealsProvider, DealsQuery } from './dealsProvider';
import { isGtaPostalCode, normalizePostalCode } from '@/src/utils/postalCode';

import bestcoDeals from '@/src/fixtures/deals/toronto/bestco.json';

export const bestcoDealsProvider: DealsProvider = {
  async searchDeals(query: DealsQuery): Promise<DealItem[]> {
    const normalizedPostal = normalizePostalCode(query.postalCode);
    if (!normalizedPostal) {
      return [];
    }
    if (!isGtaPostalCode(normalizedPostal)) {
      return [];
    }
    return bestcoDeals;
  },
};
