import { getDealsProviderId, type DealsProvider } from './dealsProvider';
import { bestcoDealsProvider } from './bestcoDealsProvider';
import { flippDealsProvider } from './flippDealsProvider';
import { localScrapeDealsProvider } from './localScrapeDealsProvider';
import { mockDealsProvider } from './mockDealsProvider';

const providers: Record<string, DealsProvider> = {
  mock: mockDealsProvider,
  flipp: flippDealsProvider,
  bestco: bestcoDealsProvider,
  'local-scrape': localScrapeDealsProvider,
};

export function getDealsProvider(): DealsProvider {
  const providerId = getDealsProviderId();
  return providers[providerId] ?? mockDealsProvider;
}
