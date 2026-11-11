import { assertMoneyMinor, balanceOf, type Currency, type Obligation, type Payment } from './obligations.ts';

/** Versioned financial records. Never use this module for real user data without authenticated server storage. */
export type Project = 'ambulatory' | 'screening' | 'psychotherapy' | 'personal';
export type TransactionKind = 'income' | 'expense' | 'transfer';
export interface Transaction {
  id: string;
  project: Project;
  accountId: string;
  amountMinor: number;
  currency: Currency;
  kind: TransactionKind;
  occurredOn: string;
  sourceId: string;
}
export interface ObligationRecord extends Obligation { project: Project }
export interface Ledger {
  schemaVersion: 1;
  transactions: Transaction[];
  obligations: ObligationRecord[];
  payments: Payment[];
}
export const emptyLedger = (): Ledger => ({ schemaVersion: 1, transactions: [], obligations: [], payments: [] });

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected record');
  return value as Record<string, unknown>;
}
function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid ' + field);
  return value;
}
function currency(value: unknown): Currency {
  if (value !== 'UAH' && value !== 'USD' && value !== 'EUR') throw new Error('Unsupported currency');
  return value;
}
function project(value: unknown): Project {
  if (value !== 'ambulatory' && value !== 'screening' && value !== 'psychotherapy' && value !== 'personal') throw new Error('Invalid project');
  return value;
}
function day(value: unknown): string {
  const s = nonEmpty(value, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + 'T00:00:00Z')) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw new Error('Invalid ISO date');
  return s;
}
function amount(value: unknown): number {
  if (typeof value !== 'number') throw new Error('Amount must be numeric');
  assertMoneyMinor(value);
  return value;
}
function uniqueIds<T extends { id: string }>(items: T[], name: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error('Duplicate ' + name + ' ID');
    ids.add(item.id);
  }
}
/** Parses and revalidates every stored record; rejects unknown versions instead of silently discarding data. */
export function parseLedger(input: unknown): Ledger {
  const doc = record(input);
  if (doc.schemaVersion !== 1) throw new Error('Unsupported ledger schema version');
  for (const key of ['transactions', 'obligations', 'payments']) {
    if (!Array.isArray(doc[key])) throw new Error('Missing ledger collection: ' + key);
  }
  const transactions: Transaction[] = (doc.transactions as unknown[]).map(x => {
    const v = record(x);
    if (!['income', 'expense', 'transfer'].includes(String(v.kind))) throw new Error('Invalid transaction kind');
    return { id: nonEmpty(v.id, 'transaction id'), project: project(v.project), accountId: nonEmpty(v.accountId, 'account'), amountMinor: amount(v.amountMinor), currency: currency(v.currency), kind: v.kind as TransactionKind, occurredOn: day(v.occurredOn), sourceId: nonEmpty(v.sourceId, 'source') };
  });
  const obligations: ObligationRecord[] = (doc.obligations as unknown[]).map(x => {
    const v = record(x);
    return { id: nonEmpty(v.id, 'obligation id'), project: project(v.project), amountMinor: amount(v.amountMinor), currency: currency(v.currency), dueDate: day(v.dueDate) };
  });
  const payments: Payment[] = (doc.payments as unknown[]).map(x => {
    const v = record(x);
    if (!['planned', 'submitted', 'confirmed', 'rejected'].includes(String(v.state))) throw new Error('Invalid payment state');
    return { id: nonEmpty(v.id, 'payment id'), obligationId: nonEmpty(v.obligationId, 'obligation id'), amountMinor: amount(v.amountMinor), currency: currency(v.currency), state: v.state as Payment['state'], ...(v.bankTransactionId === undefined ? {} : { bankTransactionId: nonEmpty(v.bankTransactionId, 'bank transaction id') }) };
  });
  uniqueIds(transactions, 'transaction');
  uniqueIds(obligations, 'obligation');
  uniqueIds(payments, 'payment');
  const sourceIds = new Set<string>();
  for (const transaction of transactions) {
    const key = [transaction.accountId, transaction.sourceId].join('\u0000');
    if (sourceIds.has(key)) throw new Error('Duplicate bank source within account');
    sourceIds.add(key);
  }
  const byObligation = new Map(obligations.map(x => [x.id, x]));
  for (const payment of payments) {
    const obligation = byObligation.get(payment.obligationId);
    if (!obligation) throw new Error('Orphan payment');
    if (payment.currency !== obligation.currency) throw new Error('Payment currency mismatch');
    if (payment.state === 'confirmed') {
      if (!payment.bankTransactionId) throw new Error('Confirmed payment missing bank reference');
      const linked = transactions.filter(x => x.sourceId === payment.bankTransactionId && x.currency === payment.currency && x.kind === 'expense' && x.project === obligation.project);
      if (!linked.length) throw new Error('Confirmed payment has no matching expense bank record');
    }
  }
  for (const obligation of obligations) balanceOf(obligation, payments);
  return { schemaVersion: 1, transactions, obligations, payments };
}
