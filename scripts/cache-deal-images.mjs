import 'dotenv/config';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const IMAGE_DIR = path.join(process.cwd(), 'server', 'cache', 'images');
const CACHE_PATH = path.join(process.cwd(), 'server', 'cache', 'images.json');
const IMAGE_BASE_URL =
  process.env.IMAGE_BASE_URL ??
  process.env.EXPO_PUBLIC_AI_BASE_URL ??
  'http://localhost:8787';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const FORCE = process.argv.includes('--force');
const FORCE_ALL = process.argv.includes('--force-all');
const ONLY_MISSING = process.argv.includes('--only-missing') || (!FORCE && !FORCE_ALL);
const VERBOSE = process.argv.includes('--verbose');
const CLEAR_UNSPLASH = process.argv.includes('--clear-unsplash');
const ONLY_TITLE_INDEX = process.argv.indexOf('--only-title');
const ONLY_TITLE = ONLY_TITLE_INDEX !== -1 ? process.argv[ONLY_TITLE_INDEX + 1] : '';
const LIMIT_INDEX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_INDEX !== -1 ? Number.parseInt(process.argv[LIMIT_INDEX + 1], 10) : Infinity;
const MAX_SIG_ATTEMPTS = 2;
const FETCH_TIMEOUT_MS = 12000;
const MAX_ITEM_TIME_MS = 12000;
const DEFAULT_FALLBACK_URL =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
const UNSPLASH_DOMAINS = ['images.unsplash.com', 'source.unsplash.com'];

async function readJson(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function ensureImageDir() {
  await mkdir(IMAGE_DIR, { recursive: true });
}

function normalizeTitle(title) {
  return String(title ?? '').trim().toLowerCase();
}

function buildImageKey(title) {
  return `deal:${normalizeTitle(title)}`;
}

function isUnsplashUrl(url) {
  if (!url) {
    return false;
  }
  return UNSPLASH_DOMAINS.some((domain) => url.includes(domain));
}

function isValidTitle(title) {
  const normalized = normalizeTitle(title);
  if (!normalized) {
    return false;
  }
  if (!/[a-z]/.test(normalized)) {
    return false;
  }
  if (/^was\s*:?(\s*\$)?[\d.]+/.test(normalized)) {
    return false;
  }
  if (/^\$[\d.]+/.test(normalized)) {
    return false;
  }
  if (normalized.includes('was:$') || normalized.includes('was $')) {
    return false;
  }
  const cleaned = normalized
    .replace(/\b(was|now|save|price|per|each)\b/g, '')
    .replace(/[\d$.,]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (cleaned.length < 3) {
    return false;
  }
  return true;
}

function hashBytes(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fileNameForHash(hash) {
  return `${hash.slice(0, 16)}.jpg`;
}

async function fetchImageBytes(query, sig) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error('Unsplash access key missing.');
  }
  const searchUrl = new URL('https://api.unsplash.com/search/photos');
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('per_page', '1');
  searchUrl.searchParams.set('orientation', 'landscape');
  searchUrl.searchParams.set('order_by', 'relevant');
  searchUrl.searchParams.set('page', String(sig + 1));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
        'User-Agent': 'DealChef/1.0 (cache script)',
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      throw new Error('Unsplash search failed: timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Unsplash search failed: ${response.status} ${errorText}`.trim()
    );
  }
  const data = await response.json();
  const first = data?.results?.[0];
  const imageUrl = first?.urls?.regular ?? first?.urls?.small ?? first?.urls?.raw;
  if (!imageUrl) {
    throw new Error('Unsplash search failed: no results.');
  }

  const imageController = new AbortController();
  const imageTimeoutId = setTimeout(() => imageController.abort(), FETCH_TIMEOUT_MS);
  try {
    const imageResponse = await fetch(imageUrl, { signal: imageController.signal });
    if (!imageResponse.ok) {
      throw new Error(`Unsplash image fetch failed: ${imageResponse.status}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      throw new Error('Unsplash image fetch failed: timeout');
    }
    throw error;
  } finally {
    clearTimeout(imageTimeoutId);
  }
}

function buildQueryVariants(title, category) {
  const base = normalizeTitle(title);
  const normalizedCategory = normalizeTitle(category);
  const variants = [base, `${base} food`, `${base} ingredient`, `${base} grocery`];
  if (normalizedCategory) {
    variants.push(`${base} ${normalizedCategory}`);
    variants.push(`${normalizedCategory} ${base}`);
  }
  if (/\bfillet\b/.test(base)) {
    variants.push(base.replace(/\bfillet\b/g, 'fish'));
    variants.push(`${base.replace(/\bfillet\b/g, 'fish')} seafood`);
    variants.push(`${base.replace(/\bfillet\b/g, 'fish')} fillet`);
  }
  if (/\btilapia\b/.test(base)) {
    variants.push('tilapia fish');
    variants.push('white fish fillet');
  }
  if (/\bchicken\b/.test(base)) {
    variants.push('chicken raw');
    variants.push('chicken meat');
  }
  if (/\bbeef\b/.test(base)) {
    variants.push('beef raw');
    variants.push('beef meat');
  }
  if (/\bpork\b/.test(base)) {
    variants.push('pork raw');
    variants.push('pork meat');
  }
  if (/\b(lettuce|spinach|cucumber|pepper|peppers|broccoli|carrot|carrots|zucchini|tomato|tomatoes|onion|onions)\b/.test(base)) {
    variants.push(`${base} produce`);
    variants.push('fresh vegetables');
  }
  if (/\b(cheese|yogurt|milk|eggs|butter)\b/.test(base)) {
    variants.push(`${base} dairy`);
    variants.push('dairy product');
  }
  if (/\b(beans|rice|pasta|spaghetti|couscous|quinoa|noodles|tortillas|bread)\b/.test(base)) {
    variants.push(`${base} pantry`);
    variants.push('grocery staples');
  }
  if (/\bfrozen\b/.test(base)) {
    variants.push(base.replace(/\bfrozen\b/g, '').trim());
    variants.push(`${base.replace(/\bfrozen\b/g, '').trim()} frozen`);
  }
  return Array.from(new Set(variants)).filter(Boolean);
}

async function collectDealItems() {
  const dealsDir = path.join(process.cwd(), 'src', 'fixtures', 'deals', 'toronto');
  const dirEntries = await readdir(dealsDir);
  const items = new Map();
  for (const file of dirEntries) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const raw = await readFile(path.join(dealsDir, file), 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      data.forEach((deal) => {
        if (deal?.title) {
          if (String(deal.category ?? '').toLowerCase() === 'household') {
            return;
          }
          const title = String(deal.title);
          const key = normalizeTitle(title);
          if (!items.has(key)) {
            items.set(key, { title, category: deal.category });
          }
        }
      });
    }
  }
  return Array.from(items.values());
}

async function cacheDealImages() {
  await ensureImageDir();
  const cache = await readJson(CACHE_PATH);
  const items = await collectDealItems();
  const seenHashes = new Set();
  let cleared = 0;
  let clearedUnsplash = 0;
  if (FORCE_ALL) {
    Object.keys(cache).forEach((key) => {
      if (key.startsWith('deal:')) {
        delete cache[key];
        cleared += 1;
      }
    });
  }
  if (CLEAR_UNSPLASH) {
    Object.keys(cache).forEach((key) => {
      if (key.startsWith('deal:') && isUnsplashUrl(cache[key])) {
        delete cache[key];
        clearedUnsplash += 1;
      }
    });
  }
  let fallbackHash = null;
  try {
    const fallbackBytes = await fetch(DEFAULT_FALLBACK_URL);
    const arrayBuffer = await fallbackBytes.arrayBuffer();
    fallbackHash = hashBytes(Buffer.from(arrayBuffer));
  } catch {
    fallbackHash = null;
  }

  const skipTitles = new Set();
  let processed = 0;
  for (const item of items) {
    if (processed >= LIMIT) {
      break;
    }
    const { title, category } = item;
    if (ONLY_TITLE && normalizeTitle(title) !== normalizeTitle(ONLY_TITLE)) {
      continue;
    }
    if (!isValidTitle(title)) {
      console.warn(`Skipping invalid deal title "${title}".`);
      continue;
    }
    if (skipTitles.has(normalizeTitle(title))) {
      console.warn(`Skipping blocked deal title "${title}".`);
      continue;
    }
    console.log(`Fetching deal image for "${title}"...`);
    const itemStart = Date.now();
    const key = buildImageKey(title);
    if (cache[key] && cache[key].includes('/api/image-file/')) {
      continue;
    }
    if (ONLY_MISSING && cache[key] && cache[key] !== DEFAULT_FALLBACK_URL && !isUnsplashUrl(cache[key])) {
      continue;
    }
    if (!FORCE && cache[key]) {
      continue;
    }
    let saved = false;
    const variants = buildQueryVariants(title, category);
    for (const variant of variants) {
      for (let sig = 0; sig < MAX_SIG_ATTEMPTS; sig += 1) {
        if (Date.now() - itemStart > MAX_ITEM_TIME_MS) {
          console.warn(`Skipping "${title}" after ${MAX_ITEM_TIME_MS}ms.`);
          sig = MAX_SIG_ATTEMPTS;
          break;
        }
        try {
          if (VERBOSE) {
            console.log(`  Attempt query="${variant}" sig=${sig}`);
          }
          const bytes = await fetchImageBytes(variant, sig);
          const hash = hashBytes(bytes);
          if (fallbackHash && hash === fallbackHash) {
            continue;
          }
          if (seenHashes.has(hash)) {
            continue;
          }
          const fileName = fileNameForHash(hash);
          const filePath = path.join(IMAGE_DIR, fileName);
          await writeFile(filePath, bytes);
          const imageUrl = `${IMAGE_BASE_URL}/api/image-file/${fileName}`;
          cache[key] = imageUrl;
          seenHashes.add(hash);
          saved = true;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('503')) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          console.warn(`Fetch failed for ${variant} (sig ${sig}): ${message}`);
          break;
        }
      }
      if (saved) {
        break;
      }
    }
    if (!saved) {
      console.warn(`No unique image found for ${title}.`);
    }
    processed += 1;
  }

  if (FORCE_ALL) {
    console.log(`Cleared ${cleared} deal cache entries.`);
  }
  if (CLEAR_UNSPLASH) {
    console.log(`Cleared ${clearedUnsplash} Unsplash deal entries.`);
  }
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8');
}

cacheDealImages().catch((error) => {
  console.error(error);
  process.exit(1);
});
