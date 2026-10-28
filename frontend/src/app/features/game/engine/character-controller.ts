import Phaser from 'phaser';
import {CharacterPathfinding} from './character-pathfinding';
import {CharacterStateMachine} from './character-state-machine';
import {DirectionalWalk,DirectionalSpriteConfig} from './directional-walk';
import {boardCharacterAsset} from './board-character-assets';
import {CharacterDirective, CharacterState, GameProfile, GameSettings, GridPoint} from './game.models';

export class CharacterController{
  readonly machine=new CharacterStateMachine();
  private readonly container:Phaser.GameObjects.Container;
	private readonly figure:Phaser.GameObjects.Container;
  private readonly image:Phaser.GameObjects.Image;
	private readonly silhouette:Phaser.GameObjects.Image;
  private readonly halo:Phaser.GameObjects.Ellipse;
  private readonly bubble:Phaser.GameObjects.Container;
  private readonly bubbleBack:Phaser.GameObjects.Rectangle;
  private readonly bubbleText:Phaser.GameObjects.Text;
  private readonly bubbleStatusBack:Phaser.GameObjects.Rectangle;
  private readonly bubbleStatusText:Phaser.GameObjects.Text;
  private readonly bubbleY:number;
  private moving=false;
  private idleAt=0;
  private celebrationSequence=0;
  private movementEnabled=true;
  private effectsEnabled=true;
  private animationSpeed=1;
	private targetCell:GridPoint|null=null;
	private activitySequence=0;
	private autonomousActivity=false;
  private readonly walk:DirectionalWalk;
  private readonly spriteConfig?:DirectionalSpriteConfig;
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
    const config=boardCharacterAsset(profile.characterId,profile.miniatureAsset).directional;
    this.spriteConfig=config&&scene.textures.exists(config.key)?config:undefined;
    this.directional=Boolean(this.spriteConfig);
    this.walk=new DirectionalWalk(this.spriteConfig);
    if(settings)this.configure(settings);
    const position=this.world(cell);
	this.halo=scene.add.ellipse(0,1,this.directional?40:64,this.directional?14:22,0x69d5ff,.16).setStrokeStyle(1,0xe7c77e,.3).setVisible(false);
	const shadow=scene.add.ellipse(0,2,this.directional?30:50,this.directional?9:15,0x02040a,.68).setStrokeStyle(1,0xd6b568,.22);
	const texture=this.spriteConfig?.key??`hero-${profile.characterId}`;
	const footOrigin=this.spriteConfig?.footOrigin??1;
	this.silhouette=scene.add.image(2,1,texture,0).setOrigin(.5,footOrigin).setTintFill(0x020711).setAlpha(.72);
	this.image=scene.add.image(0,0,texture,0).setOrigin(.5,footOrigin).setAlpha(1);
	this.image.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
	this.silhouette.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
	const height=112,scale=this.spriteConfig?.displayScale??height/Math.max(1,this.image.height);
	this.image.setScale(scale);this.silhouette.setScale(this.directional?scale:scale*1.025);
    if(this.directional)this.silhouette.setVisible(false);
	this.figure=scene.add.container(0,0,[this.silhouette,this.image]);
	const plate=scene.add.rectangle(0,17,96,18,0x071426,.94).setStrokeStyle(1,0x8e7145,.9);
	const label=scene.add.text(0,17,profile.displayName.toUpperCase(),{fontFamily:'Cinzel,serif',fontSize:'9px',color:'#f0d39b'}).setOrigin(.5);
	this.bubbleY=this.directional?-118:-154;
	this.bubbleBack=scene.add.rectangle(0,this.bubbleY,226,64,0x071426,.98).setStrokeStyle(1,0xddb868,.95);
	this.bubbleText=scene.add.text(0,this.bubbleY-8,'',{fontFamily:'Manrope,sans-serif',fontSize:'10px',color:'#f3ead9',align:'center',lineSpacing:2,wordWrap:{width:210}}).setOrigin(.5);
	this.bubbleStatusBack=scene.add.rectangle(0,this.bubbleY+20,118,16,0x112638,.98).setStrokeStyle(1,0x8ee9ff,.95).setVisible(false);
	this.bubbleStatusText=scene.add.text(0,this.bubbleY+20,'',{fontFamily:'Manrope,sans-serif',fontSize:'8px',fontStyle:'bold',color:'#8ee9ff',align:'center'}).setOrigin(.5).setVisible(false);
    this.bubble=scene.add.container(0,0,[this.bubbleBack,this.bubbleText,this.bubbleStatusBack,this.bubbleStatusText]).setAlpha(0);
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
	const finish=()=>{this.faceTowards(facingX);this.setState(directive.state,directive.label,directive.status);if(directive.state==='CELEBRATING')this.celebrate()};
    this.moveTo(target,reserved,finish,directive.state,directive.label,directive.status);
  }

  wander(target:GridPoint,reserved:ReadonlySet<string>):void{
    if(this.machine.state!=='IDLE'||this.moving)return;
    this.moveTo(target,reserved,()=>this.setState('IDLE',''),'IDLE');
  }

	interact(target:GridPoint,reserved:ReadonlySet<string>,label:string,state:CharacterState,status:{label:string;color:number}|null=null,duration=3200,facingX?:number,onArrive?:()=>void):void{
		if(!this.availableForConversation)return;
		const sequence=++this.activitySequence;
		this.autonomousActivity=true;
		this.moveTo(target,reserved,()=>{
			this.faceTowards(facingX);this.setState(state,label,status);onArrive?.();
			this.scene.time.delayedCall(duration,()=>{
				if(sequence!==this.activitySequence||this.moving||this.machine.state!==state)return;
				this.autonomousActivity=false;this.setState('IDLE','');this.scheduleIdle(this.scene.time.now);
			});
		},state,label,status);
		if(!this.moving&&this.machine.state==='IDLE')this.autonomousActivity=false;
	}

	engage(label:string,state:CharacterState='DISCUSSING',status:{label:string;color:number}|null=null,duration=3200,facingX?:number):void{
		if(!this.availableForConversation)return;
		const sequence=++this.activitySequence;
		this.autonomousActivity=true;
		this.faceTowards(facingX);this.setState(state,label,status);
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
    if(active&&!this.container.getData('focused')&&this.spriteConfig?.abilityOnFocus&&!this.moving&&!this.reducedMotion&&this.effectsEnabled){this.walk.play('attack');this.showWalkFrame(this.walk.frame)}
    this.container.setData('focused',active);this.halo.setVisible(active);this.halo.setFillStyle(0x69d5ff,active ? .22 : .12);
	this.container.setScale(active&&!this.directional?1.08:1);this.container.setAlpha(1);
  }

  private moveTo(target:GridPoint,reserved:ReadonlySet<string>,onComplete:()=>void,finalState:CharacterState,travelLabel='',travelStatus:{label:string;color:number}|null=null):void{
	if(this.moving){this.scene.tweens.killTweensOf(this.container);this.moving=false;this.movementTween=undefined;this.showWalkFrame(this.walk.stop());this.machine.transition('IDLE')}
    const path=this.pathfinding.find(this.cell,target,reserved);
	if(!path.length){this.targetCell=null;if(this.cell.x===target.x&&this.cell.y===target.y)onComplete();return}
	this.targetCell={...target};
	if(!this.movementEnabled){this.targetCell=null;onComplete();return}
	if(this.reducedMotion){const end=path[path.length-1],previous=path.length>1?path[path.length-2]:this.cell;this.walk.face(end.x-previous.x,end.y-previous.y);this.showWalkFrame(this.walk.stop());this.cell={...end};this.targetCell=null;const world=this.world(this.cell);this.container.setPosition(world.x,world.y);this.updateDepth();onComplete();return}
    this.machine.transition('WALKING');this.moving=true;if(finalState==='IDLE')this.hideBubble(true);else this.showBubble(travelLabel,travelStatus);
    const advance=(index:number):void=>{
	  const next=path[index];if(!next){this.moving=false;this.movementTween=undefined;this.showWalkFrame(this.walk.stop());this.cell={...target};this.targetCell=null;this.hideBubble(finalState==='IDLE');onComplete();return}
	  const world=this.world(next),delta=world.x-this.container.x;
      if(this.directional){this.walk.begin(this.worldPosition,world);this.showWalkFrame(this.walk.frame)}else this.setFlipX(delta<0);
      this.movementTween=this.scene.tweens.add({targets:this.container,x:world.x,y:world.y,duration:this.directional?340:230,ease:this.directional?'Linear':'Sine.inOut',onUpdate:()=>{this.showWalkFrame(this.walk.step(this.worldPosition));this.updateDepth()},onComplete:()=>{this.cell={...next};advance(index+1)}});
      this.movementTween.timeScale=this.animationSpeed;
    };
    advance(0);
  }

  private setState(state:CharacterState,label:string,status:{label:string;color:number}|null=null):void{
    const changed=this.machine.transition(state);
    if(changed&&this.directional&&!this.moving){
      this.walk.stop();
      if(!this.reducedMotion&&this.effectsEnabled){
        if(state==='BLOCKED')this.walk.play('hurt');
        else if(this.spriteConfig?.abilityOnStates?.includes(state))this.walk.play('attack');
      }
      this.showWalkFrame(this.walk.frame);
    }
    this.image.clearTint();
    if(state==='BLOCKED')this.image.setTint(0xffa0ad);
    else if(state==='REVIEWING')this.image.setTint(0xb8deff);
    else if(state==='WORKING')this.image.setTint(0xffe5a6);
    if(label)this.showBubble(label,status);else this.hideBubble(true);
  }

	private setFlipX(flip:boolean):void{this.image.setFlipX(flip);this.silhouette.setFlipX(flip)}
  private showWalkFrame(frame:number):void{if(this.directional){this.image.setFrame(frame);this.silhouette.setFrame(frame);this.setFlipX(this.walk.flipX)}}
	private faceTowards(cellX?:number):void{
		if(cellX===undefined)return;
		const worldX=cellX*this.tileSize+this.tileSize/2;
		if(this.directional){this.walk.face(worldX-this.container.x,0);this.showWalkFrame(this.walk.stop());return}
		this.setFlipX(worldX<this.container.x);
	}

  private showBubble(text:string,status:{label:string;color:number}|null=null):void{
    const hasStatus=Boolean(status);
    this.bubbleText.setText(text).setY(this.bubbleY+(hasStatus?-8:0));
    this.bubbleBack.setSize(226,hasStatus?64:50);
    this.bubbleStatusBack.setVisible(hasStatus);
    this.bubbleStatusText.setVisible(hasStatus);
    if(status){
      const color=`#${status.color.toString(16).padStart(6,'0')}`;
      this.bubbleStatusBack.setStrokeStyle(1,status.color,.95).setFillStyle(status.color,.14);
      this.bubbleStatusText.setText(`STATUS · ${status.label}`).setColor(color);
    }
    this.bubble.setAlpha(1);
  }

  private hideBubble(immediate=false):void{
    this.scene.tweens.killTweensOf(this.bubble);if(immediate)this.bubble.setAlpha(0);else this.scene.tweens.add({targets:this.bubble,alpha:0,delay:1800,duration:400});
  }

  private celebrate():void{
    const sequence=++this.celebrationSequence;
    if(this.reducedMotion){this.scene.time.delayedCall(1600,()=>{if(sequence===this.celebrationSequence&&this.machine.state==='CELEBRATING')this.setState('IDLE','')});return}
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
