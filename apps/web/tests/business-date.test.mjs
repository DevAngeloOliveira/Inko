import assert from 'node:assert/strict';
import { test } from 'node:test';
import { businessDate } from '../lib/business-date.ts';

test('o calendário da biblioteca vira o ano à meia-noite de São Paulo', () => {
  assert.equal(businessDate(new Date('2027-01-01T02:59:59Z')), '2026-12-31');
  assert.equal(businessDate(new Date('2027-01-01T03:00:00Z')), '2027-01-01');
});
