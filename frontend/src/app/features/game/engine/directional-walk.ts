import {GridPoint} from './game.models';

export type WalkFacing='down'|'left'|'right'|'up';
export type CommanderAction='idle'|'walk'|'attack'|'hurt';
export const COMMANDER_WALK={key:'commander-snes-rpg-v002',path:'/assets/characters/commander/snes-rpg/v002/spritesheet-runtime.png',frameWidth:64,frameHeight:64,columns:12,displayScale:1.2,footOrigin:62/64} as const;
export const COMMANDER_SEQUENCES={
  idle:{down:[0,1,2],up:[3,4,5],right:[6,7,8]},
  walk:{down:[12,13,14,15],up:[16,17,18,19],right:[20,21,22,23]},
  attack:{down:[24,25,26],up:[27,28,29],right:[30,31,32]},
  hurt:{down:[36],up:[37],right:[38]}
} as const;

/** A distance clock: pause, FPS and speed changes cannot advance feet independently. */
export class DirectionalWalk{
  facing:WalkFacing='down';
  private distance=0;
  private walking=false;
  private previous:GridPoint|null=null;
  private action:CommanderAction='idle';
  private elapsed=0;

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
  stop():number{this.walking=false;this.distance=0;this.previous=null;this.action='idle';this.elapsed=0;return this.frame}
  play(action:'attack'|'hurt'):void{if(this.walking)return;this.action=action;this.elapsed=0}
  tick(delta:number):number{
    this.elapsed+=Math.max(0,delta);
    if((this.action==='attack'&&this.elapsed>=360)||(this.action==='hurt'&&this.elapsed>=420)){this.action='idle';this.elapsed=0}
    return this.frame;
  }
  get flipX():boolean{return this.facing==='left'}
  get currentAction():CommanderAction{return this.action}
  get frame():number{
    const direction=this.facing==='left'?'right':this.facing;
    const frames=COMMANDER_SEQUENCES[this.action][direction];
    const index=this.action==='walk'?Math.floor(this.distance/12)%4:this.action==='idle'?Math.floor(this.elapsed/260)%3:this.action==='attack'?Math.min(2,Math.floor(this.elapsed/120)):0;
    return frames[index];
  }
}
