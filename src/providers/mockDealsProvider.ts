import type { DealItem, DealsProvider, DealsQuery } from './dealsProvider';
import { normalizePostalCode } from '@/src/utils/postalCode';

import foodBasics from '@/src/fixtures/deals/toronto/food-basics.json';
import freshco from '@/src/fixtures/deals/toronto/freshco.json';
import loblaws from '@/src/fixtures/deals/toronto/loblaws.json';
import metro from '@/src/fixtures/deals/toronto/metro.json';
import noFrills from '@/src/fixtures/deals/toronto/no-frills.json';
import rcSuperstore from '@/src/fixtures/deals/toronto/real-canadian-superstore.json';
import walmart from '@/src/fixtures/deals/toronto/walmart.json';
import costco from '@/src/fixtures/deals/toronto/costco.json';
import longos from '@/src/fixtures/deals/toronto/longos.json';

const allDeals: DealItem[] = [
  ...foodBasics,
  ...freshco,
  ...loblaws,
  ...metro,
  ...noFrills,
  ...rcSuperstore,
  ...walmart,
  ...costco,
  ...longos,
];

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

export const mockDealsProvider: DealsProvider = {
  async searchDeals(query: DealsQuery): Promise<DealItem[]> {
    const normalizedPostal = normalizePostalCode(query.postalCode);
    if (!normalizedPostal) {
      return [];
    }
    if (!normalizedPostal.startsWith('M')) {
      return [];
    }
    return applyFilters(allDeals, query);
  },
};
