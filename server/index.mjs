import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const OPENAI_RECIPE_MODEL = process.env.OPENAI_RECIPE_MODEL ?? OPENAI_MODEL ?? 'gpt-5-mini';
const OPENAI_TITLE_MODEL = process.env.OPENAI_TITLE_MODEL ?? 'gpt-5-nano';
const OPENAI_NUTRITION_MODEL = process.env.OPENAI_NUTRITION_MODEL ?? 'gpt-5-nano';
const OPENAI_IMAGE_PROMPT_MODEL = process.env.OPENAI_IMAGE_PROMPT_MODEL ?? 'gpt-5-nano';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const CACHE_DIR = path.join(process.cwd(), 'server', 'cache');
const IMAGE_CACHE_PATH = path.join(CACHE_DIR, 'images.json');
const IMAGE_FILES_DIR = path.join(CACHE_DIR, 'images');
const OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? '90000', 10);
const OPENAI_IMAGE_TIMEOUT_MS = Number.parseInt(
  process.env.OPENAI_IMAGE_TIMEOUT_MS ?? '60000',
  10
);
const UNSPLASH_TIMEOUT_MS = Number.parseInt(process.env.UNSPLASH_TIMEOUT_MS ?? '8000', 10);
const UNSPLASH_FALLBACK_URL =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
const OPENAI_IMAGE_FAILURE_TTL_MS = Number.parseInt(
  process.env.OPENAI_IMAGE_FAILURE_TTL_MS ?? '120000',
  10
);
const OPENAI_IMAGE_MIN_INTERVAL_MS = Number.parseInt(
  process.env.OPENAI_IMAGE_MIN_INTERVAL_MS ?? '12000',
  10
);
const OPENAI_IMAGE_RATE_LIMIT_BACKOFF_MS = Number.parseInt(
  process.env.OPENAI_IMAGE_RATE_LIMIT_BACKOFF_MS ?? '15000',
  10
);

const openAiImageFailureCache = new Map();
const openAiImageInFlight = new Set();
const openAiImageQueue = [];
let openAiImageQueueActive = false;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY.');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body);
}

function buildPrompt(input) {
  const count = Number.isFinite(input.count) && input.count > 0 ? input.count : 5;
  const cuisines =
    input.cuisines.length > 0
      ? `All recipes must be ${input.cuisines.join(
          ', '
        )} cuisine. Include at least one of those cuisines in the recipe title and tags array.`
      : '';
  return [
    `Generate ${count} distinct weeknight recipes for a home cook in Toronto.`,
    cuisines,
    `Prompt: ${input.prompt}`,
    'Return JSON only with shape {"recipes":[...]} where each recipe has:',
    'title, servings (number), cookTimeMins (number), tags (array), ingredients (array of {name, quantity, unit, category}), steps (array).',
    'Keep ingredients realistic for Canadian grocery stores.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function ensureImageFilesDir() {
  await mkdir(IMAGE_FILES_DIR, { recursive: true });
}

let imageCacheData = null;
let imageCacheLoadPromise = null;
let imageCacheWritePromise = Promise.resolve();

async function loadImageCacheFromDisk() {
  try {
    const raw = await readFile(IMAGE_CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function getImageCache() {
  if (imageCacheData) {
    return imageCacheData;
  }
  if (!imageCacheLoadPromise) {
    imageCacheLoadPromise = (async () => {
      imageCacheData = await loadImageCacheFromDisk();
      return imageCacheData;
    })();
  }
  return imageCacheLoadPromise;
}

async function saveImageCache(cache) {
  await ensureCacheDir();
  imageCacheData = cache;
  imageCacheWritePromise = imageCacheWritePromise
    .then(() => writeFile(IMAGE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8'))
    .catch(() => {});
  return imageCacheWritePromise;
}

function buildImageFileName(query) {
  const hash = crypto.createHash('sha256').update(query).digest('hex').slice(0, 16);
  return `${hash}.png`;
}

async function writeImageFile(query, b64) {
  await ensureImageFilesDir();
  const fileName = buildImageFileName(query);
  const filePath = path.join(IMAGE_FILES_DIR, fileName);
  const buffer = Buffer.from(b64, 'base64');
  await writeFile(filePath, buffer);
  return fileName;
}

async function convertDataUrlToFile(query, dataUrl) {
  const marker = 'base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  const b64 = dataUrl.slice(idx + marker.length);
  if (!b64) {
    return null;
  }
  return writeImageFile(query, b64);
}

function logImageError(context, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[ai:image] ${context} failed: ${message}`);
}

function buildImageQuery(input) {
  const cleaned = String(input ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bpack\b/g, ' ')
    .replace(/\b(lbs?|oz|g|kg|ml|l|pc|pcs|count)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'food';
}

async function resolveUnsplashImage(query) {
  const cleanedQuery = buildImageQuery(query);
  const sourceUrl = `https://source.unsplash.com/featured/900x700?${encodeURIComponent(
    cleanedQuery
  )}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UNSPLASH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, { signal: controller.signal, redirect: 'manual' });
    const location = response.headers.get('location');
    const resolved = location ? new URL(location, sourceUrl).toString() : response.url || sourceUrl;
    if (!resolved || resolved.includes('source.unsplash.com')) {
      return UNSPLASH_FALLBACK_URL;
    }
    if (resolved.includes('images.unsplash.com')) {
      const url = new URL(resolved);
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', '900');
      url.searchParams.set('q', '80');
      return url.toString();
    }
    return resolved;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return UNSPLASH_FALLBACK_URL;
    }
    return UNSPLASH_FALLBACK_URL;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAiChat({
  prompt,
  model,
  temperature = 1,
  responseFormat = 'json_object',
  systemContent = 'You are a helpful culinary assistant that returns only valid JSON.',
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: responseFormat },
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw new Error('OpenAI chat timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat failed: ${response.status} ${errorText}`);
  }
  return response.json();
}

async function polishImagePrompt(prompt) {
  if (!OPENAI_API_KEY || !OPENAI_IMAGE_PROMPT_MODEL) {
    return prompt;
  }
  try {
    const chat = await callOpenAiChat({
      prompt: JSON.stringify({
        task: 'polish_image_prompt',
        input: prompt,
        rules: [
          'Return a concise, vivid food photo prompt.',
          'Keep it under 30 words.',
          'No camera specs, no brands, no extra formatting.',
          'Output JSON only: {"prompt": "..."}',
        ],
      }),
      model: OPENAI_IMAGE_PROMPT_MODEL,
      temperature: 0.4,
      systemContent: 'You refine prompts for food photography. Return only JSON.',
    });
    const content = chat?.choices?.[0]?.message?.content;
    if (!content) {
      return prompt;
    }
    const parsed = JSON.parse(content);
    const refined = String(parsed?.prompt ?? '').trim();
    return refined || prompt;
  } catch (error) {
    return prompt;
  }
}

async function callOpenAiImage(prompt, timeoutMs = OPENAI_IMAGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: '1024x1024',
      }),
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw new Error('OpenAI image timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI image failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  const first = data?.data?.[0];
  if (first?.b64_json) {
    return { kind: 'b64', data: first.b64_json };
  }
  if (first?.url) {
    return { kind: 'url', data: first.url };
  }
  return null;
}

function toSafeNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function buildRecipeId(title, index) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `ai-${slug || 'recipe'}-${index + 1}`;
}

function normalizeIngredient(input) {
  return {
    name: String(input.name ?? '').trim(),
    quantity:
      typeof input.quantity === 'number' || typeof input.quantity === 'string'
        ? input.quantity
        : '',
    unit: String(input.unit ?? '').trim(),
    category: String(input.category ?? 'Other'),
  };
}

function coerceRecipes(payload) {
  const items = Array.isArray(payload) ? payload : payload?.recipes;
  if (!Array.isArray(items)) {
    return [];
  }
  const recipes = [];
  items.forEach((item, index) => {
    const title = String(item?.title ?? '').trim();
    if (!title) {
      return;
    }
    recipes.push({
      id: buildRecipeId(title, index),
      title,
      servings: toSafeNumber(item?.servings, 2),
      cookTimeMins: toSafeNumber(item?.cookTimeMins, 30),
      tags: Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag)) : [],
      ingredients: Array.isArray(item?.ingredients)
        ? item.ingredients.map((ingredient) => normalizeIngredient(ingredient))
        : [],
      steps: Array.isArray(item?.steps) ? item.steps.map((step) => String(step)) : [],
    });
  });
  return recipes;
}

function filterByCuisine(recipes, cuisines) {
  if (!Array.isArray(cuisines) || cuisines.length === 0) {
    return recipes;
  }
  const normalized = cuisines.map((cuisine) => cuisine.toLowerCase());
  return recipes.filter((recipe) => {
    const tags = Array.isArray(recipe.tags) ? recipe.tags.map((tag) => String(tag).toLowerCase()) : [];
    const title = String(recipe.title ?? '').toLowerCase();
    return normalized.some((cuisine) => tags.includes(cuisine) || title.includes(cuisine));
  });
}

async function attachRecipeImages(recipes, baseUrl) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return recipes;
  }
  const cache = await getImageCache();
  let cacheChanged = false;
  for (const recipe of recipes) {
    if (!recipe || recipe.imageUrl) {
      continue;
    }
    const title = String(recipe.title ?? '').trim();
    const normalized = title.toLowerCase();
    if (!normalized) {
      continue;
    }
    let cachedUrl = cache[normalized];
    if (typeof cachedUrl === 'string' && cachedUrl.startsWith('data:image/')) {
      const fileName = await convertDataUrlToFile(normalized, cachedUrl);
      if (fileName) {
        const fileUrl = `${baseUrl}/api/image-file/${fileName}`;
        cache[normalized] = fileUrl;
        cacheChanged = true;
        cachedUrl = fileUrl;
      }
    }
    if (
      typeof cachedUrl === 'string' &&
      cachedUrl &&
      !cachedUrl.includes('source.unsplash.com')
    ) {
      recipe.imageUrl = cachedUrl;
      continue;
    }
    let imageUrl;
    if (OPENAI_API_KEY) {
      try {
        const prompt = await polishImagePrompt(`High-quality food photo of ${title}.`);
        const generated = await callOpenAiImage(prompt);
        if (generated?.kind === 'url') {
          imageUrl = generated.data;
        } else if (generated?.kind === 'b64') {
          const fileName = await writeImageFile(normalized, generated.data);
          imageUrl = `${baseUrl}/api/image-file/${fileName}`;
        }
      } catch (error) {
        logImageError(`recipe "${title}"`, error);
        // Fall back to Unsplash on OpenAI failures.
      }
    }
    if (!imageUrl) {
      imageUrl = await resolveUnsplashImage(title);
    }
    if (imageUrl) {
      recipe.imageUrl = imageUrl;
      cache[normalized] = imageUrl;
      cacheChanged = true;
    }
  }
  if (cacheChanged) {
    await saveImageCache(cache);
  }
  return recipes;
}

async function scheduleOpenAiImage({ cacheKey, normalized, query, baseUrl }) {
  if (!OPENAI_API_KEY) {
    return;
  }
  if (openAiImageInFlight.has(cacheKey)) {
    return;
  }
  const lastFailure = openAiImageFailureCache.get(cacheKey);
  if (lastFailure && Date.now() - lastFailure < OPENAI_IMAGE_FAILURE_TTL_MS) {
    return;
  }
  openAiImageInFlight.add(cacheKey);
  openAiImageQueue.push({ cacheKey, normalized, query, baseUrl });
  processOpenAiImageQueue();
}

async function processOpenAiImageQueue() {
  if (openAiImageQueueActive) {
    return;
  }
  openAiImageQueueActive = true;
  while (openAiImageQueue.length > 0) {
    const task = openAiImageQueue.shift();
    if (!task) {
      continue;
    }
    await attemptOpenAiImage(task);
    if (openAiImageQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, OPENAI_IMAGE_MIN_INTERVAL_MS));
    }
  }
  openAiImageQueueActive = false;
}

async function attemptOpenAiImage({ cacheKey, normalized, query, baseUrl }) {
  try {
    const prompt = await polishImagePrompt(`High-quality food photo of ${buildImageQuery(query)}.`);
    const generated = await callOpenAiImage(prompt);
    if (!generated) {
      return;
    }
    const cache = await getImageCache();
    let imageUrl;
    if (generated.kind === 'url') {
      imageUrl = generated.data;
    } else if (generated.kind === 'b64') {
      const fileName = await writeImageFile(normalized, generated.data);
      imageUrl = `${baseUrl}/api/image-file/${fileName}`;
    }
    if (imageUrl) {
      cache[cacheKey] = imageUrl;
      await saveImageCache(cache);
    }
  } catch (error) {
    openAiImageFailureCache.set(cacheKey, Date.now());
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('rate limit')) {
      setTimeout(() => {
        openAiImageInFlight.delete(cacheKey);
        scheduleOpenAiImage({ cacheKey, normalized, query, baseUrl });
      }, OPENAI_IMAGE_RATE_LIMIT_BACKOFF_MS);
      return;
    }
    logImageError(`async "${query}"`, error);
  } finally {
    openAiImageInFlight.delete(cacheKey);
  }
}

async function handleRecipes(req, res, body) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 500, { error: 'Missing OPENAI_API_KEY.' });
    return;
  }
  const requestStart = Date.now();
  const data = JSON.parse(body || '{}');
  const prompt = String(data.prompt ?? '').trim();
  const cuisines = Array.isArray(data.cuisines) ? data.cuisines.map((c) => String(c)) : [];
  const count = Number.isFinite(data.count) ? data.count : undefined;
  if (!prompt) {
    sendJson(res, 400, { error: 'Prompt is required.' });
    return;
  }

  console.log(`[ai:recipes] request start prompt="${prompt.slice(0, 80)}" cuisines=${cuisines.join(',') || 'none'}`);
  const chat = await callOpenAiChat({
    prompt: buildPrompt({ prompt, cuisines, count }),
    model: OPENAI_RECIPE_MODEL,
  });
  const content = chat?.choices?.[0]?.message?.content;
  if (!content) {
    sendJson(res, 500, { error: 'OpenAI response missing content.' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to parse OpenAI JSON.' });
    return;
  }

  const coercedRecipes = coerceRecipes(parsed);
  let recipes = filterByCuisine(coercedRecipes, cuisines);
  let cuisineFallback = false;
  if (cuisines.length > 0 && recipes.length === 0) {
    recipes = coercedRecipes;
    cuisineFallback = true;
  }
  console.log(
    `[ai:recipes] success recipes=${recipes.length} cuisineFallback=${cuisineFallback} durationMs=${Date.now() - requestStart}`
  );
  sendJson(res, 200, { recipes, cuisineFallback });
}

async function handleImage(req, res, query, kind) {
  if (!query) {
    sendJson(res, 400, { error: 'query is required.' });
    return;
  }
  const normalized = query.toLowerCase().trim();
  const cacheKey = kind ? `${kind}:${normalized}` : normalized;
  const cache = await getImageCache();
  if (cache[cacheKey]) {
    let cachedUrl = cache[cacheKey];
    if (typeof cachedUrl === 'string' && cachedUrl.includes('/api/image-file/')) {
      try {
        const url = new URL(cachedUrl);
        const requestHost = req.headers.host ?? 'localhost';
        if (url.host !== requestHost) {
          url.host = requestHost;
          cachedUrl = url.toString();
          cache[cacheKey] = cachedUrl;
          await saveImageCache(cache);
        }
      } catch (error) {
        // Leave cached URL as-is if it can't be parsed.
      }
    }
    if (typeof cachedUrl === 'string' && cachedUrl.startsWith('data:image/')) {
      const fileName = await convertDataUrlToFile(normalized, cachedUrl);
      if (fileName) {
        const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
        const fileUrl = `${baseUrl}/api/image-file/${fileName}`;
        cache[cacheKey] = fileUrl;
        await saveImageCache(cache);
        cachedUrl = fileUrl;
      }
    }
    if (typeof cachedUrl === 'string' && cachedUrl.includes('source.unsplash.com')) {
      const resolved = await resolveUnsplashImage(normalized);
      if (resolved && resolved !== cachedUrl) {
        cache[cacheKey] = resolved;
        await saveImageCache(cache);
        cachedUrl = resolved;
      }
    }
    if (cachedUrl === UNSPLASH_FALLBACK_URL) {
      const resolved = await resolveUnsplashImage(normalized);
      if (resolved && resolved !== cachedUrl) {
        cache[cacheKey] = resolved;
        await saveImageCache(cache);
        cachedUrl = resolved;
      }
    }
    if (
      kind !== 'deal' &&
      OPENAI_API_KEY &&
      typeof cachedUrl === 'string' &&
      (!cachedUrl.includes('/api/image-file/') || cachedUrl === UNSPLASH_FALLBACK_URL)
    ) {
      const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
      scheduleOpenAiImage({ cacheKey, normalized, query, baseUrl });
    }
    sendJson(res, 200, { imageUrl: cachedUrl });
    return;
  }

  let imageUrl;
  if (kind !== 'deal' && OPENAI_API_KEY) {
    const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
    scheduleOpenAiImage({ cacheKey, normalized, query, baseUrl });
  }
  if (!imageUrl) {
    imageUrl = await resolveUnsplashImage(normalized);
  }

  if (!imageUrl) {
    sendJson(res, 404, { error: 'No image found.' });
    return;
  }

  cache[cacheKey] = imageUrl;
  await saveImageCache(cache);
  sendJson(res, 200, { imageUrl });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/ai/recipes') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on('end', async () => {
      try {
        await handleRecipes(req, res, body);
      } catch (error) {
        console.error('[ai:recipes] failed', error);
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error.' });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/images')) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const query = url.searchParams.get('query');
    const kind = url.searchParams.get('kind') ?? undefined;
    try {
      await handleImage(req, res, query, kind);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error.' });
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/image-file/')) {
    const fileName = path.basename(req.url.replace('/api/image-file/', ''));
    const filePath = path.join(IMAGE_FILES_DIR, fileName);
    try {
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } catch (error) {
      sendJson(res, 404, { error: 'Image not found.' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI proxy running on http://localhost:${PORT}`);
});
