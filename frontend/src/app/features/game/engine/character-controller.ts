import Phaser from 'phaser';
import {CharacterPathfinding} from './character-pathfinding';
import {CharacterStateMachine} from './character-state-machine';
import {COMMANDER_WALK,DirectionalWalk} from './directional-walk';
import {CharacterDirective, CharacterState, GameProfile, GameSettings, GridPoint} from './game.models';

export class CharacterController{
  readonly machine=new CharacterStateMachine();
  private readonly container:Phaser.GameObjects.Container;
	private readonly figure:Phaser.GameObjects.Container;
  private readonly image:Phaser.GameObjects.Image;
	private readonly silhouette:Phaser.GameObjects.Image;
  private readonly halo:Phaser.GameObjects.Ellipse;
  private readonly bubble:Phaser.GameObjects.Container;
  private readonly bubbleText:Phaser.GameObjects.Text;
  private moving=false;
  private idleAt=0;
  private celebrationSequence=0;
  private movementEnabled=true;
  private effectsEnabled=true;
  private animationSpeed=1;
	private targetCell:GridPoint|null=null;
	private activitySequence=0;
	private autonomousActivity=false;
  private readonly walk=new DirectionalWalk();
  private readonly directional:boolean;
  private movementTween?:Phaser.Tweens.Tween;

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
    this.directional=profile.characterId==='commander'&&scene.textures.exists(COMMANDER_WALK.key);
    if(settings)this.configure(settings);
    const position=this.world(cell);
	this.halo=scene.add.ellipse(0,1,this.directional?40:64,this.directional?14:22,0x69d5ff,.16).setStrokeStyle(1,0xe7c77e,.3).setVisible(false);
	const shadow=scene.add.ellipse(0,2,this.directional?30:50,this.directional?9:15,0x02040a,.68).setStrokeStyle(1,0xd6b568,.22);
	const texture=this.directional?COMMANDER_WALK.key:`hero-${profile.characterId}`;
	const footOrigin=this.directional?COMMANDER_WALK.footOrigin:1;
	this.silhouette=scene.add.image(2,1,texture,0).setOrigin(.5,footOrigin).setTintFill(0x020711).setAlpha(.72);
	this.image=scene.add.image(0,0,texture,0).setOrigin(.5,footOrigin).setAlpha(1);
	this.image.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
	this.silhouette.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
	const height=112,scale=this.directional?COMMANDER_WALK.displayScale:height/Math.max(1,this.image.height);
	this.image.setScale(scale);this.silhouette.setScale(this.directional?scale:scale*1.025);
    if(this.directional)this.silhouette.setVisible(false);
	this.figure=scene.add.container(0,0,[this.silhouette,this.image]);
	const plate=scene.add.rectangle(0,17,96,18,0x071426,.94).setStrokeStyle(1,0x8e7145,.9);
	const label=scene.add.text(0,17,profile.displayName.toUpperCase(),{fontFamily:'Cinzel,serif',fontSize:'9px',color:'#f0d39b'}).setOrigin(.5);
	const bubbleY=this.directional?-98:-140;
	const bubbleBack=scene.add.rectangle(0,bubbleY,166,38,0x071426,.97).setStrokeStyle(1,0xddb868,.95);
	this.bubbleText=scene.add.text(0,bubbleY,'',{fontFamily:'Manrope,sans-serif',fontSize:'10px',color:'#f3ead9',align:'center',wordWrap:{width:152}}).setOrigin(.5);
    this.bubble=scene.add.container(0,0,[bubbleBack,this.bubbleText]).setAlpha(0);
	const hitArea=this.directional?new Phaser.Geom.Rectangle(-32,-78,64,106):new Phaser.Geom.Rectangle(-44,-118,88,136);
	this.container=scene.add.container(position.x,position.y,[this.halo,shadow,this.figure,plate,label,this.bubble]).setSize(hitArea.width,hitArea.height).setInteractive(hitArea,Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerdown',()=>onSelect(profile.characterId));
    this.container.on('pointerover',()=>this.halo.setVisible(true));
    this.container.on('pointerout',()=>{if(!this.container.getData('focused'))this.halo.setVisible(false)});
	if(!reducedMotion&&!this.directional)scene.tweens.add({targets:this.figure,y:-2,duration:(1700+Math.random()*450)/this.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.updateDepth();this.scheduleIdle(scene.time.now);
  }

  get currentCell():GridPoint{return{...this.cell}}
  get destinationCell():GridPoint|null{return this.targetCell?{...this.targetCell}:null}
  get isMoving():boolean{return this.moving}
	get availableForConversation():boolean{return!this.moving&&this.machine.state==='IDLE'}
  get isAutonomousBusy():boolean{return this.autonomousActivity}
  get worldPosition():GridPoint{return{x:this.container.x,y:this.container.y}}

  configure(settings:GameSettings):void{
    this.movementEnabled=settings.movementEnabled;
    this.effectsEnabled=settings.effectsEnabled;
    this.animationSpeed=settings.animationSpeed;
    if(this.movementTween){this.movementTween.timeScale=this.animationSpeed;settings.movementEnabled?this.movementTween.resume():this.movementTween.pause()}
  }

  destroy():void{
	this.scene.tweens.killTweensOf(this.figure);
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  apply(directive:CharacterDirective,target:GridPoint,reserved:ReadonlySet<string>,facingX?:number):void{
	this.activitySequence++;
	this.autonomousActivity=false;
	const finish=()=>{this.faceTowards(facingX);this.setState(directive.state,directive.label);if(directive.state==='CELEBRATING')this.celebrate()};
    this.moveTo(target,reserved,finish,directive.state);
  }

  wander(target:GridPoint,reserved:ReadonlySet<string>):void{
    if(this.machine.state!=='IDLE'||this.moving)return;
    this.moveTo(target,reserved,()=>this.setState('IDLE',''),'IDLE');
  }

	interact(target:GridPoint,reserved:ReadonlySet<string>,label:string,state:CharacterState,duration=3200,facingX?:number,onArrive?:()=>void):void{
		if(!this.availableForConversation)return;
		const sequence=++this.activitySequence;
		this.autonomousActivity=true;
		this.moveTo(target,reserved,()=>{
			this.faceTowards(facingX);this.setState(state,label);onArrive?.();
			this.scene.time.delayedCall(duration,()=>{
				if(sequence!==this.activitySequence||this.moving||this.machine.state!==state)return;
				this.autonomousActivity=false;this.setState('IDLE','');this.scheduleIdle(this.scene.time.now);
			});
		},state);
		if(!this.moving&&this.machine.state==='IDLE')this.autonomousActivity=false;
	}

	engage(label:string,state:CharacterState='DISCUSSING',duration=3200,facingX?:number):void{
		if(!this.availableForConversation)return;
		const sequence=++this.activitySequence;
		this.autonomousActivity=true;
		this.faceTowards(facingX);this.setState(state,label);
		this.scene.time.delayedCall(duration,()=>{
			if(sequence!==this.activitySequence||this.moving||this.machine.state!==state)return;
			this.autonomousActivity=false;this.setState('IDLE','');this.scheduleIdle(this.scene.time.now);
		});
	}

  update(now:number,onIdle:(controller:CharacterController)=>void):void{
    if(!this.moving&&this.machine.state==='IDLE'&&now>=this.idleAt){this.scheduleIdle(now);onIdle(this)}
    this.updateDepth();
  }

  animate(delta:number):void{
    if(!this.directional||this.reducedMotion||(this.moving&&!this.movementEnabled)||(!this.moving&&!this.effectsEnabled))return;
    this.showWalkFrame(this.walk.tick(Math.min(delta,100)*this.animationSpeed));
  }

  focus(active:boolean,_hasFocus:boolean):void{
    this.container.setData('focused',active);this.halo.setVisible(active);this.halo.setFillStyle(0x69d5ff,active ? .22 : .12);
	this.container.setScale(active&&!this.directional?1.08:1);this.container.setAlpha(1);
  }

  private moveTo(target:GridPoint,reserved:ReadonlySet<string>,onComplete:()=>void,finalState:CharacterState):void{
	if(this.moving){this.scene.tweens.killTweensOf(this.container);this.moving=false;this.movementTween=undefined;this.showWalkFrame(this.walk.stop());this.machine.transition('IDLE')}
    const path=this.pathfinding.find(this.cell,target,reserved);
	if(!path.length){this.targetCell=null;if(this.cell.x===target.x&&this.cell.y===target.y)onComplete();return}
	this.targetCell={...target};
	if(!this.movementEnabled){this.targetCell=null;onComplete();return}
	if(this.reducedMotion){const end=path[path.length-1],previous=path.length>1?path[path.length-2]:this.cell;this.walk.face(end.x-previous.x,end.y-previous.y);this.showWalkFrame(this.walk.stop());this.cell={...end};this.targetCell=null;const world=this.world(this.cell);this.container.setPosition(world.x,world.y);this.updateDepth();onComplete();return}
    this.machine.transition('WALKING');this.moving=true;if(finalState==='IDLE')this.hideBubble(true);else this.showBubble('On my way…');
    const advance=(index:number):void=>{
	  const next=path[index];if(!next){this.moving=false;this.movementTween=undefined;this.showWalkFrame(this.walk.stop());this.cell={...target};this.targetCell=null;this.hideBubble(finalState==='IDLE');onComplete();return}
	  const world=this.world(next),delta=world.x-this.container.x;
      if(this.directional){this.walk.begin(this.worldPosition,world);this.showWalkFrame(this.walk.frame)}else this.setFlipX(delta<0);
      this.movementTween=this.scene.tweens.add({targets:this.container,x:world.x,y:world.y,duration:this.directional?340:230,ease:this.directional?'Linear':'Sine.inOut',onUpdate:()=>{this.showWalkFrame(this.walk.step(this.worldPosition));this.updateDepth()},onComplete:()=>{this.cell={...next};advance(index+1)}});
      this.movementTween.timeScale=this.animationSpeed;
    };
    advance(0);
  }

  private setState(state:CharacterState,label:string):void{
    const changed=this.machine.transition(state);
    if(changed&&this.directional&&!this.moving){this.walk.stop();if(state==='BLOCKED'&&!this.reducedMotion)this.walk.play('hurt');this.showWalkFrame(this.walk.frame)}
    this.image.clearTint();
    if(state==='BLOCKED')this.image.setTint(0xffa0ad);
    else if(state==='REVIEWING')this.image.setTint(0xb8deff);
    else if(state==='WORKING')this.image.setTint(0xffe5a6);
    if(label)this.showBubble(label);else this.hideBubble(true);
  }

	private setFlipX(flip:boolean):void{this.image.setFlipX(flip);this.silhouette.setFlipX(flip)}
  private showWalkFrame(frame:number):void{if(this.directional){this.image.setFrame(frame);this.silhouette.setFrame(frame);this.setFlipX(this.walk.flipX)}}
	private faceTowards(cellX?:number):void{
		if(cellX===undefined)return;
		const worldX=cellX*this.tileSize+this.tileSize/2;
		if(this.directional){this.walk.face(worldX-this.container.x,0);this.showWalkFrame(this.walk.stop());return}
		this.setFlipX(worldX<this.container.x);
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
    if(this.directional){this.walk.play('attack');this.showWalkFrame(this.walk.frame)}
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
