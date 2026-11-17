import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const web = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, web), 'utf8');
const page = read('app/landing/page.tsx');
const client = read('app/landing/landing-client.tsx');
const landing = page + client;

test('landing carries the product copy and the required sections', () => {
  assert.match(page, /Grandes histórias merecem uma estante à altura\./);
  assert.match(page, /Explorar o acervo/);
  assert.match(page, /Conhecer o INKO/);
  assert.match(page, /Mangás · HQs · Graphic Novels/);
  assert.match(page, /Todo universo começa em algum lugar\. O seu começa aqui\./);
  for (const id of ['inicio', 'acervo', 'colecoes', 'plataforma', 'como', 'faq']) {
    assert.match(landing, new RegExp(`id="${id}"`), id);
  }
  for (const label of ['Início', 'Explorar acervo', 'Coleções', 'A plataforma', 'Como funciona', 'Entrar']) {
    assert.ok(client.includes(`'${label}'`) || client.includes(`>${label}<`), label);
  }
});

test('landing has no placeholders, fake leads or unsupported claims', () => {
  assert.doesNotMatch(landing, /\[SEU MODELO|\[DEPOIMENTO|\[NOME/);
  assert.doesNotMatch(landing, /WCAG/);
  assert.doesNotMatch(landing, /Pedido recebido|LeadForm|type="email"/);
  assert.doesNotMatch(landing, /R\$\s?\d+[.,]\d{2}\s*\/\s*m[eê]s|plano|assinatura/i);
  assert.doesNotMatch(landing, /patrocinad/i);
  assert.doesNotMatch(landing, /<blockquote/);
});

test('landing reads works and availability from the real services, with loading and error states', () => {
  assert.match(client, /fetchPublicCatalog\(\)/);
  assert.match(client, /Catálogo indisponível/);
  assert.match(client, /Tentar novamente/);
  assert.match(client, /ShowcaseSkeleton/);
  assert.doesNotMatch(landing, /from '\.\.\/\.\.\/lib\/demo'[^;]*\b(works|loans)\b/);
  assert.match(client, /PAGE_SIZE = 12/);
});

test('landing links only to existing routes and real product captures', () => {
  const routes = [...landing.matchAll(/href="(\/[a-z/-]*)"/g)].map(match => match[1]);
  routes.push(...[...landing.matchAll(/href: '(\/[a-z/-]*)'/g)].map(match => match[1]));
  for (const route of new Set(routes)) {
    const file = route === '/landing' ? 'app/landing/page.tsx' : `app${route}/page.tsx`;
    assert.ok(existsSync(new URL(file, web)), `rota inexistente: ${route}`);
  }
  for (const screen of ['dashboard', 'acervo', 'emprestimos', 'devolucoes', 'relatorios']) {
    assert.ok(existsSync(new URL(`public/inko/landing/${screen}.jpg`, web)), `captura ausente: ${screen}`);
  }
});

test('anime adaptations are presented as references, not loanable copies', () => {
  assert.match(client, /a série animada aparece só como referência/);
  assert.match(read('app/acervo/[id]/page.tsx'), /o acervo empresta apenas o volume impresso/);
});

test('campaign filters map manifest keys to the showcase filter', () => {
  const editorial = read('lib/editorial.ts');
  assert.match(editorial, /function toFilter\(filtro: \{ categoria\?: string; colecao\?: string \}\)/);
  assert.doesNotMatch(editorial, /item\.filtro as EditorialFilter/);
});
