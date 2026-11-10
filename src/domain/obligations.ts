/** Pure financial calculations: minor units (kopiykas/cents), no bank or UI side effects. */
export type Currency = 'UAH' | 'USD' | 'EUR';
export type PaymentState = 'planned' | 'submitted' | 'confirmed' | 'rejected';
export interface Obligation {
  id: string;
  amountMinor: number;
  currency: Currency;
  dueDate: string;
}
export interface Payment {
  id: string;
  obligationId: string;
  amountMinor: number;
  currency: Currency;
  state: PaymentState;
  bankTransactionId?: string;
}
function checkAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Amount must be nonnegative safe integer in minor units');
}
export function balanceOf(obligation: Obligation, payments: Payment[]) {
  checkAmount(obligation.amountMinor);
  const seen = new Set<string>();
  let paidMinor = 0;
  for (const payment of payments) {
    if (payment.obligationId !== obligation.id) continue;
    if (seen.has(payment.id)) throw new Error(`Duplicate payment ID: ${payment.id}`);
    seen.add(payment.id);
    checkAmount(payment.amountMinor);
    if (payment.currency !== obligation.currency) throw new Error('Payment currency mismatch');
    if (payment.state === 'confirmed') {
      if (!payment.bankTransactionId) throw new Error('Confirmed payment requires bank transaction reference');
      paidMinor += payment.amountMinor;
    }
  }
  if (!Number.isSafeInteger(paidMinor)) throw new Error('Amount exceeds safe integer range');
  return { paidMinor, remainingMinor: obligation.amountMinor - paidMinor, overpaidMinor: Math.max(0, paidMinor - obligation.amountMinor) };
}
export function validateBankAllocation(transactionAmountMinor: number, allocatedMinor: number[]) {
  checkAmount(transactionAmountMinor);
  let total = 0;
  for (const allocated of allocatedMinor) { checkAmount(allocated); total += allocated; }
  return Number.isSafeInteger(total) && total === transactionAmountMinor;
}
export function reconcileBankBalance(openingMinor: number, inflowsMinor: number, outflowsMinor: number, closingMinor: number) {
  for (const n of [openingMinor, inflowsMinor, outflowsMinor, closingMinor]) checkAmount(n);
  return openingMinor + inflowsMinor - outflowsMinor === closingMinor;
}
