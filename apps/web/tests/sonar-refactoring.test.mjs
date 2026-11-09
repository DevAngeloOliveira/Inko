import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('catalog views use independent conditional branches', () => {
  const catalog = source('app/acervo/page.tsx');
  assert.match(catalog, /view === 'cards' &&/);
  assert.match(catalog, /view === 'table' &&/);
  assert.doesNotMatch(catalog, /view === 'cards' \?/);
});

test('loan steps use named helper rather than nested ternary', () => {
  const loans = source('app/emprestimos/page.tsx');
  assert.match(loans, /function stepClassName/);
  assert.doesNotMatch(loans, /inko-step-current':/);
});

test('components declare readonly props and route matching is reused', () => {
  const shell = source('components/app-shell.tsx');
  assert.match(shell, /function isActiveRoute/);
  assert.match(shell, /Readonly</);
  for (const path of ['components/inko-kit.tsx','components/inko-patterns.tsx','app/acervo/[id]/page.tsx']) {
    assert.match(source(path), /Readonly</, path);
  }
});
