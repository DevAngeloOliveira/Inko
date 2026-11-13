import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEMO_REFERENCE_DATE, activeLateLoans, addDays, availabilityOf, daysOverdue, fineInCents, formatBRL,
  libraryUsers, loanStatus, loans, parseBRDate, totalFineCents, workLabel, works,
} from '../lib/demo.ts';

test('seed is referentially consistent', () => {
  const workIds = new Set(works.map(work => work.id));
  const userIds = new Set(libraryUsers.map(user => user.id));
  assert.equal(workIds.size, works.length);
  assert.equal(userIds.size, libraryUsers.length);
  for (const loan of loans) {
    assert.ok(workIds.has(loan.workId), `${loan.id} → ${loan.workId}`);
    assert.ok(userIds.has(loan.userId), `${loan.id} → ${loan.userId}`);
    const work = works.find(item => item.id === loan.workId);
    assert.equal(loan.work, workLabel(work));
    assert.equal(loan.user, libraryUsers.find(item => item.id === loan.userId).name);
  }
  const activeWorks = loans.filter(loan => !loan.returnedAt).map(loan => loan.workId);
  assert.equal(new Set(activeWorks).size, activeWorks.length, 'uma obra não pode ter dois empréstimos ativos');
});

test('fine report matches the design: 4 active overdue loans, R$ 96,00', () => {
  const late = activeLateLoans(loans, DEMO_REFERENCE_DATE);
  assert.deepEqual(late.map(loan => [loan.id, loan.days]), [['EMP-10288', 20], ['EMP-10302', 15], ['EMP-10311', 10], ['EMP-10334', 3]]);
  assert.equal(totalFineCents(loans, DEMO_REFERENCE_DATE), 9600);
  assert.equal(formatBRL(9600).replace(/\s/g, ' '), 'R$ 96,00');
});

test('returned loans never enter the fine report', () => {
  const returned = loans.map(loan => ({ ...loan, returnedAt: DEMO_REFERENCE_DATE }));
  assert.equal(activeLateLoans(returned, '2027-01-01').length, 0);
  assert.equal(totalFineCents(returned, '2027-01-01'), 0);
});

test('fine is R$ 2,00 per whole day and never negative', () => {
  assert.equal(fineInCents(0), 0);
  assert.equal(fineInCents(3), 600);
  assert.equal(fineInCents(-4), 0);
  assert.equal(daysOverdue('2026-11-11', DEMO_REFERENCE_DATE), 0);
  assert.equal(daysOverdue('2026-10-25', DEMO_REFERENCE_DATE), 15);
});

test('availability and circulation status derive from loans', () => {
  assert.equal(availabilityOf(loans, 'INK-0001', DEMO_REFERENCE_DATE), 'atr');
  assert.equal(availabilityOf(loans, 'INK-0002', DEMO_REFERENCE_DATE), 'emp');
  assert.equal(availabilityOf(loans, 'INK-0004', DEMO_REFERENCE_DATE), 'disp');
  assert.equal(loanStatus(loans.find(loan => loan.id === 'EMP-10270'), DEMO_REFERENCE_DATE), 'dev');
});

test('date helpers validate real calendar dates', () => {
  assert.equal(parseBRDate('09/11/2026'), '2026-11-09');
  assert.equal(parseBRDate('31/02/2026'), null);
  assert.equal(parseBRDate('2026-11-09'), null);
  assert.equal(addDays('2026-11-09', 14), '2026-11-23');
  assert.equal(addDays('2026-12-25', 14), '2027-01-08');
});
