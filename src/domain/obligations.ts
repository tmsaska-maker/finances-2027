/**
 * Pure finance domain functions. Amounts use integer minor currency units:
 * kopiykas (UAH), cents (USD/EUR). Never use floats for money.
 * No personal data, API keys, React or bank side effects belong here.
 */
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
export interface Settlement {
  paidMinor: number;
  remainingMinor: number;
  overpaidMinor: number;
}
export function assertMoneyMinor(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Amount must be a nonnegative safe integer in minor units');
  }
}
function checkedSum(items: number[]): number {
  let total = 0;
  for (const amount of items) {
    assertMoneyMinor(amount);
    total += amount;
    if (!Number.isSafeInteger(total)) throw new Error('Amount exceeds safe integer range');
  }
  return total;
}
/**
 * Only reconciled, bank-linked payments settle a debt.
 * Submitted/planned/rejected payments don't change the balance.
 * An overpayment is reported separately; remainingMinor never goes below zero.
 */
export function balanceOf(obligation: Obligation, payments: Payment[]): Settlement {
  assertMoneyMinor(obligation.amountMinor);
  const seenPaymentIds = new Set<string>();
  const confirmedAmounts: number[] = [];
  for (const payment of payments) {
    if (payment.obligationId !== obligation.id) continue;
    if (!payment.id.trim()) throw new Error('Payment ID is required');
    if (seenPaymentIds.has(payment.id)) throw new Error(`Duplicate payment ID: ${payment.id}`);
    seenPaymentIds.add(payment.id);
    assertMoneyMinor(payment.amountMinor);
    if (payment.currency !== obligation.currency) throw new Error('Payment currency mismatch');
    if (payment.state === 'confirmed') {
      if (!payment.bankTransactionId?.trim()) {
        throw new Error('Confirmed payment requires bank transaction reference');
      }
      confirmedAmounts.push(payment.amountMinor);
    }
  }
  const paidMinor = checkedSum(confirmedAmounts);
  return {
    paidMinor,
    remainingMinor: Math.max(0, obligation.amountMinor - paidMinor),
    overpaidMinor: Math.max(0, paidMinor - obligation.amountMinor),
  };
}
/** Amount of a bank movement allocated between subrecords must match exactly. */
export function validateBankAllocation(
  transactionAmountMinor: number,
  allocatedMinor: number[],
): boolean {
  assertMoneyMinor(transactionAmountMinor);
  return checkedSum(allocatedMinor) === transactionAmountMinor;
}
/** Per-account check; internal transfers are not classified here as revenue. */
export function reconcileBankBalance(
  openingMinor: number,
  inflowsMinor: number,
  outflowsMinor: number,
  closingMinor: number,
): boolean {
  const gross = checkedSum([openingMinor, inflowsMinor]);
  assertMoneyMinor(outflowsMinor);
  assertMoneyMinor(closingMinor);
  return gross - outflowsMinor === closingMinor;
}
/** Each allocation must have its own ID; sharing a bank transaction ID is allowed when splitting one transaction. */
export function validateAllocationIds(payments: Payment[]): void {
  const seenIds = new Set<string>();
  for (const payment of payments) {
    if (!payment.id.trim()) throw new Error('Payment ID is required');
    if (seenIds.has(payment.id)) throw new Error(`Duplicate payment ID: ${payment.id}`);
    seenIds.add(payment.id);
  }
}
