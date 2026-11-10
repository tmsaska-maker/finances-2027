import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  balanceOf,
  validateBankAllocation,
  validateAllocationIds,
  reconcileBankBalance,
} from './obligations.ts';
const obligation = { id: 'rent-demo', amountMinor: 2_000_000, currency: 'UAH' as const, dueDate: '2027-01-10' };
const payment = (id: string, amountMinor: number, state: 'planned' | 'submitted' | 'confirmed' | 'rejected' = 'confirmed') => ({
  id, obligationId: obligation.id, amountMinor, currency: 'UAH' as const,
  state, ...(state === 'confirmed' ? { bankTransactionId: `bank-${id}` } : {}),
});
test('planned and submitted are not payments in bank reconciliation', () => {
  assert.deepEqual(balanceOf(obligation, [payment('p1', 800_000, 'planned'), payment('p2', 800_000, 'submitted')]),
    { paidMinor: 0, remainingMinor: 2_000_000, overpaidMinor: 0 });
});
test('rejected payments never settle the debt', () => {
  assert.equal(balanceOf(obligation, [payment('p1', 800_000, 'rejected')]).remainingMinor, 2_000_000);
});
test('confirmed partial payment reduces only its amount', () => {
  assert.deepEqual(balanceOf(obligation, [payment('p1', 800_000)]),
    { paidMinor: 800_000, remainingMinor: 1_200_000, overpaidMinor: 0 });
});
test('two confirmed installments close an obligation', () => {
  assert.equal(balanceOf(obligation, [payment('p1', 800_000), payment('p2', 1_200_000)]).remainingMinor, 0);
});
test('overpayments are tracked explicitly without negative debt', () => {
  assert.deepEqual(balanceOf(obligation, [payment('p1', 2_100_000)]),
    { paidMinor: 2_100_000, remainingMinor: 0, overpaidMinor: 100_000 });
});
test('bank reference required to confirm a settlement', () => {
  assert.throws(() => balanceOf(obligation, [{ id: 'p', obligationId: obligation.id, amountMinor: 100, currency: 'UAH', state: 'confirmed' }]), /bank transaction reference/);
});
test('payment ID duplication is rejected', () => {
  assert.throws(() => balanceOf(obligation, [payment('p', 100), payment('p', 100)]), /Duplicate payment/);
});
test('a settlement cannot cross currencies without an FX entry', () => {
  assert.throws(() => balanceOf(obligation, [{ ...payment('p', 100), currency: 'USD' as const }]), /currency mismatch/);
});
test('negative or fractional money is rejected', () => {
  assert.throws(() => balanceOf(obligation, [payment('p', -1)]), /nonnegative safe integer/);
  assert.throws(() => balanceOf(obligation, [payment('p', 12.5)]), /nonnegative safe integer/);
});
test('unsafe integer overflow is rejected', () => {
  assert.throws(() => balanceOf({ ...obligation, amountMinor: Number.MAX_SAFE_INTEGER }, [payment('p1', Number.MAX_SAFE_INTEGER), payment('p2', 1)]), /safe integer range/);
});
test('bank amount must equal sum of allocations', () => {
  assert.equal(validateBankAllocation(10_000, [4_000, 6_000]), true);
  assert.equal(validateBankAllocation(10_000, [4_000, 5_999]), false);
});
test('duplicate allocation IDs across obligations are detected', () => {
  assert.throws(() => validateAllocationIds([payment('p1', 500), { ...payment('p1', 500), obligationId: 'another' }]), /Duplicate payment/);
});
test('one bank transaction may allocate to two different obligations with distinct allocation IDs', () => {
  const a = payment('p1', 4_000);
  const b = { ...payment('p2', 6_000), obligationId: 'another', bankTransactionId: a.bankTransactionId };
  assert.doesNotThrow(() => validateAllocationIds([a, b]));
  assert.equal(validateBankAllocation(10_000, [a.amountMinor, b.amountMinor]), true);
});
test('bank balance equation matches opening + credits - debits', () => {
  assert.equal(reconcileBankBalance(10_000, 5_000, 3_000, 12_000), true);
  assert.equal(reconcileBankBalance(10_000, 5_000, 3_000, 13_000), false);
});
