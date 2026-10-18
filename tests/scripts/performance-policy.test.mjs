import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { evaluatePerformance } from '../../scripts/performance-budgets.mjs';
const api = await import('../../scripts/performance-policy.mjs').catch(() => ({}));
const hash = 'a'.repeat(64);
const exception = {id:'fe-v1-2026-10-18',sourceCommit:'9317fc973a6df54c78d291c0c4871cb8a066b976',applicationHash:hash,approvedOn:'2026-10-18',expiresAt:'2026-10-25T16:59:59Z',limits:{lcp:4000,tbt:300},followUp:'https://github.com/Let-cal/My_Portfolio/issues/2'};
const now = new Date('2026-10-18T12:00:00Z');
const report = (values={}) => ({categories:{performance:{score:values.performance??.9},accessibility:{score:values.accessibility??1}},audits:{'largest-contentful-paint':{numericValue:values.lcp??3300},'total-blocking-time':{numericValue:values.tbt??239},'cumulative-layout-shift':{numericValue:values.cls??.00138}}});
const policy = (changes={}) => {assert.equal(typeof api.resolvePerformancePolicy,'function');return api.resolvePerformancePolicy({exception,applicationHash:hash,now,...changes});};

test('approved scoped v1 tolerances pass while original target misses remain visible',()=>{
 const result=evaluatePerformance([report(),report(),report()],policy());
 assert.deepEqual(result.failures,[]);
 assert.equal(result.targetFailures.length,2);
 assert.equal(result.policy.id,exception.id);
});
test('expiry boundary or changed application restores strict budgets',()=>{
 for(const p of [policy({now:new Date(exception.expiresAt)}),policy({applicationHash:'b'.repeat(64)})]) {
  assert.equal(p.id,'strict');
  assert.equal(evaluatePerformance([report(),report(),report()],p).failures.length,2);
 }
});
test('v1 caps are inclusive but cannot waive other release requirements or invalid metrics',()=>{
 const p=policy();
 assert.deepEqual(evaluatePerformance(Array(3).fill(report({lcp:4000,tbt:300})),p).failures,[]);
 const bad=report({performance:.84,accessibility:.94,lcp:4001,tbt:301,cls:.101});
 assert.equal(evaluatePerformance([bad,bad,bad],p).failures.length,5);
 assert.throws(()=>evaluatePerformance([{},report(),report()],p),/missing|invalid/);
});
test('malformed, future approval or broadened exception fails closed',()=>{
 for(const change of [{limits:{lcp:5000,tbt:300}},{limits:{lcp:4000,tbt:300,performance:0,accessibility:0,cls:99}},{expiresAt:'invalid'},{applicationHash:'bad'},{approvedOn:'2026-10-19'},{sourceCommit:'bad'},{followUp:''}])
  assert.throws(()=>policy({exception:{...exception,...change}}),/exception|approval/i);
});
test('untracked and dirty build inputs cannot borrow the committed application exception',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'letcal-policy-'));
 const git=(...args)=>execFileSync('git',args,{cwd,stdio:'pipe'});
 try {
  git('init');writeFileSync(join(cwd,'package.json'),'{}\n');git('add','package.json');
  git('-c','user.name=Policy Test','-c','user.email=policy@example.invalid','-c','commit.gpgsign=false','commit','-m','fixture');
  const original=api.readApplicationHash('HEAD',{cwd});
  writeFileSync(join(cwd,'.lcp-probe.tmp.mjs'),'// user-owned diagnostic, not a build input\n');
  assert.equal(api.readApplicationHash('HEAD',{cwd}),original);
  writeFileSync(join(cwd,'new-build-config.js'),'export default {}\n');
  assert.throws(()=>api.readApplicationHash('HEAD',{cwd}),/untracked|inputs/i);
  rmSync(join(cwd,'new-build-config.js'));
  writeFileSync(join(cwd,'package.json'),'{"changed":true}\n');
  assert.throws(()=>api.readApplicationHash('HEAD',{cwd}),/inputs|committed/i);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
test('application fingerprint detects source, dependencies, config and prebuild changes',()=>{
 assert.equal(typeof api.fingerprintApplication,'function');
 const files=[{path:'src/app/page.tsx',oid:'a'},{path:'public/koi.glb',oid:'b'},{path:'package-lock.json',oid:'c'},{path:'next.config.ts',oid:'d'},{path:'scripts/generate-site-icons.mjs',oid:'e'}];
 const original=api.fingerprintApplication(files);
 for(let index=0;index<files.length;index++) assert.notEqual(api.fingerprintApplication(files.map((file,i)=>i===index?{...file,oid:'changed'}:file)),original);
 assert.notEqual(api.fingerprintApplication([...files,{path:'new-build-config.js',oid:'f'}]),original);
 for(const path of ['docs/report.md','README.md','.github/workflows/ci.yml','tests/scripts/performance-policy.test.mjs','scripts/performance-policy.mjs','scripts/fe-v1-performance-exception.json']) assert.equal(api.fingerprintApplication([...files,{path,oid:'other'}]),original,path);
 assert.equal(api.fingerprintApplication([...files].reverse()),original);
});
