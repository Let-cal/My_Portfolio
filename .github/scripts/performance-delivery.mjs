// CI-only production transport: no HTML/resource rewriting, prefetching or cache.
import http2 from 'node:http2';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createBrotliCompress,constants} from 'node:zlib';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function createPerformanceDelivery({key,cert,upstream,onFailure=()=>{}}) {
 const base=new URL(upstream);
 if(base.protocol!=='http:'||!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Performance upstream must be loopback HTTP');
 return http2.createSecureServer({key,cert,allowHTTP1:false},async(request,response)=>{
  try {
   if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
   const target=new URL(request.url,base);
   if(target.origin!==base.origin){response.writeHead(400);response.end();return;}
   const source=await fetch(base.origin+target.pathname+target.search,{method:request.method,headers:{'accept-encoding':'identity','x-forwarded-proto':'https','x-forwarded-host':request.headers[':authority']??'localhost'},redirect:'manual',signal:AbortSignal.timeout(60000)});
   const headers=Object.fromEntries(source.headers);
   for(const name of ['connection','keep-alive','transfer-encoding','upgrade','content-length','content-encoding','http2-settings'])delete headers[name];
   if(headers.location){const location=new URL(headers.location,base);if(location.origin===base.origin)headers.location=location.pathname+location.search+location.hash;}
   const acceptsBr=String(request.headers['accept-encoding']??'').split(',').some(part=>{const [coding,...options]=part.trim().split(';');const q=options.find(value=>value.trim().startsWith('q='));return coding==='br'&&(!q||Number(q.trim().slice(2))>0);});
   const compressed=acceptsBr&&![204,304].includes(source.status)&&/text\/|javascript|json|svg/.test(headers['content-type']??'');
   if(compressed){headers['content-encoding']='br';headers.vary=[headers.vary,'Accept-Encoding'].filter(Boolean).join(', ');if(headers.etag&&!headers.etag.startsWith('W/'))delete headers.etag;}
   response.writeHead(source.status,headers);
   if(request.method==='HEAD'||!source.body){response.end();return;}
   const body=Readable.fromWeb(source.body);
   if(compressed)await pipeline(body,createBrotliCompress({params:{[constants.BROTLI_PARAM_QUALITY]:5},flush:constants.BROTLI_OPERATION_FLUSH}),response);
   else await pipeline(body,response);
  }catch(error){
   // A browser closing its own stream is normal; an upstream/startup failure is not.
   if(request.stream?.rstCode===http2.constants.NGHTTP2_CANCEL)return;
   onFailure(error);
   if(response.destroyed)return;
   if(!response.headersSent)response.writeHead(502);
   response.end('Performance delivery failed');
  }
 });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const key=readFileSync(process.env.PERF_TLS_KEY),cert=readFileSync(process.env.PERF_TLS_CERT);
 const server=createPerformanceDelivery({key,cert,upstream:process.env.PERF_UPSTREAM??'http://127.0.0.1:3100',onFailure:error=>{
  writeFileSync(process.env.PERF_DELIVERY_ERROR_FILE??'.lighthouseci/delivery-error.json',JSON.stringify({failed:true,code:String(error.code??error.name)}));
 }});
 const sessions=new Set();server.on('session',session=>{sessions.add(session);session.on('close',()=>sessions.delete(session));});
 server.listen(3101,'127.0.0.1',()=>console.log('Loopback HTTP/2 + streaming Brotli delivery ready; upstream payloads unchanged'));
 const close=()=>{for(const session of sessions)session.destroy();server.close(()=>process.exit());};
 process.once('SIGTERM',close);process.once('SIGINT',close);
}
