/**
 * T007: read-only client boundary for approved finance category metadata.
 * Public demo UI keeps using its synthetic data until a same-origin session-auth
 * gateway is deployed. No backend FINANCES_API_TOKEN must reach the browser.
 */
export const financeProjects = ['ambulatory','screening','psychotherapy','personal'] as const;
export const financeEconomicTypes = ['expense','income','non_consumption'] as const;
export type FinanceProject = typeof financeProjects[number];
export type FinanceEconomicType = typeof financeEconomicTypes[number];
export type FinanceCategory = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  economicType: FinanceEconomicType;
  requirementKind: 'unspecified'|'required'|'optional';
  sortOrder: number;
};
export type FinanceCategoryResponse = {
  project: FinanceProject;
  economicType: FinanceEconomicType | null;
  records: FinanceCategory[];
};
type ReadonlyFetcher = (input: string, init: RequestInit) => Promise<Response>;
const validProjects = new Set<string>(financeProjects);
const validKinds = new Set<string>(financeEconomicTypes);
function object(value: unknown): Record<string,unknown> {
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Некоректний формат довідника');
  return value as Record<string,unknown>;
}
function validateResponse(value: unknown, project: FinanceProject, kind: FinanceEconomicType): FinanceCategoryResponse {
  const raw=object(value);
  if(raw.project!==project || raw.economicType!==kind || !Array.isArray(raw.records)) throw Error('Невідповідність відповіді довідника');
  const seen=new Set<string>();
  const records:FinanceCategory[]=raw.records.map((item:unknown)=>{
    const v=object(item);
    if(typeof v.id!=='string'||!v.id||seen.has(v.id)||typeof v.code!=='string'||
       typeof v.name!=='string'||!v.name.trim()||!validKinds.has(String(v.economicType))||
       v.economicType!==kind||(v.parentId!==null && typeof v.parentId!=='string')||
       !['unspecified','required','optional'].includes(String(v.requirementKind))||
       !Number.isInteger(v.sortOrder)) throw Error('Некоректна категорія фінансового довідника');
    seen.add(v.id);
    return v as FinanceCategory;
  });
  return {project,economicType:kind,records};
}
export async function loadFinanceCategories(
  project: FinanceProject,
  kind: FinanceEconomicType,
  options: {signal?: AbortSignal; fetcher?: ReadonlyFetcher}={}
): Promise<FinanceCategoryResponse> {
  if(!validProjects.has(project)||!validKinds.has(kind)) throw Error('Неприпустимий фільтр категорій');
  const response=await (options.fetcher??fetch)(
    '/finance-api/categories?project='+encodeURIComponent(project)+'&type='+encodeURIComponent(kind),
    {method:'GET',credentials:'same-origin',cache:'no-store',signal:options.signal}
  );
  if(response.status===401||response.status===403) throw Error('Для фінансового довідника потрібна авторизація');
  if(!response.ok) throw Error('Не вдалося завантажити фінансовий довідник: '+response.status);
  return validateResponse(await response.json() as unknown,project,kind);
}
export function toFigmaCategoryOptions(catalogue: FinanceCategoryResponse): Array<{value:string; label:string; parentId:string|null}> {
  // A stable ID is passed to the form; text labels are presentation only.
  const labels=new Map(catalogue.records.map(x=>[x.id,x.name]));
  return catalogue.records.map(x=>({
    value:x.id,
    label:x.parentId && labels.has(x.parentId)?labels.get(x.parentId)+' / '+x.name:x.name,
    parentId:x.parentId
  }));
}

/** Read-only category view model for the EXISTING Figma expenses screen.
 * Project is part of the selection identity because categories are project-scoped.
 * Historical free-text categories remain visible but are never treated as valid IDs.
 */
export const financeBusinessProjectNames: Record<'Амбулаторія'|'Скринінг'|'Психотерапія', FinanceProject> = {
  'Амбулаторія':'ambulatory','Скринінг':'screening','Психотерапія':'psychotherapy'
};
export type BusinessCategoryCatalogues=Partial<Record<FinanceProject,FinanceCategoryResponse>>;
export type ExpenseCategoryFilter={key:string;label:string;project:FinanceProject;categoryId:string};
export function expenseCategoryFilters(catalogues:BusinessCategoryCatalogues):ExpenseCategoryFilter[] {
  const result:ExpenseCategoryFilter[]=[];
  for(const [label,project] of Object.entries(financeBusinessProjectNames)) {
    const catalogue=catalogues[project];
    if(!catalogue)continue;
    for(const item of toFigmaCategoryOptions(catalogue)) {
      result.push({key:project+':'+item.value,label:label+' · '+item.label,project,categoryId:item.value});
    }
  }
  return result;
}
export function expenseCategoryName(
  catalogues:BusinessCategoryCatalogues, projectName:string, storedCategory:string
):string {
  const project=financeBusinessProjectNames[projectName as keyof typeof financeBusinessProjectNames];
  const catalogue=project?catalogues[project]:undefined;
  if(!catalogue)return storedCategory;
  return toFigmaCategoryOptions(catalogue).find(item=>item.value===storedCategory)?.label??storedCategory;
}
