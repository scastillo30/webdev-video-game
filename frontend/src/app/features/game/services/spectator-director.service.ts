import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {SpectatorItem, SpectatorState} from '../engine/game.models';

const ROTATION_INTERVAL_MS=15_000;

@Injectable()
export class SpectatorDirectorService{
  private readonly state=new BehaviorSubject<SpectatorState>({active:null,focusCharacterId:null,paused:false,pending:0});
  private readonly queues=new Map<string,SpectatorItem[]>();
  private readonly latestByCharacter=new Map<string,SpectatorItem>();
  private readonly seenEventIds=new Set<string>();
  private characterOrder:string[]=[];
  private rotationIndex=-1;
  private timer:number|null=null;
  readonly state$=this.state.asObservable();

  ingest(items:SpectatorItem[]):void{
    for(const item of [...items].reverse()){
      if(this.seenEventIds.has(item.event.eventId))continue;
      this.seenEventIds.add(item.event.eventId);
      const characterId=item.character.characterId;
      if(!this.characterOrder.includes(characterId))this.characterOrder.push(characterId);
      const queue=this.queues.get(characterId)??[];
      queue.push(item);this.queues.set(characterId,queue);this.latestByCharacter.set(characterId,item);
    }
    this.publish({...this.state.value,pending:this.pendingCount()});
    if(!this.state.value.paused&&!this.state.value.active)this.advance();
  }

  next():void{this.advance()}

  pause():void{
    this.clearTimer();this.publish({...this.state.value,paused:true});
  }

  resume():void{
    if(!this.state.value.paused)return;
    this.publish({...this.state.value,paused:false});
    if(!this.state.value.active)this.advance();else this.armTimer();
  }

  manualFocus(characterId:string):void{
    this.clearTimer();
    this.publish({active:this.latestByCharacter.get(characterId)??null,focusCharacterId:characterId,paused:true,pending:this.pendingCount()});
  }

  stop():void{
    this.clearTimer();this.queues.clear();this.latestByCharacter.clear();this.seenEventIds.clear();this.characterOrder=[];
    this.state.next({active:null,focusCharacterId:null,paused:false,pending:0});
  }

  private advance():void{
    this.clearTimer();
    const nextCharacterId=this.nextQueuedCharacter();
    if(!nextCharacterId){
      this.publish({...this.state.value,active:null,focusCharacterId:null,pending:0});
      if(!this.state.value.paused)this.armTimer();
      return;
    }
    const queue=this.queues.get(nextCharacterId)!;
    const active=queue[queue.length-1];
    const groupedEventCount=queue.length;
    queue.length=0;
    this.publish({active:{...active,groupedEventCount},focusCharacterId:nextCharacterId,paused:this.state.value.paused,pending:this.pendingCount()});
    if(!this.state.value.paused)this.armTimer();
  }

  private nextQueuedCharacter():string|null{
    if(!this.characterOrder.length)return null;
    for(let offset=1;offset<=this.characterOrder.length;offset++){
      const index=(this.rotationIndex+offset)%this.characterOrder.length;
      const id=this.characterOrder[index];
      if((this.queues.get(id)?.length??0)>0){this.rotationIndex=index;return id}
    }
    return null;
  }

  private pendingCount():number{return[...this.queues.values()].reduce((sum,queue)=>sum+queue.length,0)}
  private publish(state:SpectatorState):void{this.state.next(state)}
  private armTimer():void{this.timer=window.setTimeout(()=>this.advance(),ROTATION_INTERVAL_MS)}
  private clearTimer():void{if(this.timer!==null)window.clearTimeout(this.timer);this.timer=null}
}
