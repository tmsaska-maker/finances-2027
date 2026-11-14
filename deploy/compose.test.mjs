import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const s=readFileSync(new URL('./compose.yaml',import.meta.url),'utf8');
test('financial compose never publishes postgres to host',()=>{
  const db=s.split('  db:')[1]?.split('  api:')[0];
  assert.ok(db);
  assert.doesNotMatch(db,/\n\s+ports:/);
});
test('finance API binds explicitly to loopback, no shared screening volumes',()=>{
  assert.match(s,/"127\.0\.0\.1:8091:8091"/);
  assert.match(s,/name: finances2027/);
  assert.match(s,/name: finances2027_db/);
  assert.doesNotMatch(s,/screening40[-_]/i);
});
test('finance gateway is loopback-only and requires independent secret',()=>{
  assert.match(s,/"127\\.0\\.0\\.1:8092:8092"/);
  assert.match(s,/FINANCES_GATEWAY_KEY/);
  assert.doesNotMatch(s,/"0\\.0\\.0\\.0:8092:8092"/);
});
test('backup never prunes volumes or dumps another database',()=>{
  const backup=readFileSync(new URL('./backup.sh',import.meta.url),'utf8');
  assert.match(backup,/pg_dump/);
  assert.doesNotMatch(backup,/volume prune|system prune|down -v/);
});
