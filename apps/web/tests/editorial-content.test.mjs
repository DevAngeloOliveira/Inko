import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const catalog = read('data/seeds/catalogo-obras.json');
const editorial = read('data/seeds/colecoes-editoriais.json');
const anime = read('data/seeds/adaptacoes-anime.json');
const ids = new Set(catalog.obras.map(work => work.id));
const byId = new Map(catalog.obras.map(work => [work.id, work]));

test('catalog has at least 36 unique, well-formed works across the three categories', () => {
  assert.ok(catalog.obras.length >= 36, `${catalog.obras.length} obras`);
  assert.equal(ids.size, catalog.obras.length, 'IDs duplicados');
  assert.equal(new Set(catalog.obras.map(work => `${work.titulo}|${work.volumeOuEdicao}`)).size, catalog.obras.length, 'obras duplicadas');
  for (const work of catalog.obras) {
    assert.match(work.id, /^INK-\d{4}$/, work.id);
    for (const field of ['titulo', 'autorOuCriador', 'categoria', 'volumeOuEdicao', 'sinopseCurta']) {
      assert.ok(typeof work[field] === 'string' && work[field].trim(), `${work.id}.${field}`);
    }
    assert.ok(['Mangá', 'HQ', 'Graphic novel'].includes(work.categoria), work.id);
    assert.ok(work.titulo.length <= 160 && work.autorOuCriador.length <= 120 && work.volumeOuEdicao.length <= 40, work.id);
    assert.ok(work.generos.length > 0 && work.generos.every(genre => catalog.generos.includes(genre)), `${work.id} gêneros`);
  }
  const counts = Object.groupBy(catalog.obras, work => work.categoria);
  assert.ok(counts['Mangá'].length >= 12 && counts.HQ.length >= 8 && counts['Graphic novel'].length >= 5);
});

test('every work carries an identifiable metadata reference and no unlicensed cover', () => {
  for (const work of catalog.obras) {
    assert.match(work.referencia?.url ?? '', /^https:\/\/openlibrary\.org\/works\/OL\d+W$/, work.id);
    assert.ok(work.referencia.autoresEncontrados.length > 0, work.id);
    assert.equal(work.isbn, undefined, `${work.id}: ISBN não verificado`);
    if (work.imagemCapa) {
      assert.ok(work.origemImagem && work.licencaOuPermissaoImagem, `${work.id}: capa sem origem ou licença`);
    }
  }
});

test('collections and campaigns only reference catalog works', () => {
  assert.ok(editorial.colecoes.length >= 6);
  assert.equal(editorial.campanhas.length, 4);
  for (const group of [...editorial.colecoes, ...editorial.campanhas]) {
    assert.ok(group.obras.length > 0, group.id);
    for (const id of group.obras) assert.ok(ids.has(id), `${group.id} → ${id}`);
    assert.equal(new Set(group.obras).size, group.obras.length, `${group.id} repete obra`);
  }
  const collectionIds = new Set(editorial.colecoes.map(collection => collection.id));
  for (const campaign of editorial.campanhas) {
    if (campaign.filtro.colecao) assert.ok(collectionIds.has(campaign.filtro.colecao), campaign.id);
    assert.doesNotMatch(`${campaign.titulo} ${campaign.texto}`, /patrocin|parceri|oficial/i, campaign.id);
  }
});

test('anime adaptations are editorial references tied to catalog manga', () => {
  assert.ok(anime.adaptacoes.length >= 8 && anime.adaptacoes.length <= 12);
  for (const adaptation of anime.adaptacoes) {
    assert.match(adaptation.id, /^ANI-\d{2}$/);
    assert.equal(byId.get(adaptation.mangaId)?.categoria, 'Mangá', adaptation.id);
    assert.match(adaptation.referencia.url, /^https:\/\/anilist\.co\/anime\/\d+$/);
    assert.ok(adaptation.estudios.length > 0 && Number.isInteger(adaptation.anoEstreia));
    assert.ok(!ids.has(adaptation.id), 'anime não pode virar exemplar do catálogo');
  }
  const animeCollection = editorial.colecoes.find(collection => collection.id === 'manga-anime');
  assert.deepEqual([...animeCollection.obras].sort(), anime.adaptacoes.map(item => item.mangaId).sort());
});

test('catalog seed migration is generated from the manifest', () => {
  const output = execFileSync(process.execPath, ['scripts/seeds/generate-catalog-seed.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /em dia/);
  const sql = readFileSync(new URL('services/catalogo/src/main/resources/db/seed/V1001__catalogo_obras_reais.sql', root), 'utf8');
  assert.match(sql, /ON CONFLICT \(id\) DO NOTHING;/);
  assert.doesNotMatch(sql, /\b(DELETE|TRUNCATE|DROP)\b/);
});
