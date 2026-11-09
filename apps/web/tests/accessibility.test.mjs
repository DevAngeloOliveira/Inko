import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('interactive modal uses the native dialog element without backdrop click listeners', () => {
  const interactions = source('components/inko-interactions.tsx');
  assert.match(interactions, /<dialog\s/);
  assert.match(interactions, /showModal\(\)/);
  assert.doesNotMatch(interactions, /role="dialog"|role="presentation"|onClick=\{event\s*=>\s*event\.stopPropagation/);
});

test('notification and loading states use accessible output semantics', () => {
  for (const path of [
    'components/inko-kit.tsx',
    'components/inko-patterns.tsx',
    'components/inko-interactions.tsx',
    'app/usuarios/page.tsx',
    'app/acervo/novo/page.tsx'
  ]) {
    const file = source(path);
    assert.doesNotMatch(file, /role="status"/, path);
    assert.match(file, /<output\s/, path);
  }
});

test('category filters use semantic fieldset', () => {
  const catalog = source('app/acervo/page.tsx');
  assert.match(catalog, /<fieldset\s/);
  assert.match(catalog, /<legend\s/);
  assert.doesNotMatch(catalog, /role="group"/);
});
