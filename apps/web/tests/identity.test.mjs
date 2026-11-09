import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const stylesheet = readFileSync(new URL('../app/inko-tokens.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const motions = readFileSync(new URL('../app/inko-motion.css', import.meta.url), 'utf8');

test('INKO foundation tokens reflect the approved brand', () => {
  assert.match(stylesheet, /--inko-brand-ink: #111111;/);
  assert.match(stylesheet, /--inko-brand-paper: #F7F3ED;/);
  assert.match(stylesheet, /--inko-brand-seal: #C43B2F;/);
});

test('CSS consumes generated tokens rather than redefining brand colors', () => {
  assert.match(globals, /@import '\.\/inko-tokens\.css';/);
  assert.match(globals, /var\(--inko-background-default\)/);
});

test('reduced motion users do not receive entrance animations', () => {
  assert.match(motions, /prefers-reduced-motion: reduce/);
  assert.match(motions, /animation: none !important/);
});
