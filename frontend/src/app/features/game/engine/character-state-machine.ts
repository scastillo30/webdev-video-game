import {CharacterState} from './game.models';

const allowed:Record<CharacterState,ReadonlySet<CharacterState>>={
  IDLE:new Set(['WALKING','WORKING','DISCUSSING','REVIEWING','BLOCKED','CELEBRATING']),
  WALKING:new Set(['IDLE','WORKING','DISCUSSING','REVIEWING','BLOCKED','CELEBRATING']),
  WORKING:new Set(['WALKING','IDLE','REVIEWING','BLOCKED','CELEBRATING']),
  DISCUSSING:new Set(['WALKING','IDLE','WORKING','REVIEWING','BLOCKED','CELEBRATING']),
  REVIEWING:new Set(['WALKING','IDLE','WORKING','BLOCKED','CELEBRATING']),
  BLOCKED:new Set(['WALKING','IDLE','WORKING','DISCUSSING','REVIEWING','CELEBRATING']),
  CELEBRATING:new Set(['WALKING','IDLE','WORKING','DISCUSSING','REVIEWING','BLOCKED'])
};

export class CharacterStateMachine{
  private current:CharacterState='IDLE';
  get state():CharacterState{return this.current}
  transition(next:CharacterState):boolean{
    if(next===this.current)return false;
    if(!allowed[this.current].has(next))return false;
    this.current=next;return true;
  }
}

export function stateForStatus(status:string,statusCategory:string):CharacterState{
  const normalized=`${status} ${statusCategory}`.toLowerCase();
  if(/done|closed|resolved|complete/.test(normalized))return'CELEBRATING';
  if(/block|impediment|waiting/.test(normalized))return'BLOCKED';
  if(/review|approval/.test(normalized))return'REVIEWING';
  if(/progress|develop|implement|testing|qa/.test(normalized))return'WORKING';
  return'IDLE';
}
