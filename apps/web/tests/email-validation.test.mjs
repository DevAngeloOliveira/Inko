import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidEmailAddress } from '../lib/validation.ts';

test('accepts valid addresses with domain and suffix', () => {
  assert.equal(isValidEmailAddress('leitor@inko.com.br'), true);
  assert.equal(isValidEmailAddress('maria.silva@exemplo.com'), true);
});

test('rejects missing separators, whitespace and consecutive dots', () => {
  for (const value of ['', 'test', '@example.com', 'x@y', 'x@y.', 'x@.com', 'x@@y.com', 'x@y..com', ' x@y.com', 'x@y.com ']) {
    assert.equal(isValidEmailAddress(value), false, value);
  }
});

test('handles long malicious inputs without regex backtracking', () => {
  assert.equal(isValidEmailAddress('a@' + 'a'.repeat(150000) + '.'), false);
  assert.equal(isValidEmailAddress('a@' + 'a'.repeat(150000) + '.com'), true);
});
