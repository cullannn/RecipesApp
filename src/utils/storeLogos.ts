const storeLogoMap: Record<string, number | string> = {
  'no frills': require('../../assets/logos/official/no-frills.png'),
  loblaws: require('../../assets/logos/official/loblaws.png'),
  'real canadian superstore': require('../../assets/logos/official/real-canadian-superstore.png'),
  metro: require('../../assets/logos/official/metro.png'),
  freshco: require('../../assets/logos/official/freshco.png'),
  'food basics': require('../../assets/logos/official/food-basics.png'),
  walmart: require('../../assets/logos/official/walmart.png'),
  costco: require('../../assets/logos/official/costco.png'),
  longos: require('../../assets/logos/official/longos.png'),
  bestco: require('../../assets/logos/official/bestco.png'),
  sobeys: require('../../assets/logos/official/sobeys.png'),
  'farm boy': require('../../assets/logos/official/farm-boy.png'),
  'sunny supermarket': require('../../assets/logos/official/sunny-supermarket.png'),
  'winco food mart': require('../../assets/logos/official/winco-food-mart.png'),
  'galleria supermarket': require('../../assets/logos/official/galleria-supermarket.png'),
  'h mart': require('../../assets/logos/official/h-mart.png'),
  'bestco food mart': require('../../assets/logos/official/bestco-food-mart.png'),
  'foody mart': require('../../assets/logos/official/foody-mart.png'),
  foody: require('../../assets/logos/official/foody-mart.png'),
  't t supermarket': require('../../assets/logos/official/tnt.png'),
  ttsupermarket: require('../../assets/logos/official/tnt.png'),
  't t': require('../../assets/logos/official/tnt.png'),
};

export const normalizeStoreName = (store: string) =>
  store.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const storeDisplayNameMap: Record<string, string> = {
  't t supermarket': 'T&T',
  'bestco food mart': 'Bestco',
  'galleria supermarket': 'Galleria',
  'real canadian superstore': 'RCSS',
  'sunny supermarket': 'Sunny',
  'winco food mart': 'WinCo',
  'foody mart': 'Foody',
  foody: 'Foody',
};

const ignoreKeywords = ['wok'];

export const shouldIgnoreStore = (store: string) => {
  const normalized = normalizeStoreName(store);
  if (!normalized) {
    return false;
  }
  return ignoreKeywords.some((keyword) => normalized.includes(keyword));
};

export const getStoreDisplayName = (store: string) => {
  if (!store) {
    return store;
  }
  const normalized = normalizeStoreName(store);
  return storeDisplayNameMap[normalized] ?? store;
};

export const resolveStoreLogo = (store: string) => {
  const normalized = normalizeStoreName(store);
  const candidates = [
    normalized,
    normalized.replace(/\s+/g, ''),
    normalized.replace('fresh foods', '').trim(),
    normalized.replace('real canadian ', '').trim(),
  ].filter(Boolean);
  for (const key of candidates) {
    const logo = storeLogoMap[key];
    if (logo) {
      return logo;
    }
  }
  return undefined;
};
