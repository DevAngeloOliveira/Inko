// Gera a migração de seed do Catálogo a partir de data/seeds/catalogo-obras.json.
// Uso: node scripts/seeds/generate-catalog-seed.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('data/seeds/catalogo-obras.json', root), 'utf8'));
const target = new URL('services/catalogo/src/main/resources/db/seed/V1001__catalogo_obras_reais.sql', root);

// Valores fictícios gravados pela V1000; a troca só acontece se o registro ainda estiver intocado.
const FICTIONAL = {
  'INK-0001': ['Maré de Tinta', 'Aiko Tanabe'], 'INK-0002': ['O Último Ronin', 'Kenji Arata'],
  'INK-0003': ['Capitão Ferrugem', 'Rafael Moura'], 'INK-0004': ['Kitsune Express', 'Haru Mizuki'],
  'INK-0005': ['Jardim de Aço', 'Sora Ikeda'], 'INK-0006': ['Noite Sem Lua', 'Lia Sato'],
  'INK-0007': ['Liga dos Faróis', 'Bruno Teles'], 'INK-0008': ['Pétalas de Ferro', 'Mei Kurogane'],
  'INK-0009': ['Kitsune Express', 'Haru Mizuki'], 'INK-0010': ['Liga dos Faróis', 'Bruno Teles'],
  'INK-0011': ['Jardim de Aço', 'Sora Ikeda'], 'INK-0012': ['Maré de Tinta', 'Aiko Tanabe'],
};

const sql = value => (value === undefined || value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);
const row = work => [work.id, work.titulo, work.autorOuCriador, work.categoria, work.volumeOuEdicao, null, work.tituloOriginal];

const updates = manifest.obras.filter(work => FICTIONAL[work.id]).map(work => {
  const [title, author] = FICTIONAL[work.id];
  return `UPDATE livros SET titulo = ${sql(work.titulo)}, autor = ${sql(work.autorOuCriador)}, categoria = ${sql(work.categoria)}, `
    + `volume = ${sql(work.volumeOuEdicao)}, editora = NULL, titulo_original = ${sql(work.tituloOriginal)}\n`
    + `WHERE id = ${sql(work.id)} AND titulo = ${sql(title)} AND autor = ${sql(author)};`;
});

const inserts = manifest.obras.map(work => `    (${row(work).map(sql).join(', ')})`);

const content = `-- Gerado por scripts/seeds/generate-catalog-seed.mjs a partir de data/seeds/catalogo-obras.json. Não edite à mão.
-- Substitui as obras fictícias da V1000 apenas quando ainda estão intactas e acrescenta o catálogo curado.
-- Idempotente: nenhum registro cadastrado pela aplicação é alterado ou removido.

${updates.join('\n\n')}

INSERT INTO livros (id, titulo, autor, categoria, volume, editora, titulo_original) VALUES
${inserts.join(',\n')}
ON CONFLICT (id) DO NOTHING;
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8').replaceAll('\r\n', '\n');
  if (current !== content) {
    console.error('Seed do Catálogo desatualizado: rode node scripts/seeds/generate-catalog-seed.mjs');
    process.exit(1);
  }
  console.log(`Seed do Catálogo em dia (${manifest.obras.length} obras).`);
} else {
  writeFileSync(target, content);
  console.log(`Gerado ${fileURLToPath(target)} com ${manifest.obras.length} obras.`);
}
