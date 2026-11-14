import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { obligationInput, paymentInput, transactionInput, accountInput } from './validation.mjs';
const a={id:'a',project:'ambulatory',currency:'UAH',label:'Demo'};
const b={id:'b',project:'ambulatory',currency:'UAH',amountMinor:150000,dueDate:'2026-11-30'};
test('accepts valid account and obligation',()=>{assert.deepEqual(accountInput(a),a);assert.deepEqual(obligationInput(b),{...b,title:'',category:'',plannedBank:'',note:''});});
test('invalid currency/project rejected',()=>{assert.throws(()=>accountInput({...a,currency:'GBP'}),/currency/);assert.throws(()=>accountInput({...a,project:'other'}),/project/);});
test('money remains safe integer',()=>{assert.throws(()=>obligationInput({...b,amountMinor:1.5}),/safe integer/);assert.throws(()=>obligationInput({...b,amountMinor:-10}),/safe integer/);});
test('invalid calendar date rejected',()=>assert.throws(()=>obligationInput({...b,dueDate:'2026-02-30'}),/date/));
test('payment requires bank transaction for confirmed',()=>assert.throws(()=>paymentInput({id:'p',obligationId:'b',amountMinor:200,currency:'UAH',state:'confirmed'}),/requires bank/));
test('pending payment allowed without bank reference',()=>assert.equal(paymentInput({id:'p',obligationId:'b',amountMinor:200,currency:'UAH',state:'submitted'}).bankTransactionId,null));
test('transaction must reference source, project, account',()=>{assert.throws(()=>transactionInput({id:'t',accountId:'a',project:'ambulatory',kind:'expense',currency:'UAH',amountMinor:100,occurredOn:'2026-11-11',sourceId:''}),/sourceId/);});

test('expense metadata accepted and bounded',()=>{
 const info=obligationInput({...b,title:'Тестова оренда',category:'Оренда',plannedBank:'Умовний банк',note:'Тільки демо'});
 assert.equal(info.title,'Тестова оренда');
 assert.throws(()=>obligationInput({...b,title:'X'.repeat(121)}),/title/);
});
