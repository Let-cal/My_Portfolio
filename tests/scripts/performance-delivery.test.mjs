import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import http2 from 'node:http2';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {brotliDecompressSync,createBrotliDecompress} from 'node:zlib';
const api=await import('../../.github/scripts/performance-delivery.mjs').catch(()=>({}));

test('production transport uses H2, preserves decoded content/status/query, negotiates Brotli and streams early chunks',async()=>{
 assert.equal(typeof api.createPerformanceDelivery,'function');
 const directory=mkdtempSync(join(tmpdir(),'letcal-delivery-'));
 const openssl=process.platform==='win32'?join(dirname(dirname(execFileSync('where.exe',['git'],{encoding:'utf8'}).trim().split(/\r?\n/)[0])),'usr/bin/openssl.exe'):'openssl';
 let upstream,server,client,endStream;const failures=[];
 try{
  execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
  const cert=readFileSync(join(directory,'cert.pem')),key=readFileSync(join(directory,'key.pem'));
  upstream=http.createServer((req,res)=>{
   assert.equal(req.headers['accept-encoding'],'identity');
   if(req.url==='/stream'){res.writeHead(200,{'content-type':'text/html'});res.write('first');endStream=()=>res.end('last');return;}
   if(req.url==='/redirect'){res.writeHead(307,{location:'/html?q=a%2Bb'});res.end();return;}
   if(req.url==='/error'){res.writeHead(503,{'content-type':'text/plain'});res.end('upstream unavailable');return;}
   if(req.url==='/truncated'){res.writeHead(200,{'content-type':'text/plain'});res.write('partial');setTimeout(()=>res.destroy(),30);return;}
   const binary=req.url==='/binary';const bytes=binary?Buffer.from([0,255,128,1]):Buffer.from('日本語 — '+req.url);
   res.writeHead(200,{'content-type':binary?'image/avif':'text/html; charset=utf-8','content-length':bytes.length,'cache-control':'public, max-age=60','vary':'RSC'});res.end(req.method==='HEAD'?undefined:bytes);
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  server=api.createPerformanceDelivery({key,cert,upstream:`http://127.0.0.1:${upstream.address().port}`,onFailure:error=>failures.push(error)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  client=http2.connect(`https://127.0.0.1:${server.address().port}`,{ca:cert,servername:'localhost'});
  await new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('error',reject);});assert.equal(client.alpnProtocol,'h2');
  async function request(path,method='GET',encoding='br'){
   const stream=client.request({':path':path,':method':method,'accept-encoding':encoding});let headers;const chunks=[];
   stream.on('response',value=>{headers=value;});stream.on('data',chunk=>chunks.push(chunk));
   await new Promise((resolve,reject)=>{stream.on('end',resolve);stream.on('error',reject);stream.end();});
   return {headers,bytes:Buffer.concat(chunks)};
  }
  const html=await request('/html?q=a%2Bb');assert.equal(html.headers[':status'],200);assert.equal(html.headers['content-encoding'],'br');assert.equal(html.headers['cache-control'],'public, max-age=60');assert.match(html.headers.vary,/RSC/);assert.match(html.headers.vary,/Accept-Encoding/i);assert.equal(html.headers['content-length'],undefined);assert.equal(brotliDecompressSync(html.bytes).toString(),'日本語 — /html?q=a%2Bb');
  const binary=await request('/binary');assert.equal(binary.headers['content-encoding'],undefined);assert.ok(binary.bytes.equals(Buffer.from([0,255,128,1])));
  const identity=await request('/html','GET','br;q=0');assert.equal(identity.headers['content-encoding'],undefined);assert.equal(identity.bytes.toString(),'日本語 — /html');
  const head=await request('/html','HEAD');assert.equal(head.bytes.length,0);
  const redirect=await request('/redirect');assert.equal(redirect.headers[':status'],307);assert.equal(redirect.headers.location,'/html?q=a%2Bb');
  const error=await request('/error');assert.equal(error.headers[':status'],503);assert.equal(brotliDecompressSync(error.bytes).toString(),'upstream unavailable');
  assert.equal((await request('/html','POST')).headers[':status'],405);
  const streamed=client.request({':path':'/stream','accept-encoding':'br'});const decoded=streamed.pipe(createBrotliDecompress());
  const early=await Promise.race([new Promise((resolve,reject)=>{decoded.once('data',chunk=>resolve(chunk.toString()));decoded.once('error',reject);}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('proxy buffered the stream')),5000).unref())]);
  assert.equal(early,'first');endStream();await new Promise(resolve=>decoded.on('end',resolve));decoded.resume();
  assert.equal(failures.length,0);
  await request('/truncated').catch(()=>{});
  assert.ok(failures.length>0,'an aborted upstream stream must record delivery failure');
 }finally{endStream?.();client?.destroy();await new Promise(resolve=>server?server.close(resolve):resolve());await new Promise(resolve=>upstream?upstream.close(resolve):resolve());rmSync(directory,{recursive:true,force:true});}
});
