import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

const base = new URL('../', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('../inko.tokens.json', import.meta.url), 'utf8'));
const figma = JSON.parse(readFileSync(new URL('../source/figma-variables.claude.json', import.meta.url), 'utf8'));
const generated = readFileSync(new URL('../../../apps/web/app/inko-tokens.css', import.meta.url), 'utf8');

function leaves(value, prefix = [], result = new Map()) {
  if ('$type' in value) {
    result.set(prefix.join('.'), value);
  } else {
    for (const [key, child] of Object.entries(value)) leaves(child, [...prefix, key], result);
  }
  return result;
}

const byPath = leaves(tokens);
function resolveToken(path, trail = new Set()) {
  const token = byPath.get(path);
  assert.ok(token, `Missing token ${path}`);
  assert.ok(!trail.has(path), `Cyclic alias ${path}`);
  const value = token.$value;
  return typeof value === 'string' && /^\{[^{}]+\}$/.test(value)
    ? resolveToken(value.slice(1, -1), new Set([...trail, path]))
    : value;
}

test('the Claude handoff exports match the source DTCG values', () => {
  const exported = figma.collections.flatMap(collection => collection.variables);
  assert.equal(exported.length, 52);
  for (const variable of exported) {
    const path = variable.name.replaceAll('/', '.');
    const source = byPath.get(path);
    assert.ok(source, `Missing source: ${path}`);
    const actual = variable.values.Light;
    const expected = resolveToken(path);
    if (variable.type === 'COLOR') assert.equal(actual.toLowerCase(), expected.toLowerCase(), path);
    else assert.equal(actual, Number.parseFloat(expected), path);
  }
});

test('the complete token source contains all 73 Claude tokens', () => {
  assert.equal(byPath.size, 73);
  assert.equal([...byPath.values()].filter(x => x.$type === 'typography').length, 10);
  assert.equal([...byPath.values()].filter(x => x.$type === 'shadow').length, 4);
  assert.equal([...byPath.values()].filter(x => x.$type === 'duration').length, 4);
  assert.equal([...byPath.values()].filter(x => x.$type === 'cubicBezier').length, 3);
});

test('the Figma px-based spacing aliases do not conflict with the Claude scale', () => {
  assert.match(generated, /--inko-spacing-4: 16px;/);
  assert.match(generated, /--inko-space-4: var\(--inko-spacing-1\);/);
  assert.match(generated, /--inko-space-16: var\(--inko-spacing-4\);/);
});

test('generated CSS references only defined custom properties', () => {
  const definitions = [...generated.matchAll(/(^|\n)\s*(--inko-[a-z0-9-]+):/g)].map(match => match[2]);
  assert.equal(definitions.length, new Set(definitions).size);
  const declared = new Set(definitions);
  for (const match of generated.matchAll(/var\((--inko-[a-z0-9-]+)\)/g)) {
    assert.ok(declared.has(match[1]), `Undeclared CSS variable: ${match[1]}`);
  }
});

test('committed CSS stays reproducible from the token source', () => {
  const result = execFileSync(process.execPath, [new URL('../scripts/generate.mjs', import.meta.url).pathname, '--check']);
  assert.match(result.toString(), /Validated 73 tokens/);
});
