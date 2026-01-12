import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const officialDir = path.join(rootDir, 'assets', 'logos', 'official');
const monoDir = path.join(rootDir, 'assets', 'logos', 'mono');

const stores = [
  { name: 'no-frills', domain: 'nofrills.ca', iconCandidates: ['nofrills', 'no-frills'] },
  { name: 'loblaws', domain: 'loblaws.ca', iconCandidates: ['loblaws'] },
  { name: 'real-canadian-superstore', domain: 'realcanadiansuperstore.ca', iconCandidates: ['realcanadiansuperstore', 'superstore'] },
  { name: 'metro', domain: 'metro.ca', iconCandidates: ['metro'] },
  { name: 'freshco', domain: 'freshco.com', iconCandidates: ['freshco'] },
  { name: 'food-basics', domain: 'foodbasics.ca', iconCandidates: ['foodbasics', 'food-basics'] },
  { name: 'walmart', domain: 'walmart.com', iconCandidates: ['walmart'] },
  { name: 'costco', domain: 'costco.com', iconCandidates: ['costco'] },
  {
    name: 'longos',
    domain: 'longos.com',
    iconCandidates: ['longos'],
    officialOverride:
      'https://media.licdn.com/dms/image/v2/C4E0BAQHpbwo2RJ2SdA/company-logo_200_200/company-logo_200_200/0/1631356940137?e=2147483647&v=beta&t=QHoE18kFYJOA2T4k2vjH36BFEgqq0OePdMfouO6ZTkY',
  },
  { name: 'bestco', domain: 'bestco.ca', iconCandidates: ['bestco'] },
];

const extensionFromContentType = (type) => {
  if (!type) return 'png';
  if (type.includes('svg')) return 'svg';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('x-icon') || type.includes('ico')) return 'ico';
  return 'png';
};

const fetchToFile = async (url, filePathBase) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed ${url} (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  const ext = extensionFromContentType(contentType);
  const filePath = `${filePathBase}.${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
};

const run = async () => {
  await mkdir(officialDir, { recursive: true });
  await mkdir(monoDir, { recursive: true });
  for (const store of stores) {
    const officialSources = [
      store.officialOverride,
      `https://logo.clearbit.com/${store.domain}`,
      `https://logo.uplead.com/${store.domain}`,
      `https://www.google.com/s2/favicons?domain=${store.domain}&sz=256`,
    ].filter(Boolean);
    const officialBase = path.join(officialDir, store.name);
    let officialOk = false;
    for (const url of officialSources) {
      try {
        const output = await fetchToFile(url, officialBase);
        console.log(`Downloaded official logo: ${output}`);
        officialOk = true;
        break;
      } catch (err) {
        console.error(`Official logo failed for ${store.name} (${url}):`, err.message);
      }
    }
    if (!officialOk) {
      console.error(`Official logo not found for ${store.name}.`);
    }

    const monoBase = path.join(monoDir, store.name);
    let monoOk = false;
    for (const slug of store.iconCandidates) {
      const sources = [
        `https://cdn.simpleicons.org/${slug}/111111`,
        `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${slug}.svg`,
      ];
      for (const url of sources) {
        try {
          const output = await fetchToFile(url, monoBase);
          console.log(`Downloaded mono logo: ${output}`);
          monoOk = true;
          break;
        } catch (err) {
          console.error(`Mono logo failed for ${store.name} (${url}):`, err.message);
        }
      }
      if (monoOk) {
        break;
      }
    }
    if (!monoOk) {
      console.error(`Mono logo not found for ${store.name}.`);
    }
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
