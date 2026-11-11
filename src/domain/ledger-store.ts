import { emptyLedger, parseLedger, type Ledger } from './ledger.ts';

/** Thin storage port: memory for tests, browser adapter only for synthetic demos. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const DEMO_KEY = 'finances-2027:demo-ledger-v1';
export class LedgerStore {
  private readonly storage: KeyValueStore;
  private readonly key: string;
  constructor(storage: KeyValueStore, key = DEMO_KEY) {
    this.storage = storage;
    this.key = key;
  }
  load(): Ledger {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return emptyLedger();
    let input: unknown;
    try { input = JSON.parse(raw); }
    catch { throw new Error('Invalid stored JSON: data preserved for recovery'); }
    return parseLedger(input);
  }
  /** Validate complete candidate before committing it; never overwrite incompatible data. */
  save(ledger: Ledger): void {
    this.load(); // fail closed if a foreign/invalid version already occupies the storage key
    const valid = parseLedger(ledger);
    this.storage.setItem(this.key, JSON.stringify(valid));
  }
  update(transform: (current: Ledger) => Ledger): Ledger {
    const current = this.load();
    const candidate = parseLedger(transform(structuredClone(current)));
    this.storage.setItem(this.key, JSON.stringify(candidate));
    return candidate;
  }
}
export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
