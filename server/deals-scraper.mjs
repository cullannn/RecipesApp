import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number.parseInt(process.env.DEALS_SERVER_PORT ?? '8790', 10);
const CACHE_DIR = path.join(process.cwd(), 'server', 'cache');
const CACHE_TTL_MS = 1000 * 60 * 60;

const storeList = [
  'No Frills',
  'Sobeys',
  'Longo\'s',
  'Walmart',
  'Metro',
  'FreshCo',
  'Costco',
  'Real Canadian Superstore',
  'Loblaws',
  'Farm Boy',
  'Sunny Supermarket',
  'WinCo Food Mart',
  'Galleria Supermarket',
  'H Mart',
  'Bestco Food Mart',
  'Foody Mart',
  'T&T Supermarket',
];

const FLYERTOWN_CONFIG = {
  baseUrl: 'https://www.flyertown.ca',
  locale: 'en',
  publisherId: 'flyertown',
};

const TNT_CONFIG = {
  baseUrl: 'https://www.tntsupermarket.com',
  defaultPostalPrefix: 'L3T',
  flyerCategoryPageSize: 100,
};

const FLYERTOWN_STORES = [
  {
    store: 'No Frills',
    searchPhrase: 'nofrills',
    stack: 'groceries',
    flyerName: 'nofrills-weeklyflyer',
  },
  {
    store: 'Sobeys',
    searchPhrase: 'sobeys',
    stack: 'groceries',
    flyerName: 'sobeys-sobeysontario',
  },
  {
    store: 'Longo\'s',
    searchPhrase: 'longos',
    stack: 'groceries',
    flyerName: 'longos-flyer',
  },
  {
    store: 'Walmart',
    searchPhrase: 'walmart',
    stack: 'groceries',
    flyerName: 'walmartcanada-groceryflyer',
  },
  {
    store: 'Metro',
    searchPhrase: 'metro',
    stack: 'groceries',
    flyerName: 'metro-flyer',
  },
  {
    store: 'FreshCo',
    searchPhrase: 'freshco',
    stack: 'groceries',
    flyerName: 'freshco-flyer',
  },
  {
    store: 'Costco',
    searchPhrase: 'costco',
    stack: 'groceries',
    flyerName: 'costcocanada-cpgroceryflyer',
  },
  {
    store: 'Real Canadian Superstore',
    searchPhrase: 'superstore',
    stack: 'groceries',
    flyerName: 'realcanadiansuperstore-flyer',
  },
  {
    store: 'Loblaws',
    searchPhrase: 'loblaws',
    stack: 'groceries',
    flyerName: 'loblaws-dryrun',
  },
  {
    store: 'Farm Boy',
    searchPhrase: 'farmboy',
    stack: 'groceries',
    flyerName: 'farmboy-flyerflipweekly',
  },
  {
    store: 'Sunny Supermarket',
    searchPhrase: 'sunny',
    stack: 'groceries',
    flyerName: 'sunnysupermarket-indexedweekly',
  },
  {
    store: 'WinCo Food Mart',
    searchPhrase: 'winco',
    stack: 'groceries',
    flyerName: 'wincofoodmart-indexedweekly',
    postalCode: 'L6C0H3',
  },
  {
    store: 'Galleria Supermarket',
    searchPhrase: 'galleria',
    stack: 'groceries',
    flyerName: 'galleriasupermarket-indexedweekly',
    postalCode: 'L6C0H3',
  },
  {
    store: 'H Mart',
    searchPhrase: 'hmart',
    stack: 'groceries',
    flyerName: 'hmartcanada-indexedweekly',
    postalCode: 'L6C0H3',
  },
  {
    store: 'Bestco Food Mart',
    searchPhrase: 'bestco',
    stack: 'groceries',
    flyerName: 'bestcofoodmart-indexedweekly',
    postalCode: 'L6C0H3',
  },
  {
    store: 'Foody Mart',
    searchPhrase: 'foody',
    stack: 'groceries',
    flyerName: 'foodymart-indexedweekly',
    postalCode: 'L6C0H3',
  },
];

const GROCERY_CATEGORIES = new Set([
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'deli',
  'pantry',
  'frozen',
  'snacks',
  'beverages',
]);

const CATEGORY_RULES = [
  { category: 'produce', match: /produce|vegetable|veggie|fruit/ },
  { category: 'seafood', match: /seafood|fish|shrimp|salmon|tuna/ },
  { category: 'meat', match: /meat|poultry|beef|pork|chicken|turkey|lamb/ },
  { category: 'dairy', match: /dairy|milk|cheese|yogurt|cream|butter|eggs?/ },
  { category: 'bakery', match: /bakery|bread|bagel|pastry|cake|muffin|donut/ },
  { category: 'deli', match: /deli|prepared|sandwich|charcuterie/ },
  {
    category: 'pantry',
    match: /pantry|grocery|dry|canned|pasta|rice|cereal|baking|spice|sauce|condiment|oil|flour|sugar/,
  },
  { category: 'frozen', match: /frozen|ice cream/ },
  { category: 'snacks', match: /snack|chips|cookies|crackers|candy|chocolate/ },
  { category: 'beverages', match: /beverage|drink|soda|juice|water|coffee|tea/ },
];

const NON_GROCERY_RULES = [
  /bedroom|living room|sofa|couch|mattress|furniture|decor|lighting|bedding|bath\b/,
  /tv|television|electronics|laptop|computer|phone|tablet|camera|headphones/,
  /clothing|apparel|jacket|shirt|pants|jeans|shoes|footwear|fashion|accessories/,
  /toy|game|lego|puzzle|book|stationery/,
  /hardware|tool|automotive|tire|car\b/,
  /patio|garden|outdoor|barbecue|bbq/,
  /kitchenware|cookware|appliance|maker|blender|mixer|kettle|toaster|microwave|oven|air\s*fryer|deep fryer|rice cooker|pressure cooker|slow cooker|utensil|cutlery|knife|skillet|wok|\bpan\b|\bpot\b/,
  /ipad|galaxy\s*tab|smartphone|cell\s*phone|phone\s*case|laptop|macbook|surface|chromebook|monitor|screen|speaker|earbuds|camera|gaming|console|drone|smart\s*watch|wearable|desk|chair|printer|harman\s?kardon|sony|roku|apple\s?watch|samsung\s?galaxy/,
];

const GENERIC_GROCERY_LABELS = new Set(['other', 'grocery', 'groceries', 'general', 'food', 'market']);

function nowIso() {
  return new Date().toISOString();
}

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizePostalCode(input) {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

function toPostalPrefix(postalCode) {
  if (!postalCode) {
    return TNT_CONFIG.defaultPostalPrefix;
  }
  const normalized = normalizePostalCode(postalCode);
  if (normalized.length >= 3) {
    return normalized.slice(0, 3);
  }
  return TNT_CONFIG.defaultPostalPrefix;
}

function parsePrice(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const match = String(value).replace(',', '.').match(/\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFlyertownNumericPrice(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value >= 100 && Number.isInteger(value) && value <= 10000) {
    return Number.parseFloat((value / 100).toFixed(2));
  }
  return value;
}

function parsePriceText(value) {
  if (!value) {
    return null;
  }
  const cleaned = String(value)
    .replace(/\b(now|was)\b/gi, '')
    .replace(/save\b.*/gi, '')
    .replace(/off\b.*/gi, '')
    .replace(/[$¢]/g, '')
    .trim();
  return parsePrice(cleaned);
}

function parseFlyertownPrice(item) {
  if (typeof item?.current_price === 'number' && Number.isFinite(item.current_price)) {
    return normalizeFlyertownNumericPrice(item.current_price);
  }
  const parsedPriceText = parsePriceText(item?.price_text);
  if (parsedPriceText !== null) {
    return parsedPriceText;
  }
  const description = String(item?.description ?? '');
  if (description && /[$¢]/.test(description) && !/save\b|off\b/i.test(description)) {
    const descriptionPrice = parsePriceText(description);
    if (descriptionPrice !== null) {
      return descriptionPrice;
    }
  }
  const unitMatch = description.match(/(\d+(?:\.\d+)?)\/(kg|lb)/i);
  if (unitMatch) {
    const value = Number.parseFloat(unitMatch[1]);
    if (Number.isFinite(value)) {
      if (unitMatch[2].toLowerCase() === 'kg') {
        const perLb = value / 2.20462262185;
        return Number.parseFloat(perLb.toFixed(2));
      }
      return value;
    }
  }
  return null;
}

function parseFlyertownWasPrice(item, currentPrice) {
  const candidates = [
    parsePriceText(item?.pre_price_text),
    parsePriceText(item?.sale_story),
  ].filter((value) => value !== null);
  if (candidates.length > 0) {
    return candidates[0];
  }
  const saleStory = String(item?.sale_story ?? '');
  const saveMatch = saleStory.match(/(?:save|off)\s*\$?(\d+(?:\.\d+)?)/i);
  if (saveMatch && Number.isFinite(currentPrice)) {
    const saveValue = Number.parseFloat(saveMatch[1]);
    if (Number.isFinite(saveValue) && saveValue > 0) {
      return Number.parseFloat((currentPrice + saveValue).toFixed(2));
    }
  }
  const percentMatch = saleStory.match(/(\d+(?:\.\d+)?)%/);
  if (percentMatch && Number.isFinite(currentPrice)) {
    const percent = Number.parseFloat(percentMatch[1]);
    if (Number.isFinite(percent) && percent > 0 && percent < 100) {
      return Number.parseFloat((currentPrice / (1 - percent / 100)).toFixed(2));
    }
  }
  return null;
}

function parseFlyertownPricing(item) {
  const price = parseFlyertownPrice(item);
  if (price === null) {
    return { price: null, wasPrice: null };
  }
  const wasPrice = parseFlyertownWasPrice(item, price);
  return { price, wasPrice };
}

function normalizeUnit(value) {
  if (!value) {
    return 'each';
  }
  const cleaned = String(value).trim().replace(/^\/+/, '');
  return cleaned || 'each';
}

function normalizeCategory(value, text) {
  const label = value ? String(value).trim().toLowerCase() : '';
  const content = text ? String(text).trim().toLowerCase() : '';
  const combined = `${label} ${content}`.trim();

  if (!combined) {
    return 'other';
  }

  for (const rule of NON_GROCERY_RULES) {
    if (rule.test(combined)) {
      return 'other';
    }
  }

  if (label.includes('meat') && label.includes('seafood')) {
    return 'meat';
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(combined)) {
      return rule.category;
    }
  }

  if (!label || GENERIC_GROCERY_LABELS.has(label)) {
    return 'pantry';
  }

  return 'other';
}

function isGroceryCategory(category) {
  if (!category) {
    return false;
  }
  return GROCERY_CATEGORIES.has(String(category).trim().toLowerCase());
}

function parseTntValidityRange(value) {
  if (!value) {
    return {};
  }
  const match = String(value).match(/(\d{4}\/\d{2}\/\d{2})\s*-\s*(\d{4}\/\d{2}\/\d{2})/);
  if (!match) {
    return {};
  }
  const toIso = (input) => input.replace(/\//g, '-');
  return {
    validFrom: toIso(match[1]),
    validTo: toIso(match[2]),
  };
}

async function scrapeLoblawsDeals() {
  return scrapeFlyertownDeals(FLYERTOWN_STORES.find((entry) => entry.store === 'Loblaws'));
}

async function fetchTntFlyerCategory(postalCode) {
  const url = new URL('/rest/V3/xmapi/get-store-eflyers', TNT_CONFIG.baseUrl);
  url.searchParams.set('postcode', toPostalPrefix(postalCode));
  url.searchParams.set('default', '1');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) {
    throw new Error(`T&T eflyer error ${res.status}: ${res.statusText}`);
  }
  const payload = await res.json();
  return payload?.data ?? null;
}

async function fetchTntFlyerItems(categoryId, pageSize, currentPage) {
  const query = `
    query ($id: Int!, $pageSize: Int!, $currentPage: Int!) {
      category(id: $id) {
        id
        name
        products(pageSize: $pageSize, currentPage: $currentPage) {
          items {
            name
            sku
            small_image {
              url
            }
            price_range {
              minimum_price {
                final_price {
                  value
                  currency
                }
                regular_price {
                  value
                  currency
                }
              }
            }
          }
          page_info {
            current_page
            total_pages
          }
          total_count
        }
      }
    }
  `;
  const res = await fetch(`${TNT_CONFIG.baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      query,
      variables: {
        id: Number(categoryId),
        pageSize,
        currentPage,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`T&T GraphQL error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function scrapeTntDeals(postalCode) {
  const eflyerData = await fetchTntFlyerCategory(postalCode);
  if (!eflyerData?.category_id) {
    return [];
  }
  const validity = eflyerData?.eflyer_list?.[0]?.validity;
  const { validFrom, validTo } = parseTntValidityRange(validity);
  const deals = [];
  const pageSize = TNT_CONFIG.flyerCategoryPageSize;
  let currentPage = 1;
  let totalPages = 1;
  while (currentPage <= totalPages) {
    const payload = await fetchTntFlyerItems(eflyerData.category_id, pageSize, currentPage);
    const products = payload?.data?.category?.products;
    if (!products) {
      break;
    }
    totalPages = Number(products.page_info?.total_pages ?? currentPage);
    for (const item of products.items ?? []) {
      const title = item?.name;
      const finalPrice = item?.price_range?.minimum_price?.final_price?.value;
      const regularPrice = item?.price_range?.minimum_price?.regular_price?.value;
      if (!title || finalPrice === null || finalPrice === undefined) {
        continue;
      }
      if (regularPrice === null || regularPrice === undefined || Number(finalPrice) >= Number(regularPrice)) {
        continue;
      }
      deals.push({
        id: `tnt-${eflyerData.category_id}-${item.sku ?? title}`,
        title: String(title).trim(),
        store: 'T&T Supermarket',
        price: Number(finalPrice),
        unit: 'each',
        category: normalizeCategory('', title),
        imageUrl: item?.small_image?.url || undefined,
        validFrom,
        validTo,
      });
    }
    currentPage += 1;
  }
  return deals;
}

function parseFlyertownSearch(html, desiredFlyerName) {
  const matches = Array.from(html.matchAll(/#!\/flyers\/([^?]+)\?[^"\s]*flyer_run_id=(\d+)/g));
  if (matches.length === 0) {
    return null;
  }
  if (desiredFlyerName) {
    const desired = matches.find((match) => match[1] === desiredFlyerName);
    if (desired) {
      return { flyerName: desired[1], flyerRunId: desired[2] };
    }
  }
  return { flyerName: matches[0][1], flyerRunId: matches[0][2] };
}

async function fetchFlyertownSearch(config) {
  const searchUrl = new URL('/d/p/flyertown/search', FLYERTOWN_CONFIG.baseUrl);
  searchUrl.searchParams.set('locale', FLYERTOWN_CONFIG.locale);
  searchUrl.searchParams.set('p', FLYERTOWN_CONFIG.publisherId);
  searchUrl.searchParams.set('stack', config.stack);
  searchUrl.searchParams.set('phrase', config.searchPhrase);
  if (config.postalCode) {
    searchUrl.searchParams.set('postal_code', config.postalCode);
  }
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`Flyertown search error ${searchRes.status}: ${searchRes.statusText}`);
  }
  const searchHtml = await searchRes.text();
  return parseFlyertownSearch(searchHtml, config.flyerName);
}

async function fetchFlyertownData(flyerName, flyerRunId) {
  const dataUrl = new URL(`/d/flyer_data/${flyerName}`, FLYERTOWN_CONFIG.baseUrl);
  dataUrl.searchParams.set('flyer_run_id', flyerRunId);
  const flyerRes = await fetch(dataUrl);
  if (!flyerRes.ok) {
    throw new Error(`Flyertown flyer error ${flyerRes.status}: ${flyerRes.statusText}`);
  }
  return flyerRes.json();
}

async function scrapeFlyertownDeals(config) {
  let flyerName = config.flyerName;
  let flyerRunId = null;
  const searchResult = await fetchFlyertownSearch(config);
  if (searchResult?.flyerName && searchResult?.flyerRunId) {
    flyerName = searchResult.flyerName;
    flyerRunId = searchResult.flyerRunId;
  }
  if (!flyerName || !flyerRunId) {
    return [];
  }
  const flyerData = await fetchFlyertownData(flyerName, flyerRunId);
  const deals = [];
  const seenIds = new Map();
  for (const item of flyerData?.items ?? []) {
    const title = item.display_name || item.name || item.description;
    const { price, wasPrice } = parseFlyertownPricing(item);
    if (!title || price === null) {
      continue;
    }
    const baseId = `${config.store.toLowerCase().replace(/\s+/g, '-')}-${flyerRunId}-${item.flyer_item_id ?? item.sku ?? title}`;
    const nextCount = (seenIds.get(baseId) ?? 0) + 1;
    seenIds.set(baseId, nextCount);
    const dealId = nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
    deals.push({
      id: dealId,
      title: String(title).trim(),
      store: config.store,
      price,
      wasPrice: wasPrice ?? undefined,
      unit: normalizeUnit(item.price_text || item.pre_price_text),
      category: normalizeCategory(item.category_names?.[0], title),
      imageUrl: item.large_image_url || item.x_large_image_url || undefined,
      validFrom: item.valid_from || flyerData?.valid_from || undefined,
      validTo: item.valid_to || flyerData?.valid_to || undefined,
    });
  }
  return deals;
}

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function loadCache(postalCode) {
  try {
    const filePath = path.join(CACHE_DIR, `${postalCode}.json`);
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function saveCache(postalCode, payload) {
  await ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${postalCode}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

async function scrapeFlyerDeals({ postalCode }) {
  const tasks = [
    { store: 'Loblaws', run: () => scrapeLoblawsDeals() },
    ...FLYERTOWN_STORES.filter((config) => config.store !== 'Loblaws').map((config) => ({
      store: config.store,
      run: () => scrapeFlyertownDeals(config),
    })),
    { store: 'T&T Supermarket', run: () => scrapeTntDeals(postalCode) },
  ];
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const deals = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deals.push(...result.value);
    } else {
      console.warn(`Deals scrape failed for ${tasks[index].store}:`, result.reason);
    }
  });
  const filteredDeals = deals.filter((deal) => isGroceryCategory(deal.category));
  return {
    postalCode,
    stores: storeList,
    fetchedAt: nowIso(),
    deals: filteredDeals,
  };
}

async function getDealsForPostal(postalCode) {
  const normalized = normalizePostalCode(postalCode);
  const cached = await loadCache(normalized);
  const now = Date.now();
  if (cached && cached.fetchedAt) {
    const age = now - Date.parse(cached.fetchedAt);
    if (Number.isFinite(age) && age < CACHE_TTL_MS) {
      return cached;
    }
  }
  const fresh = await scrapeFlyerDeals({ postalCode: normalized });
  await saveCache(normalized, fresh);
  return fresh;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/api/deals') {
    const postalCode = url.searchParams.get('postalCode');
    if (!postalCode) {
      sendJson(res, 400, { error: 'postalCode is required.' });
      return;
    }
    try {
      const data = await getDealsForPostal(postalCode);
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error.' });
    }
    return;
  }
  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Deals scraper server running on http://localhost:${PORT}`);
});
