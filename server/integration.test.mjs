import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { makeServer } from './http.mjs';

const TOKEN = 'test-only-token-is-not-a-production-secret-2026';

test('isolated PostgreSQL: migration, HTTP API and bank-backed partial settlements', async () => {
  if (!process.env.FINANCES_TEST_DATABASE_URL) throw new Error('FINANCES_TEST_DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.FINANCES_TEST_DATABASE_URL, max: 5 });
  let server;
  try {
    const migration = readFileSync(new URL('./sql/001_initial.sql', import.meta.url), 'utf8');
    await pool.query(migration);
    await pool.query(migration); // idempotent on a clean finance-only DB
    const metadata = readFileSync(new URL('./sql/002_expense_metadata.sql', import.meta.url), 'utf8');
    await pool.query(metadata);
    await pool.query(metadata);
    const version = await pool.query('SELECT version FROM schema_migrations');
    assert.deepEqual(version.rows.map(row => row.version), [1,2]);

    server = makeServer(pool, TOKEN);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const send = async (path, body, method = 'POST') => {
      const response = await fetch(base + path, {
        method,
        headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const unauthorized = await fetch(base + '/obligations/test');
    assert.equal(unauthorized.status, 401);

    const account = { id: 'account-1', label: 'Test account', project: 'ambulatory', currency: 'UAH' };
    assert.equal((await send('/accounts', account)).status, 201);
    assert.equal((await send('/accounts', account)).status, 409);

    const obligation = { id: 'bill-1', project: 'ambulatory', amountMinor: 2_000_000, currency: 'UAH', dueDate: '2026-12-01', title:'Тестова оренда', category:'Оренда', plannedBank:'Тестовий банк',note:'Лише демо' };
    assert.equal((await send('/obligations', obligation)).status, 201);
    const list=await send('/obligations',undefined,'GET');
    assert.equal(list.status,200);
    assert.equal(list.body.records[0].title,'Тестова оренда');

    const planned = { id: 'planned-1', obligationId: 'bill-1', amountMinor: 800_000, currency: 'UAH', state: 'submitted' };
    assert.equal((await send('/payments', planned)).status, 201);
    let debt = await send('/obligations/bill-1', undefined, 'GET');
    assert.equal(debt.status, 200);
    assert.equal(debt.body.remainingMinor, '2000000');
    assert.equal(debt.body.paidMinor, '0');

    const transaction = { id: 'bank-1', accountId: 'account-1', project: 'ambulatory', kind: 'expense', amountMinor: 800_000, currency: 'UAH', occurredOn: '2026-11-11', sourceId: 'statement-row-1' };
    assert.equal((await send('/transactions', transaction)).status, 201);
    assert.equal((await send('/transactions', { ...transaction, id: 'bank-duplicate' })).status, 409);

    assert.equal((await send('/payments', { id: 'bad-1', obligationId: 'bill-1', amountMinor: 100, currency: 'UAH', state: 'confirmed', bankTransactionId: 'missing-bank' })).status, 400);
    assert.equal((await send('/payments', { id: 'paid-1', obligationId: 'bill-1', amountMinor: 800_000, currency: 'UAH', state: 'confirmed', bankTransactionId: 'bank-1' })).status, 201);

    debt = await send('/obligations/bill-1', undefined, 'GET');
    assert.equal(debt.body.paidMinor, '800000');
    assert.equal(debt.body.remainingMinor, '1200000');
    assert.equal((await send('/payments', { id: 'paid-2', obligationId: 'bill-1', amountMinor: 1, currency: 'UAH', state: 'confirmed', bankTransactionId: 'bank-1' })).status, 400);

    assert.equal((await send('/obligations/bill-1%27%3BDROP%20TABLE%20accounts', undefined, 'GET')).status, 404);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM accounts')).rows[0].count, 1);
    assert.equal((await send('/obligations/missing', undefined, 'GET')).status, 404);

    const another = { id: 'bank-2', accountId: 'account-1', project: 'ambulatory', kind: 'expense', amountMinor: 1_200_000, currency: 'UAH', occurredOn: '2026-11-11', sourceId: 'statement-row-2' };
    assert.equal((await send('/transactions', another)).status, 201);
    assert.equal((await send('/payments', { id: 'paid-3', obligationId: 'bill-1', amountMinor: 1_200_000, currency: 'UAH', state: 'confirmed', bankTransactionId: 'bank-2' })).status, 201);
    debt = await send('/obligations/bill-1', undefined, 'GET');
    assert.equal(debt.body.remainingMinor, '0');
    assert.equal(debt.body.paidMinor, '2000000');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
