/**
 * Offline, fail-closed normalized Docker Compose diff gate for future T007 release.
 * Takes *private* docker compose config --format json files on trusted host only.
 * Never store actual server configs or secrets in GitHub / Actions logs.
 */
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const expectedPort=p=>String(p.host_ip)==='127.0.0.1'&&String(p.published)==='8092'&&Number(p.target)===8092&&(!p.protocol||p.protocol==='tcp');
const keyset=o=>Object.keys(o||{}).sort();
const networkNames=o=>Array.isArray(o)?o.map(String).sort():keyset(o);
export function validateFinanceGatewayCompose(baseline,candidate,imageTag){
 const errors=[];
 const fail=(condition,code)=>{if(!condition)errors.push(code);};
 const A=baseline||{},B=candidate||{};
 fail(A.name==='finances2027'&&B.name==='finances2027','project_mismatch');
 fail(isDeepStrictEqual(keyset(A.services),['api','db','gateway']),'unexpected_baseline_services');
 fail(isDeepStrictEqual(keyset(B.services),['api','db','gateway']),'unexpected_candidate_services');
 for(const service of ['db','api'])fail(isDeepStrictEqual(A.services?.[service],B.services?.[service]),service+'_changed');
 for(const field of ['networks','volumes','configs','secrets'])fail(isDeepStrictEqual(A[field]||{},B[field]||{}),field+'_changed');
 const original=A.services?.gateway||{},next=B.services?.gateway||{};
 fail(typeof imageTag==='string'&&/^finances2027-gateway-candidate:[0-9a-f]{40}$/.test(imageTag),'candidate_tag_invalid');
 fail(next.image===imageTag,'candidate_image_mismatch');
 const published=next.ports||[];
 fail(Array.isArray(published)&&published.length===1&&expectedPort(published[0]),'gateway_port_not_loopback');
 fail(isDeepStrictEqual(original.networks||{},next.networks||{}),'gateway_networks_changed');
 fail(networkNames(next.networks).length>=1,'gateway_network_absent');
 fail(next.read_only===true,'gateway_root_fs_not_readonly');
 fail(Array.isArray(next.cap_drop)&&next.cap_drop.includes('ALL'),'gateway_capabilities_not_dropped');
 fail(Array.isArray(next.security_opt)&&next.security_opt.includes('no-new-privileges:true'),'gateway_privilege_escalation_not_blocked');
 fail(next.environment?.FINANCES_GATEWAY_API_ORIGIN==='http://api:8091','private_api_origin_mismatch');
 fail(next.environment?.FINANCES_GATEWAY_BIND_HOST==='0.0.0.0','container_bind_mismatch');
 fail(next.environment?.NODE_ENV==='production','gateway_not_production_mode');
 for(const key of ['FINANCES_API_TOKEN','FINANCES_SESSION_SECRET','FINANCES_OWNER_PASSWORD_HASH','FINANCES_PUBLIC_ORIGIN'])
    fail(typeof next.environment?.[key]==='string'&&next.environment[key].length>0,'missing_private_gateway_setting_'+key.replace('FINANCES_',''));
 // Never use fail-soft: only an *empty* set of issues passes.
 return Object.freeze({decision:errors.length===0?'safe_shape_only':'blocked',issues:Object.freeze(errors)});
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const [a,b,image]=process.argv.slice(2);
 if(!a||!b||!image){console.error('COMPOSE_DIFF_BLOCKED: missing offline inputs');process.exitCode=2;}
 else try{
   const result=validateFinanceGatewayCompose(JSON.parse(readFileSync(a,'utf8')),JSON.parse(readFileSync(b,'utf8')),image);
   console.log('GATEWAY_COMPOSE_DIFF_'+(result.decision==='safe_shape_only'?'SAFE_SHAPE_ONLY':'BLOCKED'));
   if(result.issues.length)console.log('BLOCKING_CHECKS='+result.issues.join(','));
   if(result.issues.length)process.exitCode=1;
 }catch{console.error('COMPOSE_DIFF_BLOCKED: invalid private inputs');process.exitCode=2;}
}
