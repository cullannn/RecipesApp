import { getDealsProviderId, type DealsProvider } from './dealsProvider';
import { flippDealsProvider } from './flippDealsProvider';
import { mockDealsProvider } from './mockDealsProvider';

const providers: Record<string, DealsProvider> = {
  mock: mockDealsProvider,
  flipp: flippDealsProvider,
};

export function getDealsProvider(): DealsProvider {
  const providerId = getDealsProviderId();
  return providers[providerId] ?? mockDealsProvider;
}
