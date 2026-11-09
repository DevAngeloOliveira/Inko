import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../app/inko-motion.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/motion-lab/page.tsx', import.meta.url), 'utf8');

const sequences = [
  ['enso', '55%, 100%', '2.4s'],
  ['panel', '30%, 100%', '2.4s'],
  ['brush', '45%, 100%', '2.4s'],
];

for (const [name, hold, duration] of sequences) {
  test(`original ${name} motion preserves Claude source cycle`, () => {
    assert.ok(css.includes(hold));
    assert.ok(css.includes(duration));
    assert.ok(css.includes(`inko-motion-demo-${name}`));
  });
}

test('operational motions preserve source timings', () => {
  for (const duration of ['900ms', '220ms', '200ms', '1.4s', '800ms']) {
    assert.ok(css.includes(duration), `Missing motion duration: ${duration}`);
  }
});

test('prefers-reduced-motion disables source animation', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /inko-motion-demo-enso \{ stroke-dashoffset: 60; \}/);
  assert.match(css, /inko-motion-enso-entry \{ stroke-dashoffset: 70; \}/);
});

test('all motion lab source classes are declared', () => {
  for (const cls of page.matchAll(/className="(inko-motion-[\w-]+)"/g)) {
    assert.ok(css.includes(`.${cls[1]}`), `Missing class ${cls[1]}`);
  }
});

test('original INKO vectors are available without embedding canvas runtime', () => {
  for (const path of ['../public/inko/svg/elementos/enso-seal.svg','../public/inko/svg/elementos/pincelada-horizontal-seal.svg','../public/inko/svg/icons/icon-mangas.svg']) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `Missing ${path}`);
  }
});
