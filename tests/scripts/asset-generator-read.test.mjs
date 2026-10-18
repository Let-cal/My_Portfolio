import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=process.cwd();
test('prebuild generators handle absent outputs and preserve exact committed assets without exists/read races',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'letcal-assets-'));
 try {
  mkdirSync(join(cwd,'public/fallback'),{recursive:true});mkdirSync(join(cwd,'public/images'),{recursive:true});
  const names=['koi-day','koi-night','dragon-day','dragon-night'];
  for(const name of names)copyFileSync(join(root,'public/fallback',name+'.jpg'),join(cwd,'public/fallback',name+'.jpg'));
  const commands=[[resolve(root,'scripts/generate-fallback-formats.mjs')],[resolve(root,'node_modules/tsx/dist/cli.mjs'),'--tsconfig',resolve(root,'tsconfig.json'),resolve(root,'scripts/generate-skill-sprite.ts')]];
  for(const args of commands){const run=spawnSync(process.execPath,args,{cwd,encoding:'utf8'});assert.equal(run.status,0,run.stderr);const check=spawnSync(process.execPath,[...args,'--check'],{cwd,encoding:'utf8'});assert.equal(check.status,0,check.stderr);}
  for(const name of names)assert.deepEqual(readFileSync(join(cwd,'public/fallback',name+'.avif')),readFileSync(join(root,'public/fallback',name+'.avif')));
  assert.deepEqual(readFileSync(join(cwd,'public/images/skill-sprite.svg')),readFileSync(join(root,'public/images/skill-sprite.svg')));
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
