// CF IP 优选工具 (CFNB) - 后台工作脚本
// 每分钟运行一次，处理后台优选任务的下一批 IP
(async function(){
 'use strict';
 const KEY='CFOptimizer.state.v3', PIN='CFOptimizer.pin.v1';
 const read=()=>{try{const s=JSON.parse($persistentStore.read(KEY)||'{}');return (s&&typeof s==='object')?s:{}}catch(_){return {}}};
 const save=s=>$persistentStore.write(JSON.stringify(s),KEY)!==false;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const nowMs=()=>Date.now();
 function api(method,path){return new Promise(r=>$httpAPI(method,path,null,x=>r(x||{})))}
 function get(url,bin,timeout,policy){return new Promise(r=>{const t=nowMs();$httpClient.get({url,timeout,policy,'insecure':false,'auto-redirect':false,'auto-cookie':false,'binary-mode':!!bin,headers:{'Cache-Control':'no-cache','Accept-Encoding':'identity'}},function(e,x,d){r({err:e?String(e).slice(0,90):null,status:x?+x.status:0,data:d,ms:nowMs()-t})})})}
 async function recs(){const r=await api('GET','/v1/requests/recent?filter=speed.cloudflare.com&limit=20');return r.requests||[]}
 const hostOk=x=>x&&String(x.remoteHost||'').indexOf('speed.cloudflare.com')===0;
 async function pinIp(ip){if($persistentStore.write(ip,PIN)===false)throw Error('pin-store-failed');await api('POST','/v1/dns/flush');await sleep(180)}
 const clearPin=()=>{try{$persistentStore.write('none',PIN)}catch(_){}};
 async function probe(ip,cfg){
  const r={ip,mode:'direct',version:ip.indexOf(':')>=0?'IPv6':'IPv4',tries:0,ok:0,samples:[],avg:null,min:null,max:null,mbps:null,bytes:0,downloadMs:null,colo:null,verified:false,verify:'none',peer:null,status:'unavailable',reason:null,time:nowMs()};
  for(let i=0;i<cfg.tries;i++){
   r.tries++;
   try{
    await pinIp(ip);
    const t0=nowMs();
    const t=await get('https://speed.cloudflare.com/cdn-cgi/trace',false,cfg.timeout,'DIRECT');
    if(t.status!==200)throw Error(t.err||('http-'+t.status));
    const list=await recs();
    const fresh=list.filter(x=>hostOk(x)&&(x.startDate||0)>=(t0/1000-1));
    const hit=fresh.find(x=>x.remoteAddress===ip);
    if(!hit)throw Error('peer-mismatch');
    r.verified=true;r.verify='ip';r.ok++;r.samples.push(t.ms);
    const c=/(?:^|\\n)colo=([A-Z]{3})/.exec(String(t.data||''));if(c)r.colo=c[1];
    if(cfg.download&&r.mbps===null){
     const d=await get('https://speed.cloudflare.com/__down?bytes=1048576',true,Math.max(cfg.timeout,5),'DIRECT');
     const b=d.data&&d.data.byteLength||0;
     if(d.status===200&&b===1048576&&d.ms>0){r.bytes=b;r.downloadMs=d.ms;r.mbps=b*8/(d.ms*1000)}
    }
   }catch(e){r.reason=String(e.message||e).slice(0,70)}
  }
  if(r.samples.length){r.min=Math.min(...r.samples);r.max=Math.max(...r.samples);r.avg=r.min}
  r.success=r.tries?r.ok/r.tries:0;r.status=r.ok>0?'ok':'unavailable';r.time=nowMs();
  return r;
 }
 try{
  const s=read();
  if(!s.background||s.status!=='running'||!s.queue||!s.queue.length){
   if(s.background&&s.status==='running'&&(!s.queue||!s.queue.length)){s.status='done';s.running=false;clearPin();save(s)}
   return $done();
  }
  const cfg=s.cfg||{};
  const t0=nowMs();
  let n=0;
  while(s.queue.length&&nowMs()-t0<50000&&n<5){
   const ip=s.queue.shift();s.current=ip;s.lastTick=nowMs();save(s);
   try{
    const res=await probe(ip,cfg);
    s.direct.push(res);s.results=s.direct;
   }catch(e){s.error=String(e.message||e).slice(0,80)}
   s.done=(s.done||0)+1;n++;s.lastTick=nowMs();save(s);
  }
  s.running=s.queue.length>0;s.status=s.running?'running':'done';
  if(!s.running)clearPin();
  save(s);
  $done();
 }catch(e){$done()}
})();
