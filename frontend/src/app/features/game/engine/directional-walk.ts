import {CharacterState,GridPoint} from './game.models';

export type WalkFacing='down'|'left'|'right'|'up';
export type BoardSpriteAction='idle'|'walk'|'attack'|'hurt';
export type CommanderAction=BoardSpriteAction;
type DrawnFacing='down'|'up'|'right';
export type DirectionalSequences=Readonly<Record<CommanderAction,Readonly<Record<DrawnFacing,readonly number[]>>>>;
export interface DirectionalSpriteConfig{
  readonly characterId:string;
  readonly key:string;
  readonly path:string;
  readonly frameWidth:number;
  readonly frameHeight:number;
  readonly columns:number;
  readonly displayScale:number;
  readonly footOrigin:number;
  readonly sequences:DirectionalSequences;
  readonly abilityName:'sword-flourish'|'cube-reveal';
  readonly abilityTimeline?:readonly {readonly pose:number;readonly duration:number}[];
  readonly idleAbilityIntervalMs?:number;
  readonly abilityOnFocus?:boolean;
  readonly abilityOnStates?:readonly CharacterState[];
}
export const COMMANDER_SEQUENCES={
  idle:{down:[0,1,2],up:[3,4,5],right:[6,7,8]},
  walk:{down:[12,13,14,15],up:[16,17,18,19],right:[20,21,22,23]},
  attack:{down:[24,25,26],up:[27,28,29],right:[30,31,32]},
  hurt:{down:[36],up:[37],right:[38]}
} as const;
export const COMMANDER_WALK:DirectionalSpriteConfig={characterId:'commander',key:'commander-snes-rpg-v002',path:'/assets/characters/commander/snes-rpg/v002/spritesheet-runtime.png',frameWidth:64,frameHeight:64,columns:12,displayScale:1.2,footOrigin:62/64,sequences:COMMANDER_SEQUENCES,abilityName:'sword-flourish'};
export const GUARDIAN_WALK:DirectionalSpriteConfig={
  characterId:'cube-wanderer',key:'guardian-cube-reveal-v001',path:'/assets/characters/cube-wanderer/snes-rpg/v001/spritesheet-runtime.png',frameWidth:64,frameHeight:64,columns:12,displayScale:1.2,footOrigin:62/64,
  sequences:{idle:{down:[0,1,2],up:[3,4,5],right:[6,7,8]},walk:{down:[12,13,14,15],up:[16,17,18,19],right:[20,21,22,23]},attack:{down:[24,25,26],up:[27,28,29],right:[30,31,32]},hurt:{down:[36],up:[37],right:[38]}},
  abilityName:'cube-reveal',abilityTimeline:[{pose:0,duration:180},{pose:1,duration:220},{pose:2,duration:1300},{pose:1,duration:180},{pose:0,duration:140}],idleAbilityIntervalMs:9000,abilityOnFocus:true,abilityOnStates:['WORKING','REVIEWING']
};

/** A distance clock: pause, FPS and speed changes cannot advance feet independently. */
export class DirectionalWalk{
  facing:WalkFacing='down';
  private distance=0;
  private walking=false;
  private previous:GridPoint|null=null;
  private action:CommanderAction='idle';
  private elapsed=0;
  private idleElapsed=0;

  constructor(readonly config:DirectionalSpriteConfig=COMMANDER_WALK){}

  begin(position:GridPoint,target:GridPoint):void{
    this.face(target.x-position.x,target.y-position.y);
    this.previous={...position};this.walking=true;this.action='walk';this.elapsed=0;
  }
  step(position:GridPoint):number{
    if(this.walking&&this.previous)this.distance+=Math.hypot(position.x-this.previous.x,position.y-this.previous.y);
    this.previous={...position};return this.frame;
  }
  face(dx:number,dy:number):void{
    if(dx===0&&dy===0)return;
    this.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
  }
  stop():number{this.walking=false;this.distance=0;this.previous=null;this.action='idle';this.elapsed=0;this.idleElapsed=0;return this.frame}
  play(action:'attack'|'hurt'):void{if(this.walking)return;this.action=action;this.elapsed=0;this.idleElapsed=0}
  tick(delta:number):number{
    const dt=Math.max(0,delta);this.elapsed+=dt;
    if(this.action==='idle'){
      this.idleElapsed+=dt;
      if(this.config.idleAbilityIntervalMs&&this.idleElapsed>=this.config.idleAbilityIntervalMs)this.play('attack');
    }
    const abilityDuration=this.config.abilityTimeline?.reduce((sum,step)=>sum+step.duration,0)??360;
    if((this.action==='attack'&&this.elapsed>=abilityDuration)||(this.action==='hurt'&&this.elapsed>=420)){this.action='idle';this.elapsed=0;this.idleElapsed=0}
    return this.frame;
  }
  get flipX():boolean{return this.facing==='left'}
  get currentAction():CommanderAction{return this.action}
  get frame():number{
    const direction=this.facing==='left'?'right':this.facing;
    const frames=this.config.sequences[this.action][direction];
    let index=this.action==='walk'?Math.floor(this.distance/12)%frames.length:this.action==='idle'?Math.floor(this.elapsed/260)%frames.length:this.action==='attack'?Math.min(frames.length-1,Math.floor(this.elapsed/120)):0;
    if(this.action==='attack'&&this.config.abilityTimeline){
      let remaining=this.elapsed;
      for(const step of this.config.abilityTimeline){index=step.pose;if(remaining<step.duration)break;remaining-=step.duration}
    }
    return frames[index];
  }
}
