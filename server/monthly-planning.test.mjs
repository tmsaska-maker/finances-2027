import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {previewNextMonthForecast,confirmMonthlyForecast} from './monthly-planning.mjs';

const example={
 month:'2027-01',project:'ambulatory',categoryId:'amb_utilities',templateId:'electricity',
 title:'Електроенергія',currency:'UAH',amountMinor:250000,dueDay:31,
 recurring:true,amountKind:'variable'
};

test('batch creates estimated monthly FORECAST, not a new obligation/payment/ACTUAL or edited BUDGET',()=>{
 const original=structuredClone(example);
 const preview=previewNextMonthForecast({sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:[
  example,{...example,templateId:'one_off',recurring:false}
 ]});
 assert.equal(preview.proposed.length,1);
 assert.deepEqual(example,original);
 assert.deepEqual(preview.proposed[0],{
  id:'recurring:2027-02:ambulatory:electricity',month:'2027-02',project:'ambulatory',
  categoryId:'amb_utilities',title:'Електроенергія',currency:'UAH',amountMinor:250000,
  dueDate:'2027-02-28',sourceTemplateId:'electricity',amountKind:'estimated',status:'draft'
 });
 assert.ok(!('obligationId' in preview.proposed[0]));
 assert.ok(!('bankTransactionId' in preview.proposed[0]));
});

test('December to January and leap year day clamping',()=>{
 const jan=previewNextMonthForecast({sourceMonth:'2026-12',targetMonth:'2027-01',sourceRows:[{...example,month:'2026-12'}]});
 assert.equal(jan.proposed[0].dueDate,'2027-01-31');
 const feb=previewNextMonthForecast({sourceMonth:'2028-01',targetMonth:'2028-02',sourceRows:[{...example,month:'2028-01'}]});
 assert.equal(feb.proposed[0].dueDate,'2028-02-29');
});

test('selected rows are batch editable, source remains untouched, second confirmation adds none',()=>{
 const second={...example,templateId:'rent',categoryId:'amb_rent',title:'Оренда',
   amountMinor:1400000,amountKind:'fixed',dueDay:5};
 const source=[example,second];
 const preview=previewNextMonthForecast({sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:source});
 const id=preview.proposed[0].id;
 const edit={amountMinor:273000,dueDate:'2027-02-24'};
 const first=confirmMonthlyForecast({preview,selectedIds:[id],edits:{[id]:edit}});
 assert.deepEqual(first.added.map(x=>x.amountMinor),[273000]);
 assert.equal(first.rows[0].dueDate,'2027-02-24');
 assert.equal(first.rows[0].status,'draft');
 assert.equal(example.amountMinor,250000);
 const twice=confirmMonthlyForecast({preview,selectedIds:[id],edits:{[id]:edit},existingRows:first.rows});
 assert.equal(twice.added.length,0);
 assert.deepEqual(twice.rows,first.rows);
});

test('preview skips existing template even if it has a different row ID',()=>{
 const existing=[{id:'user-edited-record',month:'2027-02',project:'ambulatory',sourceTemplateId:'electricity',amountMinor:290000}];
 const p=previewNextMonthForecast({sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:[example],existingRows:existing});
 assert.deepEqual(p.proposed,[]);
 assert.deepEqual(p.skipped,[{project:'ambulatory',templateId:'electricity',reason:'already_exists'}]);
});

test('same recurring template ID in different projects has independent identity',()=>{
 const p=previewNextMonthForecast({sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:[
   example,{...example,project:'screening'}
 ]});
 assert.equal(p.proposed.length,2);
 const out=confirmMonthlyForecast({preview:p,selectedIds:p.proposed.map(x=>x.id)});
 assert.equal(out.added.length,2);
 assert.notEqual(out.added[0].id,out.added[1].id);
});

test('strict rejects empty/zero/float amounts, bad periods, duplicates, and unauthorized edits',()=>{
 const args={sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:[example]};
 assert.throws(()=>previewNextMonthForecast({...args,sourceRows:[{...example,amountMinor:0}]}),/positive/);
 assert.throws(()=>previewNextMonthForecast({...args,sourceRows:[{...example,amountMinor:2.5}]}),/positive/);
 assert.throws(()=>previewNextMonthForecast({...args,targetMonth:'2027-03'}),/next calendar/);
 assert.throws(()=>previewNextMonthForecast({...args,sourceRows:[example,example]}),/Duplicate recurring/);
 const preview=previewNextMonthForecast(args);
 const id=preview.proposed[0].id;
 assert.throws(()=>confirmMonthlyForecast({preview,selectedIds:[id,id]}),/selected/);
 assert.throws(()=>confirmMonthlyForecast({preview,selectedIds:[id],edits:{[id]:{status:'paid'}}}),/Only forecast/);
 assert.throws(()=>confirmMonthlyForecast({preview,selectedIds:[id],edits:{[id]:{amountMinor:0}}}),/positive/);
 assert.throws(()=>confirmMonthlyForecast({preview,selectedIds:[id],edits:{[id]:{dueDate:'2027-03-01'}}}),/target month/);
});

test('carried unpaid obligation is not copied into a new month',()=>{
 const unrelated={id:'unpaid-2027-01',month:'2027-01',project:'ambulatory',categoryId:'amb_rent',amountMinor:1100000,recurring:false};
 const p=previewNextMonthForecast({sourceMonth:'2027-01',targetMonth:'2027-02',sourceRows:[example,unrelated]});
 assert.equal(p.proposed.length,1);
 assert.equal(p.proposed[0].sourceTemplateId,'electricity');
});
