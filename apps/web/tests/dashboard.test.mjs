import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboard = readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../app/inko-ui.css', import.meta.url), 'utf8');

test('homepage renders the real INKO layout rather than temporary system health', () => {
  assert.match(home, /Dashboard/);
  assert.match(dashboard, /Cada volume/);
  assert.match(dashboard, /DADOS DEMONSTRATIVOS/);
});

test('diagnostic UI remains available at its own route', () => {
  assert.ok(existsSync(new URL('../app/system/status/page.tsx', import.meta.url)));
});

test('domain navigation links are defined and demonstration data is identified', () => {
  assert.match(dashboard, /href="\/emprestimos"/);
  assert.match(dashboard, /DemoTag|DemoNotice/);
  assert.match(dashboard, /href="\/motion-lab"/);
  assert.match(dashboard, /href="\/system\/status"/);
});

test('dashboard consumes original INKO assets and design tokens', () => {
  assert.match(readFileSync(new URL('../components/app-shell.tsx', import.meta.url), 'utf8'), /inko-logo-inverse\.png/);
  assert.match(dashboard, /EditorialBanner|Enso/);
  assert.match(stylesheet, /var\(--inko-background-default\)/);
  assert.match(stylesheet, /prefers-reduced-motion:reduce/);
});
