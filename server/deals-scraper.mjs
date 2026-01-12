import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number.parseInt(process.env.DEALS_SERVER_PORT ?? '8790', 10);
const CACHE_DIR = path.join(process.cwd(), 'server', 'cache');
const CACHE_TTL_MS = 1000 * 60 * 60;

const storeList = [
  'No Frills',
  'Loblaws',
  'Real Canadian Superstore',
  'Metro',
  'FreshCo',
  'Food Basics',
  'Walmart',
  'Costco',
  'Longo\'s',
];

function nowIso() {
  return new Date().toISOString();
}

function normalizePostalCode(input) {
  return input.trim().toUpperCase().replace(/\s+/g, '');
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
  // TODO: Replace with Flipp/aggregator integration.
  const mockPath = path.join(process.cwd(), 'src', 'fixtures', 'deals', 'toronto');
  const files = [
    'no-frills.json',
    'loblaws.json',
    'real-canadian-superstore.json',
    'metro.json',
    'freshco.json',
    'food-basics.json',
    'walmart.json',
    'costco.json',
    'longos.json',
  ];
  const deals = [];
  for (const file of files) {
    try {
      const raw = await readFile(path.join(mockPath, file), 'utf-8');
      deals.push(...JSON.parse(raw));
    } catch (error) {
      // Ignore missing fixtures.
    }
  }
  return {
    postalCode,
    stores: storeList,
    fetchedAt: nowIso(),
    deals,
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
