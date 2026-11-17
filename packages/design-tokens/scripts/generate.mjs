import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const rootDirectory = resolve(packageDirectory, '..', '..');
const input = resolve(packageDirectory, 'inko.tokens.json');
const output = resolve(rootDirectory, 'apps/web/app/inko-tokens.css');
const tokens = JSON.parse(readFileSync(input, 'utf8'));
const nodes = new Map();

function collect(value, parts = []) {
  if (value && typeof value === 'object' && '$type' in value) {
    const key = parts.join('.');
    assert.ok(key, 'Token without path');
    assert.ok(!nodes.has(key), `Duplicated token: ${key}`);
    nodes.set(key, value);
    return;
  }
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Invalid token group: ${parts.join('.')}`);
  for (const [name, child] of Object.entries(value)) collect(child, [...parts, name]);
}

collect(tokens);

function resolveValue(path, seen = new Set()) {
  const token = nodes.get(path);
  assert.ok(token, `Unknown token reference: ${path}`);
  assert.ok(!seen.has(path), `Cyclic token reference: ${path}`);
  if (typeof token.$value === 'string' && /^\{[^{}]+\}$/.test(token.$value)) {
    const referenced = token.$value.slice(1, -1);
    assert.equal(nodes.get(referenced)?.$type, token.$type, `Invalid alias type for ${path}`);
    return resolveValue(referenced, new Set([...seen, path]));
  }
  return token.$value;
}

function cssSlug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
}

function cssName(path) {
  const names = path.split('.');
  if (names[0] === 'semantic') names.shift();
  if (names[0] === 'space') names[0] = 'spacing';
  if (names[0] === 'typography') names[0] = 'type';
  return `--inko-${cssSlug(names.join('-'))}`;
}

function singleToken(value, path) {
  const token = nodes.get(path);
  if (typeof value === 'string' && /^\{[^{}]+\}$/.test(value)) {
    const target = value.slice(1, -1);
    assert.ok(nodes.has(target), `Unknown alias: ${target}`);
    return `var(${cssName(target)})`;
  }
  switch (token.$type) {
    case 'color':
      assert.match(value, /^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/, `Invalid color: ${path}`);
      return value;
    case 'dimension':
      assert.match(value, /^-?\d+(\.\d+)?px$/, `Invalid dimension: ${path}`);
      return value;
    case 'duration':
      assert.match(value, /^\d+(\.\d+)?(ms|s)$/, `Invalid duration: ${path}`);
      return value;
    case 'cubicBezier':
      assert.ok(Array.isArray(value) && value.length === 4 && value.every(Number.isFinite), `Invalid easing: ${path}`);
      return `cubic-bezier(${value.join(', ')})`;
    default:
      throw new Error(`Invalid scalar type: ${token.$type}`);
  }
}

function px(value, path) {
  assert.match(value, /^-?\d+(\.\d+)?px$/, `Invalid pixel value in ${path}`);
  return value;
}

function shadow(value, path) {
  const entries = Array.isArray(value) ? value : [value];
  assert.ok(entries.length > 0, `Empty shadow: ${path}`);
  return entries.map(entry => {
    assert.match(entry.color, /^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/, `Shadow requires 6/8-digit hex in ${path}`);
    return `${px(entry.offsetX, path)} ${px(entry.offsetY, path)} ${px(entry.blur, path)} ${px(entry.spread, path)} ${entry.color}`;
  }).join(', ');
}

const definitions = new Map();
function define(name, value) {
  assert.ok(!definitions.has(name), `CSS variable collision: ${name}`);
  definitions.set(name, value);
}

for (const [path, token] of nodes) {
  const value = token.$value;
  if (token.$type === 'typography') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Invalid typography: ${path}`);
    const properties = ['fontFamily', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'];
    for (const prop of properties) {
      assert.ok(prop in value, `Missing typography ${prop}: ${path}`);
      const cssProp = cssSlug(prop);
      const normalized = prop === 'fontFamily' ? `'${value[prop]}', sans-serif` : String(value[prop]);
      define(`${cssName(path)}-${cssProp}`, normalized);
    }
  } else if (token.$type === 'shadow') {
    define(cssName(path), shadow(value, path));
  } else {
    define(cssName(path), singleToken(value, path));
  }
}

const compatibility = [];
for (const [path, token] of nodes) {
  if (path.startsWith('space.')) {
    const size = Number.parseFloat(resolveValue(path));
    compatibility.push([`--inko-space-${size}`, `var(${cssName(path)})`]);
  }
  if (path.startsWith('radius.')) {
    const size = Number.parseFloat(resolveValue(path));
    compatibility.push([`--inko-radius-${size}`, `var(${cssName(path)})`]);
  }
  if (path.startsWith('semantic.status.') && path.endsWith('.fg')) {
    compatibility.push([cssName(path).replace(/-fg$/, '-ink'), `var(${cssName(path)})`]);
  }
}
compatibility.push(['--inko-easing-standard', 'var(--inko-easing-out)']);
for (const [name, value] of compatibility) define(name, value);

const result = `:root {\n${[...definitions].map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}\n`;
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), result, 'Tokens are out of sync: run npm run tokens:build');
  process.stdout.write(`Validated ${nodes.size} tokens and ${definitions.size} CSS custom properties.\n`);
} else {
  writeFileSync(output, result);
  process.stdout.write(`Generated ${definitions.size} CSS custom properties from ${nodes.size} source tokens.\n`);
}
