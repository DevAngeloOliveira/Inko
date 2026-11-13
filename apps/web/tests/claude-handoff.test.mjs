import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const source = relative => readFileSync(new URL(relative, webRoot), 'utf8');
const routes = ['acervo/page.tsx','acervo/novo/page.tsx','acervo/[id]/page.tsx','usuarios/page.tsx','emprestimos/page.tsx','devolucoes/page.tsx','relatorios/page.tsx','login/page.tsx','design-system/page.tsx','landing/page.tsx'];

test('Claude Design pages are available as native Next.js routes', () => {
  for (const route of routes) assert.ok(existsSync(new URL(`app/${route}`, webRoot)), route);
});

test('design system includes reusable components and semantic tokens', () => {
  const ui = source('components/inko-kit.tsx');
  const css = source('app/inko-ui.css');
  for (const component of ['InkoButton','InkoInput','InkoStatus','MangaCard','InkoCover','DemoNotice']) assert.match(ui, new RegExp(component));
  for (const token of ['--inko-background-default','--inko-border-default','--inko-action-primary']) assert.ok(css.includes(token));
});

test('academic fine rule applies exclusively to active overdue loans', () => {
  const demo = source('lib/demo.ts');
  assert.match(demo, /DAILY_FINE_CENTS = 200/);
  assert.match(demo, /!loan\.returnedAt && daysOverdue/);
  assert.match(demo, /\.map\(loan => loan\.fineCents\)\.reduce/);
});

test('business operations run against the mock API until the backend exists', () => {
  assert.match(source('app/emprestimos/page.tsx'), /Confirmar empréstimo<\/InkoButton>/);
  assert.match(source('app/emprestimos/page.tsx'), /createLoan\(/);
  assert.match(source('app/devolucoes/page.tsx'), /returnLoan\(/);
  assert.match(source('app/acervo/novo/page.tsx'), /createWork\(/);
  assert.match(source('app/usuarios/page.tsx'), /createUser\(/);
  assert.match(source('app/login/page.tsx'), /signIn\(/);
  assert.match(source('app/login/page.tsx'), /Acesso demonstrativo/);
});

test('mock layer never reaches the network nor ships fixed credentials', () => {
  const mock = source('lib/mock-api.ts');
  assert.doesNotMatch(mock, /fetch\(|XMLHttpRequest|localStorage/);
  assert.doesNotMatch(mock, /password\s*[!=]==\s*['"`]/);
  assert.match(mock, /sessionStorage/);
  for (const route of routes.filter(route => route !== 'landing/page.tsx')) {
    assert.doesNotMatch(source(`app/${route}`), /fetch\(/, route);
  }
});

test('assets from approved identity are referenced and dashboard is interactive', () => {
  const dashboard = source('components/dashboard.tsx');
  assert.match(dashboard, /EditorialBanner|Enso/);
  assert.match(dashboard, /DADOS DEMONSTRATIVOS/);
  assert.match(dashboard, /href="\/motion-lab"/);
  assert.match(source('components/app-shell.tsx'), /inko-logo-inverse\.png/);
});
