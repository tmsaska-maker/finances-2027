export const PROJECTS = ['ambulatory', 'screening', 'psychotherapy', 'personal'];
export const CURRENCIES = ['UAH', 'USD', 'EUR'];
export const PAYMENT_STATES = ['planned', 'submitted', 'confirmed', 'rejected'];

export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  return value;
}
export function text(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error('Invalid ' + name);
  return value;
}
export function enumValue(value, options, name) {
  if (!options.includes(value)) throw new Error('Invalid ' + name);
  return value;
}
export function money(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Amount must be a nonnegative safe integer in minor units');
  return value;
}
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Invalid date');
  return value;
}
export function accountInput(value) {
  const x=object(value);
  return { id:text(x.id,'id'), project:enumValue(x.project,PROJECTS,'project'),currency:enumValue(x.currency,CURRENCIES,'currency'),label:text(x.label,'label') };
}
export function obligationInput(value) {
  const x=object(value);
  return { id:text(x.id,'id'), project:enumValue(x.project,PROJECTS,'project'),currency:enumValue(x.currency,CURRENCIES,'currency'),amountMinor:money(x.amountMinor),dueDate:isoDate(x.dueDate),title:optionalText(x.title,'title',120),category:optionalText(x.category,'category',120),plannedBank:optionalText(x.plannedBank,'plannedBank',120),note:optionalText(x.note,'note',2000) };
}
export function transactionInput(value) {
  const x=object(value);
  return { id:text(x.id,'id'),accountId:text(x.accountId,'accountId'),project:enumValue(x.project,PROJECTS,'project'),kind:enumValue(x.kind,['income','expense','transfer'],'kind'),currency:enumValue(x.currency,CURRENCIES,'currency'),amountMinor:money(x.amountMinor),occurredOn:isoDate(x.occurredOn),sourceId:text(x.sourceId,'sourceId') };
}
export function paymentInput(value) {
  const x=object(value);
  const result={ id:text(x.id,'id'),obligationId:text(x.obligationId,'obligationId'),currency:enumValue(x.currency,CURRENCIES,'currency'),amountMinor:money(x.amountMinor),state:enumValue(x.state,PAYMENT_STATES,'state'),bankTransactionId:x.bankTransactionId == null ? null : text(x.bankTransactionId,'bankTransactionId') };
  if(result.state === 'confirmed' && !result.bankTransactionId) throw new Error('Confirmed payment requires bank transaction ID');
  return result;
}

export function optionalText(value,name,max) {if(value==null) return ''; if(typeof value!=='string'||value.length>max) throw new Error('Invalid '+name);return value;}
