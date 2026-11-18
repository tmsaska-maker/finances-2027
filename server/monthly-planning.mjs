/**
 * F03 monthly FORECAST preparation. Pure domain code; no DB access, no side effects.
 * A forecast row is not an obligation or a bank payment. Immutable BUDGET is not mutated here.
 * All amounts are positive integer minor units (kopiykas/cents), never floating point.
 */
const PROJECTS = new Set(['ambulatory','screening','psychotherapy','personal']);
const CURRENCIES = new Set(['UAH','USD','EUR']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid '+name);
  return value;
}
function requireId(value,name) {
  if (typeof value!=='string'||!/^[-_a-zA-Z0-9]{1,120}$/.test(value))
    throw Error('Invalid '+name);
  return value;
}
function requireAmount(value) {
  if (!Number.isSafeInteger(value)||value<=0) throw Error('Forecast requires a positive minor-unit amount');
  return value;
}
function requireMonth(month) {
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw Error('Invalid forecast month');
  return month;
}
function nextMonth(month) {
  const [y,m]=month.split('-').map(Number);
  return m===12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}
function lastDay(yearMonth) {
  const [year,month]=yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year,month,0)).getUTCDate();
}
function dueDateFor(month,day) {
  if(!Number.isInteger(day)||day<1||day>31)throw Error('Invalid due day');
  return month+'-'+String(Math.min(day,lastDay(month))).padStart(2,'0');
}
function requireDate(date,month) {
  if(typeof date!=='string'||date.slice(0,7)!==month||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date))
    throw Error('Forecast payment date must belong to target month');
  const day=Number(date.slice(8,10));
  if(day<1||day>lastDay(month))throw Error('Invalid forecast payment date');
  return date;
}
function key(project,templateId) {return project+':'+templateId;}
function validateRecurring(value,month) {
  const row=requireObject(value,'recurring row');
  if(row.month!==month) throw Error('Recurring source month mismatch');
  if(!PROJECTS.has(row.project)||!CURRENCIES.has(row.currency))throw Error('Invalid project or currency');
  const templateId=requireId(row.templateId,'template ID');
  requireId(row.categoryId,'category ID');
  requireAmount(row.amountMinor);
  if(typeof row.title!=='string'||!row.title.trim()||row.title.length>120)throw Error('Invalid recurring title');
  if(!Number.isInteger(row.dueDay)||row.dueDay<1||row.dueDay>31)throw Error('Invalid due day');
  return {...row,templateId};
}
function validateExisting(row,month) {
  requireObject(row,'existing forecast row');
  if(row.month!==month)throw Error('Existing forecast month mismatch');
  if(!PROJECTS.has(row.project))throw Error('Invalid existing project');
  requireId(row.id,'forecast ID');
  if(row.sourceTemplateId!=null)requireId(row.sourceTemplateId,'source template');
  return row;
}
/**
 * Create a repeatable preview from last month's recurring rows.
 * Existing target rows are never overwritten. Open obligations are intentionally
 * NOT inputs: their unpaid balance is carried into cashflow elsewhere.
 */
export function previewNextMonthForecast({sourceMonth,targetMonth,sourceRows,existingRows=[]}) {
  requireMonth(sourceMonth);requireMonth(targetMonth);
  if(nextMonth(sourceMonth)!==targetMonth)throw Error('Target must be the next calendar month');
  if(!Array.isArray(sourceRows)||!Array.isArray(existingRows))throw Error('Invalid forecast rows');
  const existingIds=new Set();
  const existingTemplates=new Set();
  for(const item of existingRows) {
    const row=validateExisting(item,targetMonth);
    if(existingIds.has(row.id))throw Error('Duplicate existing forecast ID');
    existingIds.add(row.id);
    if(row.sourceTemplateId!=null) {
      const k=key(row.project,row.sourceTemplateId);
      if(existingTemplates.has(k))throw Error('Duplicate existing recurring template');
      existingTemplates.add(k);
    }
  }
  const seen=new Set();
  const proposed=[];
  const skipped=[];
  for(const raw of sourceRows) {
    if(raw?.recurring!==true)continue;
    const r=validateRecurring(raw,sourceMonth);
    const k=key(r.project,r.templateId);
    if(seen.has(k))throw Error('Duplicate recurring source template');
    seen.add(k);
    const id=`recurring:${targetMonth}:${r.project}:${r.templateId}`;
    if(existingTemplates.has(k)||existingIds.has(id)) {
      skipped.push({project:r.project,templateId:r.templateId,reason:'already_exists'});
      continue;
    }
    proposed.push({
      id,month:targetMonth,project:r.project,categoryId:r.categoryId,
      title:r.title,currency:r.currency,amountMinor:r.amountMinor,
      dueDate:dueDateFor(targetMonth,r.dueDay),sourceTemplateId:r.templateId,
      amountKind:r.amountKind==='fixed'?'fixed':'estimated',status:'draft'
    });
  }
  return {sourceMonth,targetMonth,proposed,skipped};
}
/** Apply selected edited preview rows without changing originals or duplicating target rows. */
export function confirmMonthlyForecast({preview,selectedIds,edits={},existingRows=[]}) {
  const p=requireObject(preview,'preview');
  requireMonth(p.targetMonth);
  if(!Array.isArray(p.proposed)||!Array.isArray(selectedIds)||!Array.isArray(existingRows))throw Error('Invalid batch');
  requireObject(edits,'edits');
  const candidates=new Map();
  for(const raw of p.proposed) {
    const row=requireObject(raw,'preview row');
    requireId(row.id,'preview ID');
    if(candidates.has(row.id)||row.month!==p.targetMonth||!PROJECTS.has(row.project)||!CURRENCIES.has(row.currency))
      throw Error('Invalid preview row');
    requireId(row.sourceTemplateId,'source template');
    candidates.set(row.id,row);
  }
  const selected=new Set(selectedIds);
  if(selected.size!==selectedIds.length||[...selected].some(id=>!candidates.has(id)))throw Error('Invalid selected preview IDs');
  if(Object.keys(edits).some(id=>!selected.has(id)))throw Error('Invalid edit target');
  const result=existingRows.map(x=>({...validateExisting(x,p.targetMonth)}));
  const ids=new Set(result.map(x=>x.id));
  const identities=new Set(result.filter(x=>x.sourceTemplateId).map(x=>key(x.project,x.sourceTemplateId)));
  const added=[];
  for(const id of selectedIds) {
    const row=candidates.get(id);
    const identity=key(row.project,row.sourceTemplateId);
    if(ids.has(id)||identities.has(identity))continue; // repeat confirmation is idempotent
    const patch=edits[id]??{};
    requireObject(patch,'forecast edit');
    if(Object.keys(patch).some(k=>!['amountMinor','dueDate'].includes(k)))throw Error('Only forecast amount and payment date can be edited in batch');
    const created={...row,amountMinor:requireAmount(patch.amountMinor??row.amountMinor),
      dueDate:requireDate(patch.dueDate??row.dueDate,p.targetMonth)};
    result.push(created);
    added.push(created);
    ids.add(id);
    identities.add(identity);
  }
  return {rows:result,added};
}
