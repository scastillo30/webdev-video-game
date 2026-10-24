(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const ui={form:byId('controls'),duration:byId('duration'),sample:byId('sample'),cycle:byId('cycle'),mode:byId('mode'),start:byId('start'),stop:byId('stop'),download:byId('download'),frame:byId('target'),route:byId('route'),result:byId('result'),resultMetric:byId('resultMetric'),elapsed:byId('elapsed'),samples:byId('samples'),heap:byId('heap'),lag:byId('lag'),log:byId('log')};
  let run=null;
  let lastRun=null;
  const params=new URLSearchParams(location.search);
  if(params.has('duration'))ui.duration.value=params.get('duration');
  if(params.has('sample'))ui.sample.value=params.get('sample');
  if(params.has('cycle'))ui.cycle.value=params.get('cycle');
  if(params.get('mode')==='cycle')ui.mode.value='cycle';

  const clock=seconds=>[Math.floor(seconds/3600),Math.floor(seconds%3600/60),Math.floor(seconds%60)].map(value=>String(value).padStart(2,'0')).join(':');
  const bytes=value=>value==null?'N/A':`${(value/1048576).toFixed(1)} MB`;
  const addLog=(message,kind='')=>{const item=document.createElement('li');item.className=kind;item.textContent=`${new Date().toLocaleTimeString()} · ${message}`;ui.log.prepend(item)};
  const setRoute=route=>{ui.route.textContent=route.toUpperCase();ui.frame.src=`${route}?soak=1&run=${encodeURIComponent(run.startedAt)}`;run.route=route;run.routeChangedAt=Date.now();addLog(`Loaded ${route}`)};
  const currentRoute=()=>{try{return ui.frame.contentWindow.location.pathname}catch{return run?.route??''}};
  const frameMetrics=()=>{try{const doc=ui.frame.contentDocument;const memory=ui.frame.contentWindow.performance.memory;return{canvasCount:doc?doc.querySelectorAll('canvas').length:null,heapBytes:memory?.usedJSHeapSize??null}}catch{return{canvasCount:null,heapBytes:null}}};
  const fail=message=>{if(!run.failures.includes(message)){run.failures.push(message);addLog(message,'fail')}};

  async function sample(){
    if(!run)return;
    const active=run;
    const sampledAt=Date.now();
    const expected=run.lastSampleAt+run.sampleMs;
    const eventLoopLag=Math.max(0,sampledAt-expected);
    run.lastSampleAt=sampledAt;
    const route=currentRoute();
    const frame=frameMetrics();
    let operations=null;
    try{const response=await fetch('/api/operations/status',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);operations=await response.json()}catch(error){if(run===active)fail(`Operations API unavailable: ${error.message}`)}
    if(run!==active)return;
    const settled=sampledAt-run.routeChangedAt>Math.min(10000,run.cycleMs/2);
    if(settled&&route==='/game'&&frame.canvasCount!==1)fail(`Game route expected one canvas; observed ${frame.canvasCount}`);
    if(settled&&route==='/'&&frame.canvasCount!==0)fail(`Office route expected zero canvases; observed ${frame.canvasCount}`);
    if(operations?.status==='degraded')addLog(`Backend reports degraded Jira state: ${operations.connection.state}`);
    const entry={sampledAt:new Date(sampledAt).toISOString(),route,canvasCount:frame.canvasCount,heapBytes:frame.heapBytes,eventLoopLagMs:eventLoopLag,operations};
    run.samples.push(entry);
    run.maxHeap=Math.max(run.maxHeap,frame.heapBytes??0);
    run.maxLag=Math.max(run.maxLag,eventLoopLag);
    ui.samples.textContent=String(run.samples.length);ui.heap.textContent=run.maxHeap?bytes(run.maxHeap):'UNSUPPORTED';ui.lag.textContent=`${run.maxLag} ms`;
    if(eventLoopLag>Math.max(2000,run.sampleMs*.5))fail(`Event loop lag exceeded threshold: ${eventLoopLag} ms`);
    if(run.initialHeap&&frame.heapBytes&&frame.heapBytes-run.initialHeap>157286400)fail(`Heap grew more than 150 MB from the first supported sample`);
    if(!run.initialHeap&&frame.heapBytes)run.initialHeap=frame.heapBytes;
  }

  function tick(){
    if(!run)return;
    const elapsed=(Date.now()-run.startedMs)/1000;ui.elapsed.textContent=clock(elapsed);
    if(elapsed>=run.durationSeconds)finish('completed');
  }

  function cycleRoute(){
    if(!run||run.mode!=='cycle')return;
    setRoute(run.route==='/game'?'/':'/game');
  }

  function start(event){
    event?.preventDefault();if(run)return;
    const durationSeconds=params.has('durationSeconds')?Math.max(10,Number(params.get('durationSeconds'))):Math.max(60,Number(ui.duration.value)*60);
    const sampleMs=Math.max(5000,Number(ui.sample.value)*1000);
    const cycleMs=params.has('cycleSeconds')?Math.max(10000,Number(params.get('cycleSeconds'))*1000):Math.max(60000,Number(ui.cycle.value)*60000);
    const startedMs=Date.now();
    run={startedAt:new Date(startedMs).toISOString(),startedMs,durationSeconds,sampleMs,cycleMs,mode:ui.mode.value,route:'/game',routeChangedAt:startedMs,lastSampleAt:startedMs,samples:[],failures:[],initialHeap:0,maxHeap:0,maxLag:0,timers:[]};
    lastRun=null;ui.log.replaceChildren();ui.elapsed.textContent='00:00:00';ui.samples.textContent='0';ui.heap.textContent='N/A';ui.lag.textContent='0 ms';ui.start.disabled=true;ui.stop.disabled=false;ui.download.disabled=true;ui.result.textContent='RUNNING';ui.resultMetric.dataset.state='';addLog(`Soak started for ${clock(durationSeconds)} in ${run.mode} mode`);
    setRoute('/game');
    run.timers.push(setInterval(tick,1000),setInterval(sample,sampleMs));
    if(run.mode==='cycle')run.timers.push(setInterval(cycleRoute,cycleMs));
    setTimeout(sample,Math.min(5000,sampleMs));
  }

  function finish(reason){
    if(!run)return;
    const completed=run;
    completed.timers.forEach(clearInterval);completed.completedAt=new Date().toISOString();completed.reason=reason;completed.passed=completed.failures.length===0;completed.manualHardwareReviewRequired=true;
    lastRun=completed;run=null;
    ui.result.textContent=completed.passed?'PASS':'FAIL';ui.resultMetric.dataset.state=completed.passed?'pass':'fail';ui.start.disabled=false;ui.stop.disabled=true;ui.download.disabled=false;addLog(`Soak ${reason}: ${completed.passed?'no automated failures':'review failures'}`,completed.passed?'pass':'fail');
  }

  function download(){
    if(!lastRun)return;
    const report={...lastRun,timers:undefined,hardwareReview:{observer:'',notes:'',cpuObservation:'',gpuObservation:'',thermalObservation:''},notes:'Fill hardwareReview, then set manualHardwareReviewRequired to false after sign-off.'};
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));link.download=`webdev-tv-soak-${lastRun.startedAt.replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }

  ui.form.addEventListener('submit',start);ui.stop.addEventListener('click',()=>finish('stopped'));ui.download.addEventListener('click',download);
  window.addEventListener('beforeunload',event=>{if(run&&!run.completedAt){event.preventDefault();event.returnValue=''}});
  if(params.get('auto')==='1')start();
})();
