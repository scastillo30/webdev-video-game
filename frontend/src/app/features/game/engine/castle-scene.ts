import Phaser from 'phaser';
import {CharacterController} from './character-controller';
import {CharacterPathfinding} from './character-pathfinding';
import {CharacterDirective, GameProfile, GameSettings, GridPoint} from './game.models';

export const CASTLE_WIDTH=1440;
export const CASTLE_HEIGHT=720;
const TILE_SIZE=48;
const COLUMNS=CASTLE_WIDTH/TILE_SIZE;
const ROWS=CASTLE_HEIGHT/TILE_SIZE;
const cellKey=(point:GridPoint):string=>`${point.x},${point.y}`;

const anchors:Record<string,GridPoint>={
	'command-dais':{x:15,y:3},'north-forge':{x:5,y:7},'west-archive':{x:8,y:8},'east-library':{x:21,y:4},
	'south-sanctum':{x:15,y:12},'west-gate':{x:9,y:12},'training-hall':{x:24,y:11},'east-stage':{x:23,y:11},
	'planning-table':{x:10,y:7},'ops-console':{x:8,y:6},'frontend-desk':{x:9,y:9},'api-orb':{x:21,y:5},
	'design-table':{x:11,y:11},'support-desk':{x:7,y:11},'qa-board':{x:21,y:10},'automation-console':{x:22,y:7},
	'quest-board':{x:20,y:5},'review-table':{x:19,y:7},'entrance':{x:15,y:13}
};

export class CastleScene extends Phaser.Scene{
  private readonly controllers=new Map<string,CharacterController>();
  private readonly directiveSignatures=new Map<string,string>();
  private readonly blocked=new Set<string>();
  private pathfinding!:CharacterPathfinding;
  private focusedCharacterId:string|null=null;
  private lastUpdate=0;
  private readonly ambientTweens:Phaser.Tweens.Tween[]=[];

  constructor(
    private readonly profiles:GameProfile[],
    private readonly onSelect:(characterId:string)=>void,
    private readonly reducedMotion:boolean,
    private settings:GameSettings,
    private readonly onReady:()=>void
  ){super({key:'castle-command-center'})}

  preload():void{
	this.load.image('castle-office-background','/assets/game-board/castle-office-v001.png');
    for(const profile of this.profiles.filter(item=>item.enabled))this.load.image(`hero-${profile.characterId}`,`/legacy-game/${profile.miniatureAsset}`);
  }

  create():void{
    this.createGrid();
    this.createArchitecture();
    this.createFallbackTextures();
    this.pathfinding=new CharacterPathfinding(COLUMNS,ROWS,this.blocked);
    for(const profile of this.profiles.filter(item=>item.enabled)){
      const home=this.anchor(profile.homeLocation);
      this.controllers.set(profile.characterId,new CharacterController(this,profile,this.pathfinding,TILE_SIZE,home,this.onSelect,this.reducedMotion,this.settings));
    }
    this.onReady();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.destroyControllers());
  }

  override update(time:number):void{
    if(time-this.lastUpdate<100)return;
    this.lastUpdate=time;
    for(const controller of this.controllers.values())controller.update(time,item=>this.tryIdleMove(item));
  }

  applyDirectives(directives:CharacterDirective[]):void{
    for(const directive of directives){
      const controller=this.controllers.get(directive.characterId);
      if(!controller)continue;
      const signature=[directive.state,directive.issue?.issueKey,directive.event?.eventId,directive.label].join('|');
      if(this.directiveSignatures.get(directive.characterId)===signature)continue;
      this.directiveSignatures.set(directive.characterId,signature);
      controller.apply(directive,this.destination(controller.profile,directive),this.reserved(controller.profile.characterId));
    }
  }

  configure(settings:GameSettings):void{
    this.settings=settings;
    for(const controller of this.controllers.values())controller.configure(settings);
    for(const tween of this.ambientTweens)settings.effectsEnabled?tween.resume():tween.pause();
  }

  focusCharacter(characterId:string|null):void{
    this.focusedCharacterId=characterId;
    for(const [id,controller] of this.controllers)controller.focus(id===characterId,Boolean(characterId));
    const selected=characterId?this.controllers.get(characterId):null;
    if(!this.reducedMotion){
      if(selected){const point=selected.worldPosition;this.cameras.main.pan(point.x,point.y,650,'Sine.easeInOut');}
      else this.cameras.main.pan(CASTLE_WIDTH/2,CASTLE_HEIGHT/2,650,'Sine.easeInOut');
    }
  }

  private createGrid():void{
	this.add.image(0,0,'castle-office-background').setOrigin(0).setDisplaySize(CASTLE_WIDTH,CASTLE_HEIGHT).setDepth(0);
	const atmosphere=this.add.graphics().setDepth(1);
	atmosphere.fillGradientStyle(0x03101d,0x03101d,0x020711,0x020711,.05,.05,.22,.22).fillRect(0,0,CASTLE_WIDTH,CASTLE_HEIGHT);
    for(let column=0;column<COLUMNS;column++){this.blocked.add(`${column},0`);this.blocked.add(`${column},${ROWS-1}`)}
    for(let row=0;row<ROWS;row++){this.blocked.add(`0,${row}`);this.blocked.add(`${COLUMNS-1},${row}`)}
	// Static furniture in the illustrated board remains outside the navigation mesh.
	this.blockRect(1,3,5,4);   // crystal fountain
	this.blockRect(6,3,5,3);   // northwest workstation
	this.blockRect(12,6,7,4);  // central planning table and chairs
	this.blockRect(22,1,7,4);  // fireplace and north library
	this.blockRect(23,5,6,3);  // east map/archive wall
	this.blockRect(1,8,7,3);   // southwest workstation
	this.blockRect(24,8,5,3);  // southeast workstation
	this.blockRect(1,12,8,2);  // west lower landing
	this.blockRect(21,12,8,2); // east lower landing
  }

  private createArchitecture():void{
	const border=this.add.graphics().setDepth(2);
	border.lineStyle(2,0xe0b858,.72).strokeRect(8,8,CASTLE_WIDTH-16,CASTLE_HEIGHT-16);
	border.lineStyle(1,0x5cd8ff,.18).strokeRect(13,13,CASTLE_WIDTH-26,CASTLE_HEIGHT-26);
	this.addHologram(720,304);
	this.addCrystalGlow(116,204);
	this.addFireGlow(1300,142);
	this.addStation(anchors['planning-table'],'PLANNING TABLE',0x64dfff);
	this.addStation(anchors['ops-console'],'OPS CONSOLE',0x64dfff);
	this.addStation(anchors['frontend-desk'],'FRONTEND',0x64dfff);
	this.addStation(anchors['quest-board'],'QUEST BOARD',0xe0b858);
	this.addStation(anchors['api-orb'],'API ORB',0x64dfff);
	this.addStation(anchors['automation-console'],'AUTOMATION',0xbd79ed);
	this.addStation(anchors['entrance'],'GREAT GATE',0x77dbbf);
	for(const point of [{x:9,y:2},{x:20,y:2},{x:10,y:11},{x:20,y:11}])this.addTorch(point);
  }

  private blockRect(column:number,row:number,width:number,height:number):void{
	for(let r=row;r<row+height;r++)for(let c=column;c<column+width;c++)this.blocked.add(`${c},${r}`);
  }

  private addStation(point:GridPoint,label:string,color:number):void{
    const x=point.x*TILE_SIZE+TILE_SIZE/2,y=point.y*TILE_SIZE+TILE_SIZE/2;
	const ring=this.add.ellipse(x,y,38,14,color,.1).setStrokeStyle(1,color,.55).setDepth(40);
	this.add.text(x,y+15,label,{fontFamily:'Manrope,sans-serif',fontSize:'7px',color:'#b8cad3',stroke:'#04101d',strokeThickness:3}).setOrigin(.5).setDepth(41);
    if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:ring,alpha:.45,scaleX:1.18,scaleY:1.18,duration:1800/this.settings.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut',paused:!this.settings.effectsEnabled}));
  }

  private addTorch(point:GridPoint):void{
    const x=point.x*TILE_SIZE+TILE_SIZE/2,y=point.y*TILE_SIZE+6;
	const flame=this.add.circle(x,y,3,0xffd16f,.72).setDepth(45);
	this.add.circle(x,y,11,0xffa63b,.05).setDepth(44);
    if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:flame,scaleX:.7,scaleY:1.4,alpha:.62,duration:(420+point.x*13)/this.settings.animationSpeed,yoyo:true,repeat:-1,paused:!this.settings.effectsEnabled}));
  }

  private addHologram(x:number,y:number):void{
	const glow=this.add.circle(x,y,68,0x44dfff,.06).setDepth(5);
	const outer=this.add.ellipse(x,y,112,35).setStrokeStyle(2,0x64e8ff,.48).setDepth(6);
	const inner=this.add.ellipse(x,y,78,24).setStrokeStyle(1,0xd4f8ff,.52).setDepth(7);
	const core=this.add.circle(x,y,7,0xa9f6ff,.8).setDepth(8);
	if(this.reducedMotion)return;
	this.ambientTweens.push(
	  this.tweens.add({targets:outer,angle:360,duration:9000/this.settings.animationSpeed,repeat:-1,paused:!this.settings.effectsEnabled}),
	  this.tweens.add({targets:inner,angle:-360,duration:6500/this.settings.animationSpeed,repeat:-1,paused:!this.settings.effectsEnabled}),
	  this.tweens.add({targets:[glow,core],alpha:{from:.2,to:.75},scale:{from:.92,to:1.08},duration:1500/this.settings.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut',paused:!this.settings.effectsEnabled})
	);
  }

  private addCrystalGlow(x:number,y:number):void{
	const aura=this.add.circle(x,y,54,0x35dfff,.09).setDepth(4);
	const shard=this.add.polygon(x,y,[0,-33,13,-10,9,28,0,38,-9,28,-13,-10],0xa8f5ff,.18).setStrokeStyle(1,0x7deaff,.62).setDepth(5);
	if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:[aura,shard],alpha:{from:.18,to:.62},scale:{from:.96,to:1.05},duration:1900/this.settings.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut',paused:!this.settings.effectsEnabled}));
  }

  private addFireGlow(x:number,y:number):void{
	const glow=this.add.circle(x,y,72,0xff9c3b,.08).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
	const ember=this.add.circle(x,y,8,0xffdc82,.45).setDepth(5);
	if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:[glow,ember],alpha:{from:.12,to:.62},scaleX:{from:.88,to:1.12},scaleY:{from:1.08,to:.92},duration:520/this.settings.animationSpeed,yoyo:true,repeat:-1,paused:!this.settings.effectsEnabled}));
  }

  private createFallbackTextures():void{
    for(const profile of this.profiles){
      const key=`hero-${profile.characterId}`;
      if(this.textures.exists(key))continue;
      const graphics=this.make.graphics({x:0,y:0},false);
      graphics.fillStyle(0x102d43,1).fillRoundedRect(4,4,68,92,18).lineStyle(2,0xddb868,1).strokeRoundedRect(4,4,68,92,18);
      graphics.fillStyle(0xddb868,1).fillCircle(38,28,13).fillRoundedRect(22,43,32,43,8);
      graphics.generateTexture(key,76,100);graphics.destroy();
    }
  }

  private destination(profile:GameProfile,directive:CharacterDirective):GridPoint{
    if(directive.state==='WORKING')return this.anchor(profile.workstation);
    if(directive.state==='REVIEWING')return this.anchor('review-table');
    if(directive.state==='DISCUSSING')return this.anchor('planning-table');
    if(directive.state==='CELEBRATING')return this.anchor('quest-board');
    return this.anchor(profile.homeLocation);
  }

  private tryIdleMove(controller:CharacterController):void{
    if(!this.settings.movementEnabled||this.focusedCharacterId===controller.profile.characterId)return;
    const origin=this.anchor(controller.profile.homeLocation);
    const choices=[{x:origin.x+1,y:origin.y},{x:origin.x-1,y:origin.y},{x:origin.x,y:origin.y+1},{x:origin.x,y:origin.y-1}]
      .filter(point=>!this.blocked.has(cellKey(point))&&!this.reserved(controller.profile.characterId).has(cellKey(point)));
    if(choices.length)controller.wander(choices[Math.floor(Math.random()*choices.length)],this.reserved(controller.profile.characterId));
  }

  private reserved(exceptCharacterId:string):ReadonlySet<string>{
    return new Set([...this.controllers.entries()].filter(([id])=>id!==exceptCharacterId).map(([,controller])=>cellKey(controller.currentCell)));
  }

  private anchor(name:string):GridPoint{return{...(anchors[name]??anchors['entrance'])}}
  private destroyControllers():void{for(const controller of this.controllers.values())controller.destroy();this.controllers.clear()}
}
