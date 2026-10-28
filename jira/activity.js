(function(){
  'use strict';

  const text=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
  const nullable=(value,max=120)=>{const result=text(value,max);return result||null};
  const validUrl=value=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};

  function normalizeEvent(raw,issueBaseUrl=''){
    if(!raw||typeof raw!=='object')return null;
    const eventId=text(raw.eventId||raw.id,160),authorId=text(raw.authorId||raw.author?.id||raw.author?.accountId,160),ticketKey=text(raw.ticketKey||raw.issue?.key,50).toUpperCase();
    if(!eventId||!authorId||!ticketKey)return null;
    const timestampValue=raw.timestamp||raw.createdAt||raw.eventTime;
    const timestamp=new Date(timestampValue);
    if(Number.isNaN(timestamp.getTime()))return null;
    const suppliedUrl=text(raw.ticketUrl||raw.issue?.url,600),base=text(issueBaseUrl,500).replace(/\/$/,'');
    const suppliedColor=text(raw.statusColor,20),statusColor=/^#[0-9a-f]{6}$/i.test(suppliedColor)?suppliedColor:'';
    return Object.freeze({
      eventId,authorId,authorName:text(raw.authorName||raw.author?.name||'Unknown JIRA user',100),
      assigneeId:nullable(raw.assigneeId||raw.assignee?.id||raw.assignee?.accountId,160),assigneeName:nullable(raw.assigneeName||raw.assignee?.name,100),
      ticketKey,ticketTitle:text(raw.ticketTitle||raw.issue?.title||raw.issue?.summary||'Untitled issue',300),
      ticketUrl:validUrl(suppliedUrl||(base?`${base}/browse/${encodeURIComponent(ticketKey)}`:'')),
      action:text(raw.action||raw.eventType||'UPDATED',50).toUpperCase(),previousStatus:nullable(raw.previousStatus,100),newStatus:nullable(raw.newStatus,100),currentStatus:nullable(raw.currentStatus||raw.issue?.status,100),timestamp:timestamp.toISOString(),
      narration:text(raw.narration,500),statusColor
    });
  }

  class ActivityQueue{
    constructor({historyLimit=30,issueBaseUrl='',pendingFilter=null}={}){this.historyLimit=historyLimit;this.issueBaseUrl=issueBaseUrl;this.pendingFilter=typeof pendingFilter==='function'?pendingFilter:()=>true;this.seen=new Set();this.pending=new Map();this.authorOrder=[];this.cursor=0;this.history=new Map()}
    ingest(rawEvents=[]){const accepted=[];for(const raw of rawEvents){const event=normalizeEvent(raw,this.issueBaseUrl);if(!event||this.seen.has(event.eventId))continue;this.seen.add(event.eventId);accepted.push(event);if(this.pendingFilter(event)){if(!this.pending.has(event.authorId)){this.pending.set(event.authorId,[]);this.authorOrder.push(event.authorId)}this.pending.get(event.authorId).push(event)}const history=this.history.get(event.authorId)||[];history.push(event);history.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));this.history.set(event.authorId,history.slice(0,this.historyLimit))}return accepted}
    takeNext(){if(!this.authorOrder.length)return null;for(let offset=0;offset<this.authorOrder.length;offset++){const index=(this.cursor+offset)%this.authorOrder.length,authorId=this.authorOrder[index],events=this.pending.get(authorId)||[];if(!events.length)continue;events.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));this.pending.set(authorId,[]);this.cursor=(index+1)%this.authorOrder.length;return{authorId,events,primary:events[0]}}return null}
    pendingTotal(){let count=0;for(const events of this.pending.values())count+=events.length;return count}
    pendingAuthors(){let count=0;for(const events of this.pending.values())if(events.length)count++;return count}
    pendingForCharacter(characterId,mapping){let count=0;for(const [authorId,events] of this.pending)if(mapping[authorId]===characterId)count+=events.length;return count}
    historyForAuthor(authorId){return [...(this.history.get(authorId)||[])]}
    knownAuthors(){return [...this.history.entries()].map(([authorId,events])=>({authorId,authorName:events[0]?.authorName||authorId}))}
  }

  class ActivityController{
    constructor({config,adapter,queue,onEvents,onConnection}){this.config=config;this.adapter=adapter;this.queue=queue;this.onEvents=onEvents||(()=>{});this.onConnection=onConnection||(()=>{});this.timer=null;this.lastSuccess=0;this.running=false;this.pollQueued=false}
    async poll(){if(this.running){this.pollQueued=true;return}do{this.pollQueued=false;this.running=true;this.onConnection({state:'loading',lastSuccess:this.lastSuccess});try{const result=await this.adapter.fetchActivities({since:this.lastSuccess?new Date(this.lastSuccess).toISOString():null});const events=Array.isArray(result)?result:(result?.events||[]),connection=result?.connection||'live',accepted=this.queue.ingest(events);this.lastSuccess=Date.now();this.onConnection({state:connection,lastSuccess:this.lastSuccess});if(accepted.length)this.onEvents(accepted)}catch(error){this.onConnection({state:'disconnected',lastSuccess:this.lastSuccess,error:error?.message||'Activity source unavailable'})}finally{this.running=false}}while(this.pollQueued)}
    start(){this.poll();this.timer=setInterval(()=>this.poll(),this.config.pollIntervalMs)}
    stop(){clearInterval(this.timer);this.timer=null}
  }

  function disconnectedAdapter(){return{fetchActivities:async()=>({connection:'disconnected',events:[]})}}
  function demoAdapter(fixtures){let delivered=false;return{fetchActivities:async()=>{if(delivered)return{connection:'demo',events:[]};delivered=true;const now=Date.now();return{connection:'demo',events:fixtures.map(item=>({...item,timestamp:new Date(now-item.timestampOffsetMs).toISOString()}))}}}}
  function jsonDemoAdapter(url){let delivered=false;return{fetchActivities:async()=>{if(delivered)return{connection:'demo',events:[]};const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Example activity JSON unavailable (${response.status})`);const payload=await response.json(),fixtures=Array.isArray(payload)?payload:payload.events;if(!Array.isArray(fixtures))throw new Error('Example activity JSON must contain an events array');delivered=true;const now=Date.now();return{connection:'demo',events:fixtures.map(item=>({...item,timestamp:item.timestamp||new Date(now-(Number(item.timestampOffsetMs)||0)).toISOString()}))}}}}

  window.JiraActivity={ActivityQueue,ActivityController,normalizeEvent,disconnectedAdapter,demoAdapter,jsonDemoAdapter};
})();
