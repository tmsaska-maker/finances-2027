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
    const catalogue = readFileSync(new URL('./sql/003_category_catalog.sql', import.meta.url), 'utf8');
    await pool.query(catalogue);
    await pool.query(catalogue); // additive and idempotent, including trigger
    const version = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    assert.deepEqual(version.rows.map(row => row.version), [1,2,3]);

    // One category can be shared across business directions without copying its identity.
    await pool.query("INSERT INTO finance_categories(id,code,name,economic_type) VALUES ('payroll','payroll','Зарплата персоналу','expense')");
    await pool.query("INSERT INTO finance_categories(id,code,name,parent_id,economic_type) VALUES ('doctor','doctor','Сімейний лікар','payroll','expense')");
    await pool.query("INSERT INTO project_category_access(project,category_id) VALUES ('ambulatory','payroll'),('screening','payroll'),('ambulatory','doctor'),('screening','doctor')");
    await pool.query("INSERT INTO category_source_aliases(project,source_file,source_label,category_id,reviewed_by) VALUES ('ambulatory','legacy_ambulatory','Зарплата персоналу','payroll','migration-review'),('screening','legacy_screening','Зарплата персоналу','payroll','migration-review')");
    const visible = await pool.query("SELECT project,category_id FROM project_category_access WHERE category_id='payroll' ORDER BY project");
    assert.deepEqual(visible.rows, [{project:'ambulatory',category_id:'payroll'},{project:'screening',category_id:'payroll'}]);
    const aliases = await pool.query("SELECT COUNT(*)::int AS count FROM category_source_aliases WHERE category_id='payroll'");
    assert.equal(aliases.rows[0].count, 2);
    await assert.rejects(
      pool.query("INSERT INTO category_source_aliases(project,source_file,source_label,category_id,reviewed_by) VALUES ('personal','legacy_personal','Зарплата персоналу','payroll','migration-review')"),
      error => error.code === '23503',
    );
    await assert.rejects(
      pool.query("INSERT INTO finance_categories(id,code,name,parent_id,economic_type) VALUES ('grandchild','grandchild','Не дозволено','doctor','expense')"),
      error => error.code === '23514',
    );
    await assert.rejects(
      pool.query("INSERT INTO finance_categories(id,code,name,parent_id,economic_type) VALUES ('wrong-type','wrong-type','Не дозволено','payroll','income')"),
      error => error.code === '23514',
    );
    const legacy = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='obligations' AND column_name='category'");
    assert.equal(legacy.rowCount, 1); // no rewriting or dropping existing text field
    const seed = readFileSync(new URL('./sql/004_category_seed.sql', import.meta.url), 'utf8');
    await pool.query(seed);
    await pool.query(seed); // no duplicate catalogue records on repeat
    const currentVersions = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    assert.deepEqual(currentVersions.rows.map(row => row.version), [1,2,3,4]);
    const selected = await pool.query("SELECT project, category_id FROM project_category_access WHERE category_id = 'payroll' ORDER BY project");
    assert.deepEqual(selected.rows, [{project:'ambulatory',category_id:'payroll'},{project:'screening',category_id:'payroll'}]);
    const sharedCount=await pool.query("SELECT COUNT(*)::int AS count FROM finance_categories WHERE id='payroll'");
    assert.equal(sharedCount.rows[0].count,1);
    const sourceRoot=await pool.query("SELECT parent_id,name FROM finance_categories WHERE id='psy_training'");
    assert.equal(sourceRoot.rows[0].parent_id,null);
    const sourceChild=await pool.query("SELECT parent_id,name FROM finance_categories WHERE id='psy_training_specialisation'");
    assert.equal(sourceChild.rows[0].parent_id,'psy_training');
    assert.equal(sourceChild.rows[0].name,'Спеціалізація');
    const personal=await pool.query("SELECT category_id FROM project_category_access WHERE project='personal' AND category_id='per_pets'");
    assert.equal(personal.rowCount,1);
    const incorrectAccess=await pool.query("SELECT category_id FROM project_category_access WHERE project='screening' AND category_id='per_pets'");
    assert.equal(incorrectAccess.rowCount,0);
    const noAutoAliases=await pool.query("SELECT count(*)::int AS count FROM category_source_aliases");
    assert.equal(noAutoAliases.rows[0].count,2); // only approved fixture mappings from above
    const noPersons=await pool.query("SELECT COUNT(*)::int AS count FROM finance_categories WHERE name IN ('Настя','Стас','Лікар#1','лікар#1')");
    assert.equal(noPersons.rows[0].count,0);


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
