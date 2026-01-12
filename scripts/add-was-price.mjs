import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dealsDir = path.join(process.cwd(), 'src', 'fixtures', 'deals', 'toronto');

const roundTo99 = (value) => {
  const rounded = Math.ceil(value * 100) / 100;
  const dollars = Math.floor(rounded);
  const cents = Math.round((rounded - dollars) * 100);
  if (cents === 99) {
    return Number(rounded.toFixed(2));
  }
  return Number((dollars + 0.99).toFixed(2));
};

const buildWasPrice = (price) => {
  if (!Number.isFinite(price)) {
    return undefined;
  }
  const uplift = price * 1.25;
  const candidate = roundTo99(uplift);
  if (candidate <= price) {
    return Number((price + 1).toFixed(2));
  }
  return candidate;
};

const run = async () => {
  const files = await readdir(dealsDir);
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const filePath = path.join(dealsDir, file);
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      continue;
    }
    let changed = false;
    const next = data.map((item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      if (typeof item.wasPrice === 'number') {
        return item;
      }
      if (typeof item.price !== 'number') {
        return item;
      }
      const wasPrice = buildWasPrice(item.price);
      if (!wasPrice) {
        return item;
      }
      changed = true;
      return { ...item, wasPrice };
    });
    if (changed) {
      await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
      console.log(`Updated ${file}`);
    }
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
