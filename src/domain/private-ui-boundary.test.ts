import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const gate=readFileSync(new URL('../PrivateFinanceGate.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../index.css',import.meta.url),'utf8');

test('private finance UI gates entire Figma app, not just Expenses, before any private screen mounts',()=>{
 assert.match(app,/privateFinanceMode\s*\?\s*<PrivateFinanceGate>/);
 assert.match(app,/<FinanceDashboardApp privateLogout=\{logout\}/);
 assert.match(gate,/readFinanceSession\(\)/);
 assert.match(gate,/loginFinance\(password\)/);
 assert.match(gate,/logoutFinance\(\)/);
 assert.match(gate,/setStatus\("locked"\);\s*setPassword\(""/);
 assert.doesNotMatch(gate,/localStorage|sessionStorage|FINANCES_API_TOKEN/);
});

test('private unconnected screens never show synthetic Figma finance totals; writes stay disabled',()=>{
 assert.match(app,/Демонстраційні суми тут навмисно не показуємо/);
 assert.match(app,/!privateFinanceMode && space === "personal"/);
 assert.match(app,/!privateFinanceMode && panel === "transfer"/);
 assert.match(app,/!privateFinanceMode && panel === "pos"/);
 assert.match(app,/privateMode=\{privateFinanceMode\}/);
 assert.match(css,/\.finance-auth-page/);
});

test('public demo and staging builds are explicitly isolated from manual private UI build',()=>{
 const publicWorkflow=readFileSync(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8');
 const stagingWorkflow=readFileSync(new URL('../../.github/workflows/staging.yml',import.meta.url),'utf8');
 const privateWorkflow=readFileSync(new URL('../../.github/workflows/manual-private-finance-ui-build.yml',import.meta.url),'utf8');
 assert.match(publicWorkflow,/VITE_FINANCES_PRIVATE_UI: 'false'/);
 assert.match(stagingWorkflow,/VITE_FINANCES_PRIVATE_UI: 'false'/);
 assert.match(privateWorkflow,/workflow_dispatch:/);
 assert.doesNotMatch(privateWorkflow,/^\s*push:/m);
 assert.match(privateWorkflow,/VITE_FINANCES_PRIVATE_UI: 'true'/);
 assert.match(privateWorkflow,/test "\$\{GITHUB_REF\}" = "refs\/heads\/main"/);
 assert.match(privateWorkflow,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(privateWorkflow,/actions-gh-pages|scp |ssh |deploy\/compose|aws s3/);
});
