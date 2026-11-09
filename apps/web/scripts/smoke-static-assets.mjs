import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = process.env.INKO_BASE_URL ?? 'http://127.0.0.1:3000';
const root = fileURLToPath(new URL('../public/inko/', import.meta.url));

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collect(fullPath);
    return /\.(png|svg)$/i.test(entry.name) ? [fullPath] : [];
  });
}

async function awaitServer() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(new URL('/', baseUrl));
      if (response.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`INKO frontend não iniciou em ${baseUrl}`);
}

await awaitServer();

const assets = collect(root);
if (assets.length < 37) throw new Error(`Acervo de assets incompleto: ${assets.length} arquivo(s)`);

const failures = [];
for (const file of assets) {
  const path = '/inko/' + relative(root, file).split(sep).join('/');
  const response = await fetch(new URL(path, baseUrl));
  const contentType = response.headers.get('content-type') ?? '';
  const expectedType = path.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const bytes = (await response.arrayBuffer()).byteLength;
  if (!response.ok || !contentType.includes(expectedType) || bytes === 0) {
    failures.push(`${path} — HTTP ${response.status}, ${contentType}, ${bytes} bytes`);
  }
}

const optimizer = new URL('/_next/image', baseUrl);
optimizer.searchParams.set('url', '/inko/logo/inko-logo-inverse.png');
optimizer.searchParams.set('w', '256');
optimizer.searchParams.set('q', '75');
const optimized = await fetch(optimizer);
if (!optimized.ok || !(optimized.headers.get('content-type') ?? '').startsWith('image/')) {
  failures.push(`Next Image optimizer — HTTP ${optimized.status}, ${optimized.headers.get('content-type')}`);
}

if (failures.length) throw new Error(failures.join('\n'));
console.log(`OK: ${assets.length} assets estáticos e logo otimizada respondem via HTTP.`);
