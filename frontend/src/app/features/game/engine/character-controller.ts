import Phaser from 'phaser';
import {CharacterPathfinding} from './character-pathfinding';
import {CharacterStateMachine} from './character-state-machine';
import {CharacterDirective, CharacterState, GameProfile, GameSettings, GridPoint} from './game.models';

export class CharacterController{
  readonly machine=new CharacterStateMachine();
  private readonly container:Phaser.GameObjects.Container;
  private readonly image:Phaser.GameObjects.Image;
  private readonly halo:Phaser.GameObjects.Ellipse;
  private readonly bubble:Phaser.GameObjects.Container;
  private readonly bubbleText:Phaser.GameObjects.Text;
  private moving=false;
  private idleAt=0;
  private celebrationSequence=0;
  private movementEnabled=true;
  private effectsEnabled=true;
  private animationSpeed=1;

  constructor(
    private readonly scene:Phaser.Scene,
    readonly profile:GameProfile,
    private readonly pathfinding:CharacterPathfinding,
    private readonly tileSize:number,
    private cell:GridPoint,
    onSelect:(characterId:string)=>void,
    private readonly reducedMotion=false,
    settings?:GameSettings
  ){
    if(settings)this.configure(settings);
    const position=this.world(cell);
    this.halo=scene.add.ellipse(0,-2,58,22,0x69d5ff,.12).setStrokeStyle(1,0xe7c77e,.2).setVisible(false);
    const shadow=scene.add.ellipse(0,-1,44,13,0x000000,.45);
    this.image=scene.add.image(0,-48,`hero-${profile.characterId}`).setOrigin(.5,1);
    const height=92;this.image.setScale(height/Math.max(1,this.image.height));
    const plate=scene.add.rectangle(0,11,92,18,0x071426,.9).setStrokeStyle(1,0x8e7145,.8);
    const label=scene.add.text(0,11,profile.displayName.toUpperCase(),{fontFamily:'Cinzel,serif',fontSize:'9px',color:'#f0d39b'}).setOrigin(.5);
    const bubbleBack=scene.add.rectangle(0,-118,156,36,0x071426,.96).setStrokeStyle(1,0xddb868,.9);
    this.bubbleText=scene.add.text(0,-118,'',{fontFamily:'Manrope,sans-serif',fontSize:'10px',color:'#f3ead9',align:'center',wordWrap:{width:142}}).setOrigin(.5);
    this.bubble=scene.add.container(0,0,[bubbleBack,this.bubbleText]).setAlpha(0);
    this.container=scene.add.container(position.x,position.y,[this.halo,shadow,this.image,plate,label,this.bubble]).setSize(80,112).setInteractive(new Phaser.Geom.Rectangle(-40,-100,80,112),Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerdown',()=>onSelect(profile.characterId));
    this.container.on('pointerover',()=>this.halo.setVisible(true));
    this.container.on('pointerout',()=>{if(!this.container.getData('focused'))this.halo.setVisible(false)});
    if(!reducedMotion)scene.tweens.add({targets:this.image,y:-51,duration:(1600+Math.random()*400)/this.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.updateDepth();this.scheduleIdle(scene.time.now);
  }

  get currentCell():GridPoint{return{...this.cell}}
  get isMoving():boolean{return this.moving}
  get worldPosition():GridPoint{return{x:this.container.x,y:this.container.y}}

  configure(settings:GameSettings):void{
    this.movementEnabled=settings.movementEnabled;
    this.effectsEnabled=settings.effectsEnabled;
    this.animationSpeed=settings.animationSpeed;
  }

  destroy():void{
    this.scene.tweens.killTweensOf(this.image);
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  apply(directive:CharacterDirective,target:GridPoint,reserved:ReadonlySet<string>):void{
    const finish=()=>{this.setState(directive.state,directive.label);if(directive.state==='CELEBRATING')this.celebrate()};
    this.moveTo(target,reserved,finish,directive.state);
  }

  wander(target:GridPoint,reserved:ReadonlySet<string>):void{
    if(this.machine.state!=='IDLE'||this.moving)return;
    this.moveTo(target,reserved,()=>this.setState('IDLE',''),'IDLE');
  }

  update(now:number,onIdle:(controller:CharacterController)=>void):void{
    if(!this.moving&&this.machine.state==='IDLE'&&now>=this.idleAt){this.scheduleIdle(now);onIdle(this)}
    this.updateDepth();
  }

  focus(active:boolean,hasFocus:boolean):void{
    this.container.setData('focused',active);this.halo.setVisible(active);this.halo.setFillStyle(0x69d5ff,active ? .22 : .12);
    this.container.setScale(active?1.08:1);this.container.setAlpha(hasFocus?(active?1:.62):1);
  }

  private moveTo(target:GridPoint,reserved:ReadonlySet<string>,onComplete:()=>void,finalState:CharacterState):void{
    if(this.moving){this.scene.tweens.killTweensOf(this.container);this.moving=false}
    const path=this.pathfinding.find(this.cell,target,reserved);
    if(!path.length){onComplete();return}
    if(!this.movementEnabled){onComplete();return}
    if(this.reducedMotion){this.cell={...path[path.length-1]};const world=this.world(this.cell);this.container.setPosition(world.x,world.y);this.updateDepth();onComplete();return}
    this.machine.transition('WALKING');this.moving=true;this.showBubble('On my way…');
    const advance=(index:number):void=>{
      const next=path[index];if(!next){this.moving=false;this.cell={...target};this.hideBubble(finalState==='IDLE');onComplete();return}
      const world=this.world(next),delta=world.x-this.container.x;this.image.setFlipX(delta<0);
      this.scene.tweens.add({targets:this.container,x:world.x,y:world.y,duration:230/this.animationSpeed,ease:'Sine.inOut',onUpdate:()=>this.updateDepth(),onComplete:()=>{this.cell={...next};advance(index+1)}});
    };
    advance(0);
  }

  private setState(state:CharacterState,label:string):void{
    this.machine.transition(state);
    this.image.clearTint();
    if(state==='BLOCKED')this.image.setTint(0xffa0ad);
    else if(state==='REVIEWING')this.image.setTint(0xb8deff);
    else if(state==='WORKING')this.image.setTint(0xffe5a6);
    if(label)this.showBubble(label);else this.hideBubble(true);
  }

  private showBubble(text:string):void{
    this.bubbleText.setText(text);this.bubble.setAlpha(1);
  }

  private hideBubble(immediate=false):void{
    this.scene.tweens.killTweensOf(this.bubble);if(immediate)this.bubble.setAlpha(0);else this.scene.tweens.add({targets:this.bubble,alpha:0,delay:1800,duration:400});
  }

  private celebrate():void{
    const sequence=++this.celebrationSequence;
    if(this.reducedMotion){this.showBubble('Task completed!');this.scene.time.delayedCall(1600,()=>{if(sequence===this.celebrationSequence&&this.machine.state==='CELEBRATING')this.setState('IDLE','')});return}
    if(this.effectsEnabled)for(let index=0;index<8;index++){
      const angle=(Math.PI*2*index)/8,particle=this.scene.add.circle(this.container.x,this.container.y-62,3,index%2?0x69d5ff:0xffd878,1).setDepth(5000);
      this.scene.tweens.add({targets:particle,x:particle.x+Math.cos(angle)*46,y:particle.y+Math.sin(angle)*38,alpha:0,scale:1.8,duration:900,onComplete:()=>particle.destroy()});
    }
    this.scene.time.delayedCall(3200,()=>{if(sequence===this.celebrationSequence&&this.machine.state==='CELEBRATING'){this.machine.transition('IDLE');this.hideBubble()}});
  }

  private world(cell:GridPoint):GridPoint{return{x:cell.x*this.tileSize+this.tileSize/2,y:cell.y*this.tileSize+this.tileSize/2}}
  private updateDepth():void{this.container.setDepth(Math.round(this.container.y))}
  private scheduleIdle(now:number):void{this.idleAt=now+5000+Math.random()*6000}
}
