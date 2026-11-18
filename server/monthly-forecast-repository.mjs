import {previewNextMonthForecast,confirmMonthlyForecast} from './monthly-planning.mjs';

/** Finances-only PostgreSQL adapter: planned cashflow rows are never booked as ACTUAL. */
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const ID=/^[-_a-zA-Z0-9:]{1,120}$/;
const PROJECTS=new Set(['ambulatory','screening','psychotherapy','personal']);
const CURRENCIES=new Set(['UAH','USD','EUR']);
function month(value) {
  if(typeof value!=='string'||!MONTH.test(value))throw Error('Invalid month');
  return value;
}
function input(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid forecast payload');
  const x=value;
  if(!PROJECTS.has(x.project)||!CURRENCIES.has(x.currency))throw Error('Invalid project or currency');
  if(typeof x.sourceTemplateId!=='string'||!ID.test(x.sourceTemplateId)||typeof x.categoryId!=='string'||!ID.test(x.categoryId))throw Error('Invalid forecast template/category');
  if(typeof x.title!=='string'||!x.title.trim()||x.title.length>120)throw Error('Invalid forecast title');
  if(!Number.isSafeInteger(x.amountMinor)||x.amountMinor<=0)throw Error('Invalid forecast amount');
  if(!['fixed','estimated'].includes(x.amountKind))throw Error('Invalid amount kind');
  if(typeof x.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.dueDate)||x.dueDate.slice(0,7)!==month(x.month)||Number.isNaN(Date.parse(x.dueDate))||new Date(x.dueDate).toISOString().slice(0,10)!==x.dueDate)throw Error('Invalid due date');
  return {id:`recurring:${x.month}:${x.project}:${x.sourceTemplateId}`,...x};
}
const select=`SELECT id,month,project,category_id AS "categoryId",title,currency,
 amount_minor::text AS "amountMinor",due_date::text AS "dueDate",
 source_template_id AS "sourceTemplateId",recurring,amount_kind AS "amountKind",status
 FROM monthly_forecast_lines`;
function format(row) {return {...row,amountMinor:Number(row.amountMinor)};}
async function readRows(client,targetMonth) {
  const result=await client.query(select+' WHERE month=$1 ORDER BY project,due_date,id',[month(targetMonth)]);
  return result.rows.map(format);
}
async function ensureCategory(client,project,categoryId) {
  const c=await client.query(`SELECT 1 FROM finance_categories c JOIN project_category_access a ON a.category_id=c.id
  WHERE c.id=$1 AND c.economic_type='expense' AND c.active=true AND a.project=$2 AND a.enabled=true`,[categoryId,project]);
  if(!c.rowCount)throw Error('Invalid expense category for project');
}
async function insert(client,record) {
  const x=input(record);
  await ensureCategory(client,x.project,x.categoryId);
  const r=await client.query(`INSERT INTO monthly_forecast_lines(
    id,month,project,category_id,title,currency,amount_minor,due_date,
    source_template_id,recurring,amount_kind,status
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
  ON CONFLICT (month,project,source_template_id) DO NOTHING RETURNING id`,[
    x.id,x.month,x.project,x.categoryId,x.title,x.currency,x.amountMinor,x.dueDate,
    x.sourceTemplateId,x.recurring===true,x.amountKind
  ]);
  return r.rowCount>0;
}
function toSource(row) {
  return {
    month:row.month,project:row.project,categoryId:row.categoryId,
    templateId:row.sourceTemplateId,title:row.title,currency:row.currency,
    amountMinor:row.amountMinor,dueDay:Number(row.dueDate.slice(8,10)),
    recurring:row.recurring,amountKind:row.amountKind
  };
}
export function createMonthlyForecastRepository(pool) {
  return {
    async list(monthValue) {return {month:month(monthValue),records:await readRows(pool,monthValue)};},
    async create(record) {
      const x=input(record);
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted=await insert(client,{...x,recurring:x.recurring===true});
        if(!inserted)throw Error('Duplicate monthly forecast template');
        await client.query('COMMIT');
        return {record:x};
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
    async revise({id,month:targetMonth,expectedAmountMinor,expectedDueDate,amountMinor,dueDate}) {
      if(typeof id!=='string'||!ID.test(id))throw Error('Invalid forecast line ID');
      month(targetMonth);
      if(!Number.isSafeInteger(expectedAmountMinor)||expectedAmountMinor<=0
          ||!Number.isSafeInteger(amountMinor)||amountMinor<=0)throw Error('Invalid forecast amount');
      const validateDate=(value)=>{
        if(typeof value!=='string'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)
            ||value.slice(0,7)!==targetMonth||Number.isNaN(Date.parse(value))
            ||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid forecast date');
        return value;
      };
      validateDate(expectedDueDate);validateDate(dueDate);
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const found=await client.query(
          `SELECT id,amount_minor::text AS amount_minor,due_date::text AS due_date
           FROM monthly_forecast_lines WHERE id=$1 AND month=$2 AND status='draft' FOR UPDATE`,
          [id,targetMonth]
        );
        if(!found.rowCount)throw Error('Unknown forecast line');
        const previous=found.rows[0];
        if(Number(previous.amount_minor)!==expectedAmountMinor||previous.due_date!==expectedDueDate)
          throw Error('Forecast changed since last read');
        if(amountMinor===expectedAmountMinor&&dueDate===expectedDueDate){
          await client.query('COMMIT');
          return {changed:false,record:(await readRows(pool,targetMonth)).find(x=>x.id===id)};
        }
        await client.query('UPDATE monthly_forecast_lines SET amount_minor=$2,due_date=$3 WHERE id=$1',
          [id,amountMinor,dueDate]);
        await client.query(
          `INSERT INTO monthly_forecast_revisions(
            forecast_line_id,old_amount_minor,new_amount_minor,old_due_date,new_due_date
           ) VALUES($1,$2,$3,$4,$5)`,
          [id,expectedAmountMinor,amountMinor,expectedDueDate,dueDate]
        );
        await client.query('COMMIT');
        return {changed:true,record:(await readRows(pool,targetMonth)).find(x=>x.id===id)};
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    },
    async history({id}) {
      if(typeof id!=='string'||!ID.test(id))throw Error('Invalid forecast line ID');
      const r=await pool.query(
        `SELECT id,forecast_line_id AS "forecastLineId",
          old_amount_minor::text AS "oldAmountMinor",new_amount_minor::text AS "newAmountMinor",
          old_due_date::text AS "oldDueDate",new_due_date::text AS "newDueDate",
          revised_at AS "revisedAt"
         FROM monthly_forecast_revisions WHERE forecast_line_id=$1 ORDER BY id`,[id]
      );
      return {id,records:r.rows.map(x=>({...x,oldAmountMinor:Number(x.oldAmountMinor),newAmountMinor:Number(x.newAmountMinor)}))};
    },
    async preview({sourceMonth,targetMonth}) {
      month(sourceMonth);month(targetMonth);
      const source=await readRows(pool,sourceMonth);
      const existing=await readRows(pool,targetMonth);
      return previewNextMonthForecast({sourceMonth,targetMonth,sourceRows:source.map(toSource),existingRows:existing});
    },
    async confirm({sourceMonth,targetMonth,selectedIds,edits={}}) {
      month(sourceMonth);month(targetMonth);
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        // Serializes competing confirmations of the same target without touching another application.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['finances:monthly:'+targetMonth]);
        const source=await readRows(client,sourceMonth);
        const existing=await readRows(client,targetMonth);
        const preview=previewNextMonthForecast({sourceMonth,targetMonth,sourceRows:source.map(toSource),existingRows:existing});
        // Stale preview selected IDs are already present: treating retries as idempotent.
        const selected=Array.isArray(selectedIds)?selectedIds:null;
        if(!selected)throw Error('Invalid selected IDs');
        const previewWithAlreadyPresent={...preview,proposed:[...preview.proposed,...existing.filter(x=>x.sourceTemplateId).map(x=>({
          id:`recurring:${targetMonth}:${x.project}:${x.sourceTemplateId}`,
          month:targetMonth,project:x.project,categoryId:x.categoryId,title:x.title,currency:x.currency,
          amountMinor:x.amountMinor,dueDate:x.dueDate,sourceTemplateId:x.sourceTemplateId,amountKind:x.amountKind,status:'draft'
        }))]};
        const final=confirmMonthlyForecast({preview:previewWithAlreadyPresent,selectedIds:selected,edits,existingRows:existing});
        for(const row of final.added)await insert(client,{...row,recurring:true});
        await client.query('COMMIT');
        return {month:targetMonth,inserted:final.added.length,records:await readRows(pool,targetMonth)};
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
  };
}
