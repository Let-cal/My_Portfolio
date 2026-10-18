import http2 from 'node:http2';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const upstream=process.env.PERF_UPSTREAM??'http://127.0.0.1:3100';
const origin='https://127.0.0.1:3101';
const client=http2.connect(origin,{ca:readFileSync(process.env.PERF_TLS_CERT),servername:'localhost'});
await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});
assert.equal(client.alpnProtocol,'h2');
async function request(path) {
 const stream=client.request({':path':path,'accept-encoding':'br'});let headers;const chunks=[];
 stream.on('response',value=>{headers=value;});stream.on('data',chunk=>chunks.push(chunk));stream.end();
 await new Promise((resolve,reject)=>{stream.once('end',resolve);stream.once('error',reject);});
 const encoded=Buffer.concat(chunks);return {headers,bytes:headers['content-encoding']==='br'?brotliDecompressSync(encoded):encoded};
}
try {
 const manifest=JSON.parse(readFileSync('.next/build-manifest.json','utf8'));
 const css=readdirSync('.next/static/css',{recursive:true}).find(file=>file.endsWith('.css'));
 assert.ok(css,'No built stylesheet found for transport verification');
 const font=JSON.parse(readFileSync('src/app/fonts/site-subsets.json','utf8'))[0].file;
 const paths=['/en','/ja','/vi','/_next/'+manifest.rootMainFiles.find(file=>file.endsWith('.js')),'/_next/static/css/'+css.replaceAll('\\','/'),'/fonts/'+encodeURIComponent(font),'/images/roles/optimized/role-developer-384.avif','/icon.svg','/missing-transport-fixture.svg'];
 const records=[];
 for(const path of paths){
  const direct=await fetch(upstream+path,{headers:{'accept-encoding':'identity'},redirect:'manual'});
  const bytes=Buffer.from(await direct.arrayBuffer());const served=await request(path);
  assert.equal(served.headers[':status'],direct.status,path);
  for(const name of ['content-type','cache-control','location'])assert.equal(served.headers[name]??null,direct.headers.get(name),path+': '+name);
  assert.ok(served.bytes.equals(bytes),path+': decoded payload changed');
  if(/text\/|javascript|svg/.test(direct.headers.get('content-type')??''))assert.equal(served.headers['content-encoding'],'br',path);
  records.push({path,status:direct.status,decodedSha256:createHash('sha256').update(bytes).digest('hex'),encoding:served.headers['content-encoding']??'identity',protocol:'h2'});
 }
 writeFileSync('.lighthouseci/delivery-equivalence.json',JSON.stringify(records,null,2)+'\n');
 console.log(`HTTP/2 delivery verified: ${records.length} decoded responses identical; HTML/JS/CSS/font/image/SVG/error coverage`);
}finally{client.close();}
