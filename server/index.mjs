import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import 'dotenv/config';
import sharp from 'sharp';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const OPENAI_RECIPE_MODEL = process.env.OPENAI_RECIPE_MODEL ?? OPENAI_MODEL ?? 'gpt-5-nano';
const OPENAI_IMAGE_PROMPT_MODEL = process.env.OPENAI_IMAGE_PROMPT_MODEL ?? 'gpt-5-nano';
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const NEBIUS_IMAGE_BASE_URL =
  process.env.NEBIUS_IMAGE_BASE_URL ?? 'https://api.tokenfactory.nebius.com/v1';
const NEBIUS_IMAGE_MODEL =
  process.env.NEBIUS_IMAGE_MODEL ?? 'black-forest-labs/flux-schnell';
const NEBIUS_IMAGE_SIZE = process.env.NEBIUS_IMAGE_SIZE;
const NEBIUS_TEXT_BASE_URL =
  process.env.NEBIUS_TEXT_BASE_URL ?? 'https://api.tokenfactory.nebius.com/v1';
const NEBIUS_RECIPE_MODEL =
  process.env.NEBIUS_RECIPE_MODEL ?? 'Qwen/Qwen3-30B-A3B-Instruct-2507';
const RECIPE_PROVIDER = (process.env.RECIPE_PROVIDER ?? 'nebius').toLowerCase();
const OPENAI_IMAGE_MAX_DIM = Number.parseInt(process.env.OPENAI_IMAGE_MAX_DIM ?? '512', 10);
const OPENAI_IMAGE_QUALITY = Number.parseInt(process.env.OPENAI_IMAGE_QUALITY ?? '80', 10);
const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const CACHE_DIR = path.join(process.cwd(), 'server', 'cache');
const IMAGE_CACHE_PATH = path.join(CACHE_DIR, 'images.json');
const IMAGE_FILES_DIR = path.join(CACHE_DIR, 'images');
const RECIPE_CACHE_PATH = path.join(CACHE_DIR, 'recipes.json');
const OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? '90000', 10);
const OPENAI_IMAGE_TIMEOUT_MS = Number.parseInt(
  process.env.OPENAI_IMAGE_TIMEOUT_MS ?? '120000',
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
if (!NEBIUS_API_KEY) {
  console.error('Missing NEBIUS_API_KEY.');
}
console.log(`[ai:image] provider=nebius base=${NEBIUS_IMAGE_BASE_URL} model=${NEBIUS_IMAGE_MODEL}`);
console.log(
  `[ai:recipes] provider=${RECIPE_PROVIDER} ` +
    (RECIPE_PROVIDER === 'openai'
      ? `model=${OPENAI_RECIPE_MODEL}`
      : `base=${NEBIUS_TEXT_BASE_URL} model=${NEBIUS_RECIPE_MODEL}`)
);

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
  const servings =
    Number.isFinite(input.servings) && input.servings > 0 ? Math.round(input.servings) : null;
  const maxCookTimeMins =
    Number.isFinite(input.maxCookTimeMins) && input.maxCookTimeMins > 0
      ? Math.round(input.maxCookTimeMins)
      : null;
  const dietaryPreferences = Array.isArray(input.dietaryPreferences)
    ? input.dietaryPreferences.filter(
        (pref) => String(pref).trim() && String(pref).toLowerCase() !== 'none'
      )
    : [];
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.filter((item) => String(item).trim())
    : typeof input.allergies === 'string'
      ? input.allergies
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const cuisines =
    input.cuisines.length > 0
      ? `All recipes must be ${input.cuisines.join(
          ', '
        )} cuisine. Include at least one of those cuisines in the recipe title and tags array.`
      : '';
  const dietaryLine =
    dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(
          ', '
        )}. Every recipe must comply and include these tags.`
      : '';
  const allergyLine =
    allergies.length > 0
      ? `Allergens to avoid: ${allergies.join(
          ', '
        )}. Do not include these ingredients or derivatives.`
      : '';
  const avoidTitles = Array.isArray(input.avoidTitles)
    ? input.avoidTitles.map((title) => String(title).trim()).filter(Boolean)
    : [];
  const avoidLine =
    avoidTitles.length > 0
      ? `Do not repeat these recipe titles: ${avoidTitles.join('; ')}.`
      : '';
  return [
    `Generate ${count} distinct weeknight recipes for a home cook in Toronto.`,
    cuisines,
    `Prompt: ${input.prompt}`,
    servings ? `Servings must be exactly ${servings} for every recipe.` : '',
    maxCookTimeMins ? `Cook time must be ${maxCookTimeMins} minutes or less.` : '',
    dietaryLine,
    allergyLine,
    avoidLine,
    'Each recipe must include a clear "interesting twist" (e.g., a unique flavor pairing, technique, or ingredient swap).',
    'Favor bold, unexpected flavor pairings that still feel delicious and balanced; aim for a "wow" factor.',
    'Keep each recipe concise: 8-12 ingredients and 5-7 steps maximum.',
    'Return JSON only with shape {"recipes":[...]} where each recipe has:',
    'title, servings (number), cookTimeMins (number), tags (array), ingredients (array of {name, quantity, unit, category}), steps (array).',
    'Keep ingredients realistic for Canadian grocery stores.',
  ]
    .filter(Boolean)
    .join(' ');
}

function nowIso() {
  return new Date().toISOString();
}

function extractJsonBlock(text) {
  if (typeof text !== 'string') {
    return null;
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return text.slice(first, last + 1);
}

function sanitizeJsonText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/\u2028|\u2029/g, ' ')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function repairJsonText(text) {
  const sanitized = sanitizeJsonText(text);
  if (!sanitized) {
    return '';
  }
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;
  for (const char of sanitized) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      openBraces += 1;
    } else if (char === '}') {
      openBraces = Math.max(0, openBraces - 1);
    } else if (char === '[') {
      openBrackets += 1;
    } else if (char === ']') {
      openBrackets = Math.max(0, openBrackets - 1);
    }
  }
  const closeString = inString ? '"' : '';
  return sanitized + closeString + ']'.repeat(openBrackets) + '}'.repeat(openBraces);
}

function tryParseJson(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryParseTruncatedJson(text) {
  const candidate = extractJsonBlock(text) ?? text;
  if (!candidate) {
    return null;
  }
  const indices = [];
  for (let i = 0; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (char === '}' || char === ']') {
      indices.push(i);
    }
  }
  let attempts = 0;
  for (let i = indices.length - 1; i >= 0 && attempts < 30; i -= 1) {
    const cut = candidate.slice(0, indices[i] + 1);
    const repaired = repairJsonText(cut);
    const parsed = tryParseJson(repaired);
    if (parsed) {
      return parsed;
    }
    attempts += 1;
  }
  return null;
}

function parseJsonWithRepair(text) {
  const extracted = extractJsonBlock(text) ?? text;
  const repaired = repairJsonText(extracted);
  if (!repaired) {
    return null;
  }
  const direct = tryParseJson(repaired);
  if (direct) {
    return direct;
  }
  return tryParseTruncatedJson(extracted);
}

function extractRecipesFromText(text) {
  if (typeof text !== 'string') {
    return [];
  }
  const marker = /"recipes"\s*:\s*\[/i;
  const match = marker.exec(text);
  if (!match) {
    return [];
  }
  const startIndex = match.index + match[0].length;
  const segment = text.slice(startIndex);
  const recipes = [];
  let inString = false;
  let escapeNext = false;
  let braceDepth = 0;
  let objStart = -1;
  for (let i = 0; i < segment.length; i += 1) {
    const char = segment[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      if (braceDepth === 0) {
        objStart = i;
      }
      braceDepth += 1;
    } else if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      if (braceDepth === 0 && objStart !== -1) {
        const rawObject = segment.slice(objStart, i + 1);
        const parsedObject = parseJsonWithRepair(rawObject) ?? tryParseJson(rawObject);
        if (parsedObject) {
          recipes.push(parsedObject);
        }
        objStart = -1;
      }
    } else if (char === ']' && braceDepth === 0) {
      break;
    }
  }
  return recipes;
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

let recipeCacheData = null;
let recipeCacheLoadPromise = null;
let recipeCacheWritePromise = Promise.resolve();

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

function buildScaledImageFileName(query) {
  const hash = crypto
    .createHash('sha256')
    .update(`${query}:${OPENAI_IMAGE_MAX_DIM}:${OPENAI_IMAGE_QUALITY}`)
    .digest('hex')
    .slice(0, 16);
  return `${hash}.jpg`;
}

async function writeImageFile(query, b64) {
  await ensureImageFilesDir();
  const fileName = buildImageFileName(query);
  const filePath = path.join(IMAGE_FILES_DIR, fileName);
  const buffer = Buffer.from(b64, 'base64');
  await writeFile(filePath, buffer);
  return fileName;
}

async function writeScaledImageFile(query, buffer) {
  await ensureImageFilesDir();
  const fileName = buildScaledImageFileName(query);
  const filePath = path.join(IMAGE_FILES_DIR, fileName);
  const resized = await sharp(buffer)
    .resize({
      width: OPENAI_IMAGE_MAX_DIM,
      height: OPENAI_IMAGE_MAX_DIM,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: OPENAI_IMAGE_QUALITY })
    .toBuffer();
  await writeFile(filePath, resized);
  return fileName;
}

async function fetchImageBuffer(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createScaledImageFileFromGenerated(query, generated) {
  if (generated?.kind === 'b64') {
    const buffer = Buffer.from(generated.data, 'base64');
    try {
      return await writeScaledImageFile(query, buffer);
    } catch {
      return await writeImageFile(query, generated.data);
    }
  }
  if (generated?.kind === 'url') {
    const buffer = await fetchImageBuffer(generated.data);
    return await writeScaledImageFile(query, buffer);
  }
  return null;
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
  const buffer = Buffer.from(b64, 'base64');
  try {
    return await writeScaledImageFile(query, buffer);
  } catch {
    return writeImageFile(query, b64);
  }
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

function buildRecipeImagePrompt(recipe) {
  if (!recipe) {
    return '';
  }
  const title = String(recipe.title ?? '').trim();
  const ingredientList = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((item) => String(item?.name ?? '').trim()).filter(Boolean)
    : [];
  const stepsList = Array.isArray(recipe.steps)
    ? recipe.steps.map((step) => String(step ?? '').trim()).filter(Boolean)
    : [];
  const ingredientsText = ingredientList.length > 0 ? `Ingredients: ${ingredientList.join(', ')}` : '';
  const stepsText = stepsList.length > 0 ? `Steps: ${stepsList.join(' ')}` : '';
  const combined = [title, ingredientsText, stepsText].filter(Boolean).join('. ');
  return combined.slice(0, 1200);
}

function isUnsplashUrl(url) {
  if (!url) {
    return false;
  }
  return url.includes('unsplash.com') || url.includes('source.unsplash.com');
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

async function callNebiusChat({
  prompt,
  model,
  temperature = 0.7,
  systemContent = 'You are a helpful culinary assistant that returns only valid JSON.',
  maxTokens,
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let response;
  try {
    const baseUrl = NEBIUS_TEXT_BASE_URL.replace(/\/$/, '');
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NEBIUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        ...(Number.isFinite(maxTokens) ? { max_tokens: maxTokens } : {}),
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
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
      throw new Error('Nebius chat timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nebius chat failed: ${response.status} ${errorText}`);
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

async function callNebiusImage(prompt, timeoutMs = OPENAI_IMAGE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    const baseUrl = NEBIUS_IMAGE_BASE_URL.replace(/\/$/, '');
    response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NEBIUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: NEBIUS_IMAGE_MODEL,
        prompt,
        ...(NEBIUS_IMAGE_SIZE ? { size: NEBIUS_IMAGE_SIZE } : {}),
      }),
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw new Error('Nebius image timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nebius image failed: ${response.status} ${errorText}`);
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

function normalizeStep(step) {
  if (step === null || step === undefined) {
    return '';
  }
  if (typeof step === 'string' || typeof step === 'number') {
    return String(step).trim();
  }
  if (typeof step === 'object') {
    const candidate =
      step.text ??
      step.step ??
      step.instruction ??
      step.description ??
      step.details ??
      step.content ??
      step.value;
    if (candidate !== undefined && candidate !== null) {
      return String(candidate).trim();
    }
  }
  return '';
}

function normalizeSteps(steps) {
  if (Array.isArray(steps)) {
    return steps.map((step) => normalizeStep(step)).filter(Boolean);
  }
  if (typeof steps === 'string') {
    return steps
      .split(/\r?\n|(?:^|\s)\d+\.\s+/g)
      .map((step) => step.trim())
      .filter(Boolean);
  }
  if (steps && typeof steps === 'object') {
    const candidates = Array.isArray(steps.items)
      ? steps.items
      : Array.isArray(steps.steps)
        ? steps.steps
        : [];
    return candidates.map((step) => normalizeStep(step)).filter(Boolean);
  }
  return [];
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
      steps: normalizeSteps(item?.steps),
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

function normalizeTextForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterByDietaryTags(recipes, preferences) {
  if (!Array.isArray(preferences) || preferences.length === 0) {
    return recipes;
  }
  const normalizedPrefs = preferences
    .map((pref) => normalizeTextForMatch(pref))
    .filter((pref) => pref && pref !== 'none');
  if (normalizedPrefs.length === 0) {
    return recipes;
  }
  return recipes.filter((recipe) => {
    const tags = Array.isArray(recipe.tags)
      ? recipe.tags.map((tag) => normalizeTextForMatch(tag))
      : [];
    if (tags.length === 0) {
      return false;
    }
    return normalizedPrefs.every((pref) => tags.includes(pref));
  });
}

function filterByAllergens(recipes, allergies) {
  if (!allergies) {
    return recipes;
  }
  const raw =
    Array.isArray(allergies)
      ? allergies
      : typeof allergies === 'string'
        ? allergies.split(',')
        : [];
  const normalizedAllergens = raw
    .map((item) => normalizeTextForMatch(item))
    .filter(Boolean);
  if (normalizedAllergens.length === 0) {
    return recipes;
  }
  return recipes.filter((recipe) => {
    const ingredientNames = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ingredient) => normalizeTextForMatch(ingredient?.name))
      : [];
    return !normalizedAllergens.some((allergen) =>
      ingredientNames.some((name) => name.includes(allergen))
    );
  });
}

function recipesMissingRequiredFields(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return true;
  }
  return recipes.some(
    (recipe) =>
      !Array.isArray(recipe.ingredients) ||
      recipe.ingredients.length === 0 ||
      !Array.isArray(recipe.steps) ||
      recipe.steps.length === 0
  );
}

function applyRecipeFilters(recipes, options) {
  let filtered = filterByCuisine(recipes, options.cuisines);
  filtered = filterByDietaryTags(filtered, options.dietaryPreferences);
  filtered = filterByAllergens(filtered, options.allergies);
  if (Number.isFinite(options.servings) && options.servings > 0) {
    const forcedServings = Math.round(options.servings);
    filtered = filtered.map((recipe) => ({ ...recipe, servings: forcedServings }));
  }
  if (Number.isFinite(options.maxCookTimeMins) && options.maxCookTimeMins > 0) {
    const maxCookTime = Math.round(options.maxCookTimeMins);
    filtered = filtered.map((recipe) => ({
      ...recipe,
      cookTimeMins: Math.min(toSafeNumber(recipe.cookTimeMins, maxCookTime), maxCookTime),
    }));
  }
  return filtered;
}

async function loadRecipeCacheFromDisk() {
  try {
    const raw = await readFile(RECIPE_CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function getRecipeCache() {
  if (recipeCacheData) {
    return recipeCacheData;
  }
  if (!recipeCacheLoadPromise) {
    recipeCacheLoadPromise = (async () => {
      recipeCacheData = await loadRecipeCacheFromDisk();
      return recipeCacheData;
    })();
  }
  return recipeCacheLoadPromise;
}

async function saveRecipeCache(cache) {
  await ensureCacheDir();
  recipeCacheData = cache;
  recipeCacheWritePromise = recipeCacheWritePromise
    .then(() => writeFile(RECIPE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8'))
    .catch(() => {});
  return recipeCacheWritePromise;
}

function buildRecipeCacheKey({
  prompt,
  cuisines,
  count,
  servings,
  maxCookTimeMins,
  dietaryPreferences,
  allergies,
}) {
  const normalizedPrompt = String(prompt ?? '').trim().toLowerCase();
  const normalizedCuisines = Array.isArray(cuisines)
    ? cuisines.map((cuisine) => String(cuisine).trim().toLowerCase()).filter(Boolean)
    : [];
  const normalizedCount = Number.isFinite(count) ? count : 0;
  const normalizedServings = Number.isFinite(servings) ? servings : 0;
  const normalizedMaxCookTime = Number.isFinite(maxCookTimeMins) ? maxCookTimeMins : 0;
  const normalizedDietary = Array.isArray(dietaryPreferences)
    ? dietaryPreferences.map((pref) => String(pref).trim().toLowerCase()).filter(Boolean)
    : [];
  const normalizedAllergies = Array.isArray(allergies)
    ? allergies.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : typeof allergies === 'string'
      ? allergies
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : [];
  const keySource = JSON.stringify({
    prompt: normalizedPrompt,
    cuisines: normalizedCuisines.sort(),
    count: normalizedCount,
    servings: normalizedServings,
    maxCookTimeMins: normalizedMaxCookTime,
    dietaryPreferences: normalizedDietary.sort(),
    allergies: normalizedAllergies.sort(),
  });
  return crypto.createHash('sha256').update(keySource).digest('hex').slice(0, 20);
}

async function attachRecipeImages(recipes, baseUrl) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return recipes;
  }
  const cache = await getImageCache();
  let cacheChanged = false;
  for (const recipe of recipes) {
    if (!recipe) {
      continue;
    }
    const title = String(recipe.title ?? '').trim();
    const normalized = title.toLowerCase();
    if (!normalized) {
      continue;
    }
    if (recipe.imageUrl && !isUnsplashUrl(recipe.imageUrl)) {
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
    if (typeof cachedUrl === 'string' && cachedUrl && !isUnsplashUrl(cachedUrl)) {
      recipe.imageUrl = cachedUrl;
      continue;
    }
    const imageUrl = recipe.imageUrl ?? (await resolveUnsplashImage(title));
    if (imageUrl) {
      recipe.imageUrl = imageUrl;
      cache[normalized] = imageUrl;
      cacheChanged = true;
    }
    if (OPENAI_API_KEY) {
      scheduleOpenAiImage({
        cacheKey: `recipe:${normalized}`,
        normalized,
        query: title,
        prompt: buildRecipeImagePrompt(recipe),
        baseUrl,
      });
    }
  }
  if (cacheChanged) {
    await saveImageCache(cache);
  }
  return recipes;
}

async function scheduleOpenAiImage({ cacheKey, normalized, query, prompt, baseUrl }) {
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
  openAiImageQueue.push({ cacheKey, normalized, query, prompt, baseUrl });
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

async function attemptOpenAiImage({ cacheKey, normalized, query, prompt, baseUrl }) {
  try {
    const basePrompt = prompt
      ? `High-quality food photo of ${prompt}`
      : `High-quality food photo of ${buildImageQuery(query)}.`;
    const polished = await polishImagePrompt(basePrompt);
    const generated = await callNebiusImage(polished);
    if (!generated) {
      return;
    }
    const cache = await getImageCache();
    let imageUrl;
    const fileName = await createScaledImageFileFromGenerated(normalized, generated);
    if (fileName) {
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
        scheduleOpenAiImage({ cacheKey, normalized, query, prompt, baseUrl });
      }, OPENAI_IMAGE_RATE_LIMIT_BACKOFF_MS);
      return;
    }
    logImageError(`async "${query}"`, error);
  } finally {
    openAiImageInFlight.delete(cacheKey);
  }
}

async function handleRecipes(req, res, body) {
  const recipeProvider = RECIPE_PROVIDER === 'openai' ? 'openai' : 'nebius';
  if (recipeProvider === 'openai' && !OPENAI_API_KEY) {
    sendJson(res, 500, { error: 'Missing OPENAI_API_KEY.' });
    return;
  }
  if (recipeProvider === 'nebius' && !NEBIUS_API_KEY) {
    sendJson(res, 500, { error: 'Missing NEBIUS_API_KEY.' });
    return;
  }
  const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
  const requestStart = Date.now();
  const data = JSON.parse(body || '{}');
  const prompt = String(data.prompt ?? '').trim();
  const cuisines = Array.isArray(data.cuisines) ? data.cuisines.map((c) => String(c)) : [];
  const count = Number.isFinite(data.count) ? data.count : undefined;
  const servings = Number.isFinite(data.servings) ? data.servings : undefined;
  const maxCookTimeMins = Number.isFinite(data.maxCookTimeMins)
    ? data.maxCookTimeMins
    : undefined;
  const dietaryPreferences = Array.isArray(data.dietaryPreferences)
    ? data.dietaryPreferences.map((pref) => String(pref))
    : [];
  const allergies = data.allergies ? String(data.allergies) : '';
  const userId = data.userId ? String(data.userId).trim() : '';
  if (!prompt) {
    sendJson(res, 400, { error: 'Prompt is required.' });
    return;
  }

  const recipeCache = await getRecipeCache();
  const cacheKey = buildRecipeCacheKey({
    prompt,
    cuisines,
    count,
    servings,
    maxCookTimeMins,
    dietaryPreferences,
    allergies,
  });
  const cachedEntry = recipeCache[cacheKey];
  if (cachedEntry && Array.isArray(cachedEntry.recipes) && cachedEntry.recipes.length > 0) {
    const generatedBy = typeof cachedEntry.generatedBy === 'string' ? cachedEntry.generatedBy : '';
    if (!userId || !generatedBy || generatedBy !== userId) {
      const normalizedRecipes = cachedEntry.recipes.map((recipe) => ({
        ...recipe,
        steps: normalizeSteps(recipe?.steps),
      }));
      if (normalizedRecipes.some((recipe) => recipe.steps.length === 0)) {
        cachedEntry.recipes = normalizedRecipes;
        await saveRecipeCache(recipeCache);
      }
      await attachRecipeImages(normalizedRecipes, baseUrl);
      console.log(`[ai:recipes] cache hit recipes=${cachedEntry.recipes.length}`);
      sendJson(res, 200, { recipes: normalizedRecipes, cuisineFallback: false });
      return;
    }
    console.log('[ai:recipes] cache bypass for same user');
  }

  console.log(`[ai:recipes] request start prompt="${prompt.slice(0, 80)}" cuisines=${cuisines.join(',') || 'none'}`);
  const chat =
    recipeProvider === 'openai'
      ? await callOpenAiChat({
          prompt: buildPrompt({
            prompt,
            cuisines,
            count,
            servings,
            maxCookTimeMins,
            dietaryPreferences,
            allergies,
          }),
          model: OPENAI_RECIPE_MODEL,
        })
      : await callNebiusChat({
          prompt: buildPrompt({
            prompt,
            cuisines,
            count,
            servings,
            maxCookTimeMins,
            dietaryPreferences,
            allergies,
          }),
          model: NEBIUS_RECIPE_MODEL,
          maxTokens: 1200,
        });
  const content = chat?.choices?.[0]?.message?.content;
  if (!content) {
    sendJson(res, 500, {
      error: `${recipeProvider === 'openai' ? 'OpenAI' : 'Nebius'} response missing content.`,
    });
    return;
  }

  let parsed = parseJsonWithRepair(content);
  if (!parsed) {
    const extractedRecipes = extractRecipesFromText(content);
    if (extractedRecipes.length > 0) {
      parsed = { recipes: extractedRecipes };
    }
  }
  if (!parsed) {
    const snippet = content.slice(0, 320);
    console.warn(
      `[ai:recipes] ${recipeProvider} json parse failed. Snippet="${snippet.replace(/\s+/g, ' ')}"`
    );
    if (recipeProvider === 'nebius') {
      const retryChat = await callNebiusChat({
        prompt: buildPrompt({
          prompt,
          cuisines,
          count,
          servings,
          maxCookTimeMins,
          dietaryPreferences,
          allergies,
        }),
        model: NEBIUS_RECIPE_MODEL,
        temperature: 0.2,
        maxTokens: 1200,
        systemContent:
          'Return only valid JSON for recipes. No commentary, no markdown, no extra keys. Do not truncate.',
      });
      const retryContent = retryChat?.choices?.[0]?.message?.content ?? '';
      parsed = parseJsonWithRepair(retryContent);
      if (!parsed) {
        const extractedRetryRecipes = extractRecipesFromText(retryContent);
        if (extractedRetryRecipes.length > 0) {
          parsed = { recipes: extractedRetryRecipes };
        }
      }
      if (!parsed) {
        const retrySnippet = retryContent.slice(0, 320);
        console.warn(
          `[ai:recipes] ${recipeProvider} retry parse failed. Snippet="${retrySnippet.replace(/\s+/g, ' ')}"`
        );
        sendJson(res, 500, { error: 'Failed to parse Nebius JSON.' });
        return;
      }
    } else {
      sendJson(res, 500, {
        error: `Failed to parse ${recipeProvider === 'openai' ? 'OpenAI' : 'Nebius'} JSON.`,
      });
      return;
    }
  }

  const coercedRecipes = coerceRecipes(parsed);
  let recipes = applyRecipeFilters(coercedRecipes, {
    cuisines,
    dietaryPreferences,
    allergies,
    servings,
    maxCookTimeMins,
  });
  if (recipesMissingRequiredFields(recipes)) {
    console.warn('[ai:recipes] missing ingredients/steps in initial parse:', JSON.stringify(recipes));
    let retryAttempts = 0;
    while (retryAttempts < 2 && recipesMissingRequiredFields(recipes)) {
      const retryChat =
        recipeProvider === 'openai'
          ? await callOpenAiChat({
              prompt: buildPrompt({
                prompt,
                cuisines,
                count,
                servings,
                maxCookTimeMins,
                dietaryPreferences,
                allergies,
              }),
              model: OPENAI_RECIPE_MODEL,
              temperature: 0.4,
              responseFormat: 'json_object',
              systemContent:
                'Return only valid JSON for recipes. Each recipe must include non-empty ingredients and non-empty steps.',
            })
          : await callNebiusChat({
              prompt: buildPrompt({
                prompt,
                cuisines,
                count,
                servings,
                maxCookTimeMins,
                dietaryPreferences,
                allergies,
              }),
              model: NEBIUS_RECIPE_MODEL,
              temperature: 0.4,
              maxTokens: 1200,
              systemContent:
                'Return only valid JSON for recipes. Each recipe must include non-empty ingredients and non-empty steps. Do not truncate.',
            });
      const retryContent = retryChat?.choices?.[0]?.message?.content ?? '';
      let retryParsed = parseJsonWithRepair(retryContent);
      if (!retryParsed) {
        const extractedRetryRecipes = extractRecipesFromText(retryContent);
        if (extractedRetryRecipes.length > 0) {
          retryParsed = { recipes: extractedRetryRecipes };
        }
      }
      if (retryParsed) {
        const retryCoerced = coerceRecipes(retryParsed);
        recipes = applyRecipeFilters(retryCoerced, {
          cuisines,
          dietaryPreferences,
          allergies,
          servings,
          maxCookTimeMins,
        });
        if (recipesMissingRequiredFields(recipes)) {
          console.warn(
            '[ai:recipes] missing ingredients/steps after retry:',
            JSON.stringify(recipes)
          );
        }
      }
      retryAttempts += 1;
    }
  }
  if (Number.isFinite(count) && count > 0 && recipes.length < count) {
    let attempts = 0;
    let avoidTitles = recipes.map((recipe) => recipe.title);
    while (recipes.length < count && attempts < 3) {
      const needed = count - recipes.length;
      const followupPrompt = buildPrompt({
        prompt,
        cuisines,
        count: needed,
        servings,
        maxCookTimeMins,
        dietaryPreferences,
        allergies,
        avoidTitles,
      });
      const followupChat =
        recipeProvider === 'openai'
          ? await callOpenAiChat({
              prompt: followupPrompt,
              model: OPENAI_RECIPE_MODEL,
            })
          : await callNebiusChat({
              prompt: followupPrompt,
              model: NEBIUS_RECIPE_MODEL,
              temperature: 0.5,
              maxTokens: 900,
              systemContent:
                'Return only valid JSON for recipes. No commentary, no markdown, no extra keys. Do not truncate.',
            });
      const followupContent = followupChat?.choices?.[0]?.message?.content ?? '';
      let followupParsed = parseJsonWithRepair(followupContent);
      if (!followupParsed) {
        const extractedFollowup = extractRecipesFromText(followupContent);
        if (extractedFollowup.length > 0) {
          followupParsed = { recipes: extractedFollowup };
        }
      }
      if (followupParsed) {
        const followupRecipes = applyRecipeFilters(coerceRecipes(followupParsed), {
          cuisines,
          dietaryPreferences,
          allergies,
          servings,
          maxCookTimeMins,
        });
        const unique = followupRecipes.filter(
          (recipe) => !avoidTitles.some((title) => title.toLowerCase() === recipe.title.toLowerCase())
        );
        if (unique.length > 0) {
          recipes = [...recipes, ...unique].slice(0, count);
          avoidTitles = recipes.map((recipe) => recipe.title);
        }
      }
      attempts += 1;
    }
  }
  let cuisineFallback = false;
  if (cuisines.length > 0 && recipes.length === 0) {
    recipes = coercedRecipes;
    cuisineFallback = true;
  }
  await attachRecipeImages(recipes, baseUrl);
  recipeCache[cacheKey] = {
    recipes,
    generatedBy: userId || undefined,
    createdAt: nowIso(),
  };
  await saveRecipeCache(recipeCache);
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
      scheduleOpenAiImage({ cacheKey, normalized, query, prompt: undefined, baseUrl });
    }
    sendJson(res, 200, { imageUrl: cachedUrl });
    return;
  }

  let imageUrl;
  if (kind !== 'deal' && OPENAI_API_KEY) {
    const baseUrl = `http://${req.headers.host ?? 'localhost'}`;
    scheduleOpenAiImage({ cacheKey, normalized, query, prompt: undefined, baseUrl });
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
