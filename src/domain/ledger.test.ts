import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseLedger, emptyLedger } from './ledger.ts';
import { LedgerStore, MemoryStore, DEMO_KEY } from './ledger-store.ts';

const obligation = { id: 'bill', project: 'ambulatory' as const, amountMinor: 50000, currency: 'UAH' as const, dueDate: '2026-11-30' };
const bankExpense = { id: 'tx1', project: 'ambulatory' as const, accountId: 'main', amountMinor: 15000, currency: 'UAH' as const, kind: 'expense' as const, occurredOn: '2026-11-11', sourceId: 'bank1' };
const paid = { id: 'p1', obligationId: 'bill', amountMinor: 15000, currency: 'UAH' as const, state: 'confirmed' as const, bankTransactionId: 'bank1' };
const sample = () => ({ schemaVersion: 1 as const, obligations: [obligation], transactions: [bankExpense], payments: [paid] });
test('empty store starts at schema v1 and survives a reload', () => {
  const storage = new MemoryStore(), a = new LedgerStore(storage), b = new LedgerStore(storage);
  assert.deepEqual(a.load(), emptyLedger());
  a.save(sample());
  assert.deepEqual(b.load(), sample());
});
test('a confirmed partial payment requires a linked bank expense', () => {
  assert.throws(() => parseLedger({ ...sample(), transactions: [] }), /matching expense/);
});
test('submitted payment can exist without bank reference and does not settle debt', () => {
  assert.doesNotThrow(() => parseLedger({ ...sample(), transactions: [], payments: [{ ...paid, state: 'submitted', bankTransactionId: undefined }] }));
});
test('duplicate bank source is forbidden within one account', () => {
  assert.throws(() => parseLedger({ ...sample(), transactions: [bankExpense, { ...bankExpense, id: 'tx2' }] }), /Duplicate bank source/);
});
test('bank references may be identical in two distinct accounts', () => {
  assert.doesNotThrow(() => parseLedger({ ...sample(), transactions: [bankExpense, { ...bankExpense, id: 'tx2', accountId: 'other' }] }));
});
test('invalid money, unsupported currency and bad date are rejected', () => {
  assert.throws(() => parseLedger({ ...sample(), obligations: [{ ...obligation, amountMinor: 12.5 }] }), /safe integer/);
  assert.throws(() => parseLedger({ ...sample(), obligations: [{ ...obligation, currency: 'GBP' }] }), /currency/);
  assert.throws(() => parseLedger({ ...sample(), obligations: [{ ...obligation, dueDate: '2026-02-30' }] }), /ISO date/);
});
test('orphan payment or repeated IDs fail validation', () => {
  assert.throws(() => parseLedger({ ...sample(), payments: [{ ...paid, obligationId: 'unknown' }] }), /Orphan/);
  assert.throws(() => parseLedger({ ...sample(), obligations: [obligation, obligation] }), /Duplicate obligation/);
});
test('unsupported future schema never overwrites existing storage', () => {
  const storage = new MemoryStore();
  storage.setItem(DEMO_KEY, JSON.stringify({ schemaVersion: 2, transactions: [], payments: [], obligations: [] }));
  const ledger = new LedgerStore(storage);
  assert.throws(() => ledger.save(emptyLedger()), /Unsupported ledger schema/);
  assert.match(storage.getItem(DEMO_KEY)!, /"schemaVersion":2/);
});
test('invalid JSON remains untouched for recovery', () => {
  const storage = new MemoryStore();
  storage.setItem(DEMO_KEY, '{invalid');
  assert.throws(() => new LedgerStore(storage).load(), /data preserved/);
  assert.equal(storage.getItem(DEMO_KEY), '{invalid');
});
test('failed transaction keeps previous snapshot unchanged', () => {
  const storage = new MemoryStore(), ledger = new LedgerStore(storage);
  ledger.save(sample());
  const original = storage.getItem(DEMO_KEY);
  assert.throws(() => ledger.update(x => ({ ...x, transactions: [] })), /matching expense/);
  assert.equal(storage.getItem(DEMO_KEY), original);
});
test('a valid update is persisted and can be read by a second instance', () => {
  const storage = new MemoryStore(), a = new LedgerStore(storage);
  a.save(sample());
  a.update(x => ({ ...x, obligations: [{ ...x.obligations[0], amountMinor: 65000 }] }));
  assert.equal(new LedgerStore(storage).load().obligations[0].amountMinor, 65000);
});
