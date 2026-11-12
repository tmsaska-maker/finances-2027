/**
 * Temporary browser-only test data, never for actual personal or business finances.
 * Kept separate from the production PostgreSQL ledger and API.
 */
export type DemoExpenseStatus = 'planned' | 'due' | 'partial' | 'paid';
export type DemoProject = 'Амбулаторія' | 'Скринінг' | 'Психотерапія';
export interface DemoExpense {
  id: number;
  counterparty: string;
  category: string;
  project: DemoProject;
  amount: number; // display UAH, strict two-decimal precision
  due: string;
  bank: string;
  status: DemoExpenseStatus;
  paid: number;
  note: string;
}
export interface DemoPending {
  id: number;
  obligationId: number;
  date: string;
  amount: number;
  bank: string;
  note: string;
}
export interface DemoSession {
  version: 1;
  items: DemoExpense[];
  pending: DemoPending[];
}
export const DEMO_SESSION_KEY = 'finances-2027:expenses-demo-v1';
function object(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw Error('Невірний формат записів');
  return v as Record<string, unknown>;
}
function string(v: unknown, name: string, max = 300): string {
  if (typeof v !== 'string' || v.length > max) throw Error('Невірне поле: ' + name);
  return v;
}
function id(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) < 1) throw Error('Невірний ідентифікатор');
  return v as number;
}
export function toKopiykas(value: string): number {
  const text = value.trim().replace(',', '.');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw Error('Сума повинна бути числом із максимум двома знаками після коми');
  const [whole, fraction = ''] = text.split('.');
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(number)) throw Error('Сума надто велика');
  return number;
}
export function toMinor(value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw Error('Сума має містити не більше двох знаків після коми');
  }
  return Math.round(value * 100);
}
export function validDay(v: unknown): string {
  const s = string(v, 'дата', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z')) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error('Неправильна дата');
  return s;
}
export function parseDemoSession(value: unknown): DemoSession {
  const s = object(value);
  if (s.version !== 1) throw Error('Невідома версія тестових даних: нічого не перезаписано');
  if (!Array.isArray(s.items) || !Array.isArray(s.pending)) throw Error('Невірний склад збережених даних');
  const items: DemoExpense[] = s.items.map(v => {
    const x = object(v);
    const project = x.project;
    const status = x.status;
    if (project !== 'Амбулаторія' && project !== 'Скринінг' && project !== 'Психотерапія') throw Error('Невідомий напрям');
    if (status !== 'planned' && status !== 'due' && status !== 'partial' && status !== 'paid') throw Error('Невідомий статус');
    const amount = x.amount as number;
    const paid = x.paid as number;
    const amountMinor = toMinor(amount);
    const paidMinor = toMinor(paid);
    if (amountMinor <= 0 || paidMinor > amountMinor) throw Error('Оплата не може перевищувати зобов’язання');
    return {id:id(x.id), counterparty:string(x.counterparty, 'назва'), category:string(x.category, 'категорія'),project,amount,due:validDay(x.due),bank:string(x.bank, 'банк'),status,paid,note:string(x.note, 'примітка', 1000)};
  });
  const itemIds = new Set<number>();
  for (const item of items) {
    if (itemIds.has(item.id)) throw Error('Повторний ID зобов’язання');
    itemIds.add(item.id);
  }
  const pending: DemoPending[] = s.pending.map(v => {
    const x = object(v);
    const amount = x.amount as number;
    if (toMinor(amount) <= 0) throw Error('Платіж має бути додатним');
    if (!itemIds.has(id(x.obligationId))) throw Error('Платіж без зобов’язання');
    return {id:id(x.id),obligationId:id(x.obligationId),date:validDay(x.date),amount,bank:string(x.bank,'банк'),note:string(x.note,'примітка',1000)};
  });
  const pendingIds = new Set<number>();
  for (const p of pending) {
    if (pendingIds.has(p.id)) throw Error('Повторний ID платежу');
    pendingIds.add(p.id);
  }
  for (const item of items) {
    const queued = pending.filter(p => p.obligationId === item.id).reduce((sum,p) => sum + toMinor(p.amount), 0);
    if (!Number.isSafeInteger(queued) || queued + toMinor(item.paid) > toMinor(item.amount)) throw Error('Платежі перевищують залишок зобов’язання');
  }
  return {version:1, items, pending};
}
export interface DemoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function readDemoSession(store: DemoStorage): DemoSession | null {
  const raw = store.getItem(DEMO_SESSION_KEY);
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error('Тестові дані пошкоджені: нічого не перезаписано'); }
  return parseDemoSession(value);
}
export function saveDemoSession(store: DemoStorage, data: DemoSession): DemoSession {
  // Refuse overwrites when the existing session is corrupt or from a later version.
  readDemoSession(store);
  const checked = parseDemoSession(data);
  store.setItem(DEMO_SESSION_KEY, JSON.stringify(checked));
  return checked;
}
