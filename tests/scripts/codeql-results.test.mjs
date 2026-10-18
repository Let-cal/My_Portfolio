import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../../.github/scripts/check-codeql.mjs').catch(()=>({}));
const finding=(severity='7.7')=>({runs:[{tool:{driver:{rules:[]},extensions:[{rules:[{id:'js/file-system-race',defaultConfiguration:{level:'warning'},properties:{'security-severity':severity}}]}]},results:[{ruleId:'js/file-system-race'}]}]});
test('CodeQL high findings in extension rules block release',()=>{
 assert.equal(typeof api.reviewCodeql,'function');
 assert.equal(api.reviewCodeql(finding()).blocking.length,1);
});
test('medium findings remain visible and clean analyses pass',()=>{
 const medium=api.reviewCodeql(finding('6.3'));assert.equal(medium.blocking.length,0);assert.equal(medium.findings.length,1);
 assert.equal(api.reviewCodeql({runs:[{tool:{driver:{rules:[]}},results:[]}]}).blocking.length,0);
});
test('unknown rules, malformed severity and missing analyses fail closed',()=>{
 const unknown=finding();unknown.runs[0].tool.extensions=[];assert.throws(()=>api.reviewCodeql(unknown),/rule/i);
 assert.throws(()=>api.reviewCodeql(finding('NaN')),/severity/i);
 for(const invalid of ['',false,null,[],{}])assert.throws(()=>api.reviewCodeql(finding(invalid)),/severity/i);
 assert.throws(()=>api.reviewCodeql({runs:[]}),/analysis/i);
});
test('error-level nonsecurity findings and driver rules are checked',()=>{
 const r=finding('0');r.runs[0].tool.driver.rules=r.runs[0].tool.extensions[0].rules;delete r.runs[0].tool.extensions;
 r.runs[0].results[0].level='error';assert.equal(api.reviewCodeql(r).blocking.length,1);
});
