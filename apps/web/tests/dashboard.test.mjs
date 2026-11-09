import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboard = readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8');
const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/dashboard.css', import.meta.url), 'utf8');

test('homepage renders the INKO dashboard', () => {
  assert.match(homepage, /Dashboard/);
  assert.match(dashboard, /Cada volume/);
  assert.match(dashboard, /DADOS DEMONSTRATIVOS/);
});

test('system diagnostic remains available separately', () => {
  assert.ok(existsSync(new URL('../app/system/status/page.tsx', import.meta.url)));
});

test('domain features are not exposed before implementation', () => {
  assert.match(dashboard, /Em breve/);
  assert.match(dashboard, /href="\/motion-lab"/);
});

test('original INKO assets and semantic tokens are used', () => {
  assert.match(dashboard, /inko-logo-inverse.png/);
  assert.match(dashboard, /enso-seal.svg/);
  assert.match(css, /var\(--inko-background-default\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
