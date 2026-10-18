import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const STRICT_LIMITS = Object.freeze({performance:.85,accessibility:.95,lcp:2500,tbt:200,cls:.1});
const strict = reason => ({id:'strict',reason,limits:STRICT_LIMITS});
const policyFiles = new Set(['scripts/performance-policy.mjs','scripts/performance-budgets.mjs','scripts/check-performance.mjs','scripts/fe-v1-performance-exception.json']);
const documentation = new Set(['README.md','README.ja.md','AGENTS.md','CONTRIBUTING.md','SECURITY.md']);
export function isApplicationInput(path) {
  // This pre-existing, user-owned probe is not imported or used by the build.
  return path!=='.lcp-probe.tmp.mjs' && !path.startsWith('docs/') && !path.startsWith('tests/') && !path.startsWith('.github/') && !documentation.has(path) && !policyFiles.has(path);
}
export function fingerprintApplication(files) {
  const entries = files.filter(file=>isApplicationInput(file.path)).map(file=>`${file.path}\0${file.oid}`).sort();
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}
export function readApplicationHash(ref='HEAD',{cwd=process.cwd()}={}) {
  const options={cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']};
  const dirty = execFileSync('git',['diff','--name-only','HEAD','-z'],options).split('\0').filter(Boolean);
  const changedInputs=dirty.filter(isApplicationInput);
  if(changedInputs.length) throw new Error(`Application inputs differ from committed revision: ${changedInputs.join(', ')}; commit them before checking release policy`);
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],options).split('\0').filter(Boolean);
  if(untracked.some(isApplicationInput)) throw new Error('Untracked application inputs must be reviewed and committed before checking release policy');
  const entries=execFileSync('git',['ls-tree','-rz',ref],options).split('\0').filter(Boolean).map(entry=>{
    const tab=entry.indexOf('\t');
    const [mode,type,oid]=entry.slice(0,tab).split(' ');
    return {path:entry.slice(tab+1),oid:`${mode} ${type} ${oid}`};
  });
  return fingerprintApplication(entries);
}
export function resolvePerformancePolicy({exception,applicationHash,now=new Date()}) {
  if(!exception) return strict('No approved exception');
  const approved=Date.parse(exception.approvedOn+'T00:00:00+07:00');
  const expires=Date.parse(exception.expiresAt);
  const valid = [
    exception.id==='fe-v1-2026-10-18',
    /^[a-f0-9]{40}$/.test(exception.sourceCommit??''),
    /^[a-f0-9]{64}$/.test(exception.applicationHash??''),
    Number.isFinite(approved), Number.isFinite(expires),
    expires>approved, expires<=Date.parse('2026-10-25T16:59:59Z'),
    exception.approvedOn==='2026-10-18',
    Number.isFinite(now.getTime()), approved<=now.getTime(),
    Object.keys(exception.limits??{}).sort().join(',')==='lcp,tbt',
    exception.limits?.lcp===4000, exception.limits?.tbt===300,
    /^https:\/\/github\.com\/Let-cal\/My_Portfolio\/issues\/\d+$/.test(exception.followUp??''),
  ].every(Boolean);
  if(!valid) throw new Error('Invalid FE v1 performance exception or approval');
  if(now.getTime()>=expires) return strict('Approved exception expired');
  if(applicationHash!==exception.applicationHash) return strict('Application content differs from reviewed FE v1');
  return {id:exception.id,reason:'Owner-approved FE v1 loading tolerance',expiresAt:exception.expiresAt,sourceCommit:exception.sourceCommit,applicationHash,followUp:exception.followUp,limits:{...STRICT_LIMITS,lcp:exception.limits.lcp,tbt:exception.limits.tbt}};
}
