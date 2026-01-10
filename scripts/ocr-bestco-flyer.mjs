#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const FLYER_URL = 'https://www.bestco.shop/pages/downtown-flyer';
const OCR_ENDPOINT = 'https://api.ocr.space/parse/image';
const OUTPUT_PATH = path.join(process.cwd(), 'src/fixtures/deals/toronto/bestco.json');

const apiKey = process.env.OCR_SPACE_API_KEY;
if (!apiKey) {
  console.error('Missing OCR_SPACE_API_KEY. Set it in your environment before running.');
  process.exit(1);
}

function normalizeImageUrl(url) {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

function extractImageUrls(html) {
  const urls = new Set();
  const matches = html.matchAll(/<img[^>]+src=\"([^\"]+)\"/g);
  for (const match of matches) {
    const src = normalizeImageUrl(match[1]);
    if (
      src.includes('bestcofoods.com/wp-content') ||
      src.includes('bestco.shop/cdn/shop/files')
    ) {
      urls.add(src);
    }
  }
  return Array.from(urls);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function requestOcr(imageUrl) {
  const body = new URLSearchParams({
    apikey: apiKey,
    url: imageUrl,
    language: 'eng',
    isOverlayRequired: 'false',
    OCREngine: '2',
  });
  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`OCR request failed: ${response.status}`);
  }
  return response.json();
}

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractDealsFromText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const results = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const priceMatch = line.match(/\$(\d+(?:\.\d{1,2})?)/);
    const centMatch = line.match(/(\d+)\s?¢/);
    if (!priceMatch && !centMatch) {
      continue;
    }
    const price = priceMatch
      ? Number.parseFloat(priceMatch[1])
      : Number.parseFloat((Number.parseInt(centMatch[1], 10) / 100).toFixed(2));
    let name = line
      .replace(/\$(\d+(?:\.\d{1,2})?)/, '')
      .replace(/(\d+)\s?¢/, '')
      .replace(/\b(price|save|save up to)\b/gi, '')
      .trim();

    if (!name && i > 0) {
      name = lines[i - 1].replace(/\b(price|save|save up to)\b/gi, '').trim();
    }
    if (!name || name.length < 3) {
      continue;
    }

    results.push({ name, price });
  }

  const deduped = new Map();
  for (const deal of results) {
    const key = `${deal.name.toLowerCase()}-${deal.price}`;
    if (!deduped.has(key)) {
      deduped.set(key, deal);
    }
  }
  return Array.from(deduped.values());
}

function buildDealItems(deals) {
  const now = new Date();
  const validFrom = now.toISOString().slice(0, 10);
  const validTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return deals.map((deal) => ({
    id: `bestco-${toSlug(deal.name)}-${String(deal.price).replace('.', '-')}`,
    title: deal.name,
    store: 'Bestco Fresh Foods',
    price: deal.price,
    unit: 'each',
    category: 'Other',
    validFrom,
    validTo,
    location: 'Toronto',
  }));
}

async function run() {
  const html = await fetchText(FLYER_URL);
  const imageUrls = extractImageUrls(html);
  if (imageUrls.length === 0) {
    throw new Error('No flyer images found.');
  }

  const allDeals = [];
  for (const url of imageUrls) {
    console.log(`OCR: ${url}`);
    const result = await requestOcr(url);
    if (result.IsErroredOnProcessing) {
      console.warn('OCR error:', result.ErrorMessage || result.ErrorDetails || 'Unknown error');
      continue;
    }
    const parsedText = result.ParsedResults?.[0]?.ParsedText ?? '';
    allDeals.push(...extractDealsFromText(parsedText));
  }

  const items = buildDealItems(allDeals);
  if (items.length === 0) {
    console.warn('No deals parsed from OCR output.');
  }
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(items, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${items.length} deals to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
