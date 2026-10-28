import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {SpectatorItem, SpectatorState} from '../engine/game.models';

@Injectable()
export class SpectatorDirectorService{
  private readonly state=new BehaviorSubject<SpectatorState>({active:null,focusCharacterId:null,autoEnabled:true,paused:false,pending:0});
  private readonly queues=new Map<string,SpectatorItem[]>();
  private readonly historyByCharacter=new Map<string,SpectatorItem[]>();
  private readonly latestByCharacter=new Map<string,SpectatorItem>();
  private readonly seenEventIds=new Set<string>();
  private characterOrder:string[]=[];
  private characterBag:string[]=[];
  private readonly eventBags=new Map<string,string[]>();
  private readonly lastEventByCharacter=new Map<string,string>();
  private lastCharacterId:string|null=null;
  private timer:number|null=null;
  private intervalMs=15_000;
  readonly state$=this.state.asObservable();

  configure(autoEnabled:boolean,intervalSeconds:number):void{
    const nextInterval=Math.min(300,Math.max(5,intervalSeconds))*1000;
    const changed=this.state.value.autoEnabled!==autoEnabled||this.intervalMs!==nextInterval;
    this.intervalMs=nextInterval;
    if(!changed)return;
    this.clearTimer();
    if(!autoEnabled)this.publish({...this.state.value,active:null,focusCharacterId:null,autoEnabled:false});
    else{
      this.publish({...this.state.value,autoEnabled:true});
      if(!this.state.value.paused&&!this.state.value.active)this.advance();else if(!this.state.value.paused)this.armTimer();
    }
  }

  ingest(items:SpectatorItem[]):void{
    for(const item of [...items].reverse()){
      if(this.seenEventIds.has(item.event.eventId))continue;
      this.seenEventIds.add(item.event.eventId);
      const characterId=item.character.characterId;
      if(!this.characterOrder.includes(characterId)){
        this.characterOrder.push(characterId);
        this.characterBag=[];
      }
      const queue=this.queues.get(characterId)??[];
      const history=this.historyByCharacter.get(characterId)??[];
      queue.push(item);history.push(item);
      if(history.length>50)history.splice(0,history.length-50);
      this.queues.set(characterId,queue);this.historyByCharacter.set(characterId,history);
      this.eventBags.delete(characterId);this.latestByCharacter.set(characterId,item);
    }
    this.publish({...this.state.value,pending:this.pendingCount()});
    if(this.state.value.autoEnabled&&!this.state.value.paused&&!this.state.value.active)this.advance();
  }

  next():void{this.advance()}

  pause():void{
    this.clearTimer();this.publish({...this.state.value,paused:true});
  }

  resume():void{
    this.play();
  }

  play():void{
    if(!this.state.value.autoEnabled)return;
    this.clearTimer();
    this.publish({...this.state.value,paused:false});
    this.advance();
  }

  manualFocus(characterId:string):void{
    this.clearTimer();
    this.publish({active:this.latestByCharacter.get(characterId)??null,focusCharacterId:characterId,autoEnabled:this.state.value.autoEnabled,paused:true,pending:this.pendingCount()});
  }

  showOverview():void{
    this.clearTimer();
    this.publish({...this.state.value,active:null,focusCharacterId:null,paused:true,pending:this.pendingCount()});
  }

  clearActivity():void{
    this.clearTimer();this.queues.clear();this.historyByCharacter.clear();this.latestByCharacter.clear();this.seenEventIds.clear();
    this.characterOrder=[];this.characterBag=[];this.eventBags.clear();this.lastEventByCharacter.clear();this.lastCharacterId=null;
    this.publish({...this.state.value,active:null,focusCharacterId:null,pending:0});
    if(this.state.value.autoEnabled&&!this.state.value.paused)this.armTimer();
  }

  stop():void{
    this.clearTimer();this.queues.clear();this.historyByCharacter.clear();this.latestByCharacter.clear();this.seenEventIds.clear();
    this.characterOrder=[];this.characterBag=[];this.eventBags.clear();this.lastEventByCharacter.clear();this.lastCharacterId=null;
    this.state.next({active:null,focusCharacterId:null,autoEnabled:true,paused:false,pending:0});
  }

  private advance():void{
    this.clearTimer();
    const nextCharacterId=this.nextCharacter();
    if(!nextCharacterId){
      this.publish({...this.state.value,active:null,focusCharacterId:null,pending:0});
      if(this.state.value.autoEnabled&&!this.state.value.paused)this.armTimer();
      return;
    }
    const queue=this.queues.get(nextCharacterId)??[];
    const groupedEventCount=queue.length;
    const active=groupedEventCount?this.randomItem(queue):this.randomHistoryItem(nextCharacterId);
    queue.length=0;
    if(!active)return;
    this.lastCharacterId=nextCharacterId;
    this.lastEventByCharacter.set(nextCharacterId,active.event.eventId);
    this.publish({active:{...active,groupedEventCount},focusCharacterId:nextCharacterId,autoEnabled:this.state.value.autoEnabled,paused:this.state.value.paused,pending:this.pendingCount()});
    if(this.state.value.autoEnabled&&!this.state.value.paused)this.armTimer();
  }

  private nextCharacter():string|null{
    const pending=this.characterOrder.filter(id=>(this.queues.get(id)?.length??0)>0);
    const candidates=pending.length?pending:this.characterOrder.filter(id=>(this.historyByCharacter.get(id)?.length??0)>0);
    if(!candidates.length)return null;
    this.characterBag=this.characterBag.filter(id=>candidates.includes(id));
    if(!this.characterBag.length){
      this.characterBag=this.shuffle([...candidates]);
      if(this.characterBag.length>1&&this.characterBag[0]===this.lastCharacterId){
        [this.characterBag[0],this.characterBag[1]]=[this.characterBag[1],this.characterBag[0]];
      }
    }
    return this.characterBag.shift()??null;
  }

  private randomHistoryItem(characterId:string):SpectatorItem|null{
    const history=this.historyByCharacter.get(characterId)??[];
    if(!history.length)return null;
    let bag=this.eventBags.get(characterId)?.filter(eventId=>history.some(item=>item.event.eventId===eventId))??[];
    if(!bag.length){
      bag=this.shuffle(history.map(item=>item.event.eventId));
      const previous=this.lastEventByCharacter.get(characterId);
      if(bag.length>1&&bag[0]===previous)[bag[0],bag[1]]=[bag[1],bag[0]];
    }
    const eventId=bag.shift()!;
    this.eventBags.set(characterId,bag);
    return history.find(item=>item.event.eventId===eventId)??history[0];
  }

  private randomItem(items:SpectatorItem[]):SpectatorItem{return items[Math.floor(Math.random()*items.length)]}
  private shuffle<T>(items:T[]):T[]{
    for(let index=items.length-1;index>0;index--){
      const target=Math.floor(Math.random()*(index+1));
      [items[index],items[target]]=[items[target],items[index]];
    }
    return items;
  }

  private pendingCount():number{return[...this.queues.values()].reduce((sum,queue)=>sum+queue.length,0)}
  private publish(state:SpectatorState):void{this.state.next(state)}
  private armTimer():void{this.timer=window.setTimeout(()=>this.advance(),this.intervalMs)}
  private clearTimer():void{if(this.timer!==null)window.clearTimeout(this.timer);this.timer=null}
}
