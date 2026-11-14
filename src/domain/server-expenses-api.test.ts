import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {parseMoney,showMinor} from './server-expenses-api.ts';
test('server client money accepts only exact kopiykas',()=>{
 assert.equal(parseMoney('20000'),2000000);
 assert.equal(parseMoney('8000,25'),800025);
 assert.throws(()=>parseMoney('5.999'),/Невірна/);
 assert.throws(()=>parseMoney('0'),/додатною/);
});
test('server minor amount formatting',()=>{
 assert.equal(showMinor('1200000'),'12 000,00 грн');
 assert.equal(showMinor('25'),'0,25 грн');
 assert.throws(()=>showMinor('1.23'),/Невірний/);
});
