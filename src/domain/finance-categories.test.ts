import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {loadFinanceCategories,toFigmaCategoryOptions,expenseCategoryFilters,expenseCategoryName} from './finance-categories.ts';

const expected={project:'personal',economicType:'expense',records:[
 {id:'per_food',code:'per_food',name:'Харчування',parentId:null,economicType:'expense',requirementKind:'unspecified',sortOrder:1},
 {id:'per_food_groceries',code:'per_food_groceries',name:'Продукти',parentId:'per_food',economicType:'expense',requirementKind:'unspecified',sortOrder:2}
]};
test('T007 categories are loaded with same-origin credentials, without exposing backend bearer tokens',async()=>{
 let requestedUrl='';let seen:RequestInit|undefined;
 const result=await loadFinanceCategories('personal','expense',{fetcher:async(url,init)=>{
   requestedUrl=url;seen=init;return new Response(JSON.stringify(expected),{status:200});
 }});
 assert.equal(requestedUrl,'/finance-api/categories?project=personal&type=expense');
 assert.equal(seen?.credentials,'same-origin');
 assert.equal(seen?.method,'GET');
 assert.ok(!('authorization' in (seen?.headers||{})));
 assert.deepEqual(toFigmaCategoryOptions(result),[
  {value:'per_food',label:'Харчування',parentId:null},
  {value:'per_food_groceries',label:'Харчування / Продукти',parentId:'per_food'}
 ]);
});
test('T007 fail closed on unauthorized, contradictory, duplicated or unexpected categories',async()=>{
 await assert.rejects(()=>loadFinanceCategories('personal','expense',{fetcher:async()=>new Response('{}',{status:401})}),/авторизація/);
 await assert.rejects(()=>loadFinanceCategories('personal','expense',{fetcher:async()=>new Response(JSON.stringify({...expected,project:'screening'}),{status:200})}),/Невідповідність/);
 await assert.rejects(()=>loadFinanceCategories('personal','expense',{fetcher:async()=>new Response(JSON.stringify({...expected,records:[expected.records[0],expected.records[0]]}),{status:200})}),/Некоректна категорія/);
 await assert.rejects(()=>loadFinanceCategories('personal','expense',{fetcher:async()=>new Response(JSON.stringify({...expected,records:[{...expected.records[0],economicType:'income'}]}),{status:200})}),/Некоректна категорія/);
});

test('existing Figma expense filters retain project-scoped stable IDs and group labels',()=>{
 const a={project:'ambulatory',economicType:'expense',records:[
  {id:'amb_rent',code:'amb_rent',name:'Оренда',parentId:null,economicType:'expense',requirementKind:'unspecified',sortOrder:0},
  {id:'amb_rent_office',code:'amb_rent_office',name:'Приміщення',parentId:'amb_rent',economicType:'expense',requirementKind:'unspecified',sortOrder:1}
 ]} as const;
 const b={project:'screening',economicType:'expense',records:[
  {id:'amb_rent',code:'screen_rent',name:'Оренда для Скринінгу',parentId:null,economicType:'expense',requirementKind:'unspecified',sortOrder:0}
 ]} as const;
 const map={ambulatory:a,screening:b};
 const filters=expenseCategoryFilters(map);
 assert.deepEqual(filters.map(x=>x.key),['ambulatory:amb_rent','ambulatory:amb_rent_office','screening:amb_rent']);
 assert.deepEqual(filters.map(x=>x.label),['Амбулаторія · Оренда','Амбулаторія · Оренда / Приміщення','Скринінг · Оренда для Скринінгу']);
 assert.equal(expenseCategoryName(map,'Амбулаторія','amb_rent_office'),'Оренда / Приміщення');
 assert.equal(expenseCategoryName(map,'Скринінг','amb_rent'),'Оренда для Скринінгу');
 assert.equal(expenseCategoryName(map,'Амбулаторія','legacy free text'),'legacy free text');
 assert.equal(expenseCategoryName({},'Амбулаторія','amb_rent'),'amb_rent');
});
