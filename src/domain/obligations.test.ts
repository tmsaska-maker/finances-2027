import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { balanceOf, validateBankAllocation, reconcileBankBalance } from './obligations.ts';
const obligation = {id:'rent-1', amountMinor:2000000, currency:'UAH' as const, dueDate:'2027-01-10'};
test('planned/submitted payments do not reduce the debt', () => {
  assert.deepEqual(balanceOf(obligation,[{id:'p1',obligationId:'rent-1',amountMinor:800000,currency:'UAH',state:'submitted'}]),{paidMinor:0,remainingMinor:2000000,overpaidMinor:0});
});
test('confirmed partial payment leaves correct outstanding debt', () => {
  assert.deepEqual(balanceOf(obligation,[{id:'p1',obligationId:'rent-1',amountMinor:800000,currency:'UAH',state:'confirmed',bankTransactionId:'bank-1'}]),{paidMinor:800000,remainingMinor:1200000,overpaidMinor:0});
});
test('two confirmed installments reconcile correctly', () => {
  const payments=[800000,1200000].map((amountMinor,i)=>({id:`p${i}`,obligationId:'rent-1',amountMinor,currency:'UAH' as const,state:'confirmed' as const,bankTransactionId:`bank-${i}`}));
  assert.equal(balanceOf(obligation,payments).remainingMinor,0);
});
test('confirmed payment without bank source is rejected', () => {
  assert.throws(()=>balanceOf(obligation,[{id:'p1',obligationId:'rent-1',amountMinor:100,currency:'UAH',state:'confirmed'}]),/bank transaction/);
});
test('duplicate IDs are blocked', () => {
  assert.throws(()=>balanceOf(obligation,[{id:'p1',obligationId:'rent-1',amountMinor:100,currency:'UAH',state:'planned'},{id:'p1',obligationId:'rent-1',amountMinor:100,currency:'UAH',state:'submitted'}]),/Duplicate/);
});
test('cross-currency settlement requires explicit conversion', () => {
  assert.throws(()=>balanceOf(obligation,[{id:'p1',obligationId:'rent-1',amountMinor:100,currency:'USD',state:'submitted'}]),/currency/);
});
test('one bank transaction must be fully and uniquely allocated', () => {
  assert.equal(validateBankAllocation(10000,[4000,6000]),true);
  assert.equal(validateBankAllocation(10000,[6000,6000]),false);
});
test('bank balances reconcile without counting a transfer as income', () => {
  assert.equal(reconcileBankBalance(10000,5000,3000,12000),true);
  assert.equal(reconcileBankBalance(10000,5000,3000,13000),false);
});
