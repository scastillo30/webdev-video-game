import Phaser from 'phaser';
import {JIRA_UNAVAILABLE_MESSAGE} from '../../../core/jira/jira-work-presentation';
import {HolidayBackground} from './holiday-background';
import {boardCharacterAsset} from './board-character-assets';
import {CharacterController} from './character-controller';
import {CharacterPathfinding} from './character-pathfinding';
import {
  CASTLE_ANCHORS,
  CASTLE_COLUMNS,
  CASTLE_ROWS,
  CASTLE_TILE_SIZE,
  CastleNavigationModel,
  InteractionTarget
} from './castle-navigation';
import {CharacterDirective, GameProfile, GameSettings, GridPoint} from './game.models';

export const CASTLE_WIDTH=CASTLE_COLUMNS*CASTLE_TILE_SIZE;
export const CASTLE_HEIGHT=CASTLE_ROWS*CASTLE_TILE_SIZE;
const cellKey=(point:GridPoint):string=>`${point.x},${point.y}`;

export class CastleScene extends Phaser.Scene{
  private holiday!:HolidayBackground;
  private background!:Phaser.GameObjects.Image;
  private crystalObjects:Phaser.GameObjects.Shape[]=[];
  private fireClock=0;
  private fire!:Phaser.GameObjects.Graphics;
  private readonly controllers=new Map<string,CharacterController>();
  private readonly directiveSignatures=new Map<string,string>();
  private readonly directivesByCharacter=new Map<string,CharacterDirective>();
  private readonly navigation=new CastleNavigationModel();
  private pathfinding!:CharacterPathfinding;
  private focusedCharacterId:string|null=null;
  private lastUpdate=0;
  private idleSequence=0;
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
    for(const mode of ['christmas','halloween'])this.load.image(`castle-${mode}`,`/assets/game-board/backgrounds/v001/${mode}.png`);
    for(const profile of this.profiles.filter(item=>item.enabled)){
      const fallbackPath=`/legacy-game/${profile.miniatureAsset}`;
      this.load.image(`hero-${profile.characterId}`,boardCharacterAsset(profile.characterId,fallbackPath).path);
      const walk=boardCharacterAsset(profile.characterId,fallbackPath).directional;
      if(walk)this.load.spritesheet(walk.key,walk.path,{frameWidth:walk.frameWidth,frameHeight:walk.frameHeight});
    }
  }

  create():void{
    this.createGrid();
    this.createArchitecture();
    this.holiday=new HolidayBackground(this,CASTLE_WIDTH,CASTLE_HEIGHT);
    this.refreshBackground();
    this.fire=this.add.graphics().setDepth(6);
    this.drawFire();
    this.createFallbackTextures();
    this.pathfinding=new CharacterPathfinding(CASTLE_COLUMNS,CASTLE_ROWS,this.navigation.blocked);
    for(const profile of this.profiles.filter(item=>item.enabled)){
      const home=this.navigation.anchor(profile.homeLocation);
      this.controllers.set(profile.characterId,new CharacterController(this,profile,this.pathfinding,CASTLE_TILE_SIZE,home,this.onSelect,this.reducedMotion,this.settings));
    }
    this.onReady();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.destroyControllers());
  }

  override update(time:number,delta:number):void{
    if(this.settings.effectsEnabled&&!this.reducedMotion){this.fireClock+=Math.min(delta,100)*this.settings.animationSpeed;this.drawFire()}
    this.holiday.update(delta,this.settings,this.reducedMotion);
    for(const controller of this.controllers.values())controller.animate(delta);
    if(time-this.lastUpdate<100)return;
    this.lastUpdate=time;
    for(const controller of this.controllers.values())controller.update(time,item=>this.tryIdleMove(item));
  }

  applyDirectives(directives:CharacterDirective[]):void{
    for(const directive of directives){
      this.directivesByCharacter.set(directive.characterId,directive);
      const controller=this.controllers.get(directive.characterId);
      if(!controller)continue;
      const signature=[directive.state,directive.issue?.issueKey,directive.event?.eventId,directive.label,directive.status?.label].join('|');
      if(this.directiveSignatures.get(directive.characterId)===signature)continue;
      this.directiveSignatures.set(directive.characterId,signature);
      const reserved=this.reserved(controller.profile.characterId);
      const target=this.destination(controller,directive,reserved);
      controller.apply(directive,target.point,reserved,target.facingX);
    }
  }

  configure(settings:GameSettings):void{
    this.settings=settings;
    this.refreshBackground();
    if(this.fire)this.drawFire();
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
	this.background=this.add.image(0,0,'castle-office-background').setOrigin(0).setDisplaySize(CASTLE_WIDTH,CASTLE_HEIGHT).setDepth(0);
	const atmosphere=this.add.graphics().setDepth(1);
	atmosphere.fillGradientStyle(0x03101d,0x03101d,0x020711,0x020711,.05,.05,.22,.22).fillRect(0,0,CASTLE_WIDTH,CASTLE_HEIGHT);
    if(new URLSearchParams(window.location.search).get('navGrid')==='1')this.drawNavigationGrid();
  }

  private createArchitecture():void{
	const border=this.add.graphics().setDepth(2);
	border.lineStyle(2,0xe0b858,.72).strokeRect(8,8,CASTLE_WIDTH-16,CASTLE_HEIGHT-16);
	border.lineStyle(1,0x5cd8ff,.18).strokeRect(13,13,CASTLE_WIDTH-26,CASTLE_HEIGHT-26);
	this.addHologram(720,304);
	this.addCrystalGlow(116,204);
	this.addFireGlow(1300,142);
	this.addStation(CASTLE_ANCHORS['planning-table'],'PLANNING TABLE',0x64dfff);
	this.addStation(CASTLE_ANCHORS['ops-console'],'OPS CONSOLE',0x64dfff);
	this.addStation(CASTLE_ANCHORS['frontend-desk'],'FRONTEND',0x64dfff);
	this.addStation(CASTLE_ANCHORS['quest-board'],'QUEST BOARD',0xe0b858);
	this.addStation(CASTLE_ANCHORS['api-orb'],'API ORB',0x64dfff);
	this.addStation(CASTLE_ANCHORS['automation-console'],'AUTOMATION',0xbd79ed);
	this.addStation(CASTLE_ANCHORS['entrance'],'GREAT GATE',0x77dbbf);
	for(const point of [{x:9,y:2},{x:20,y:2},{x:10,y:11},{x:20,y:11}])this.addTorch(point);
  }

  private addStation(point:GridPoint,label:string,color:number):void{
    const x=point.x*CASTLE_TILE_SIZE+CASTLE_TILE_SIZE/2,y=point.y*CASTLE_TILE_SIZE+CASTLE_TILE_SIZE/2;
	const ring=this.add.ellipse(x,y,38,14,color,.1).setStrokeStyle(1,color,.55).setDepth(40);
	this.add.text(x,y+15,label,{fontFamily:'Manrope,sans-serif',fontSize:'7px',color:'#b8cad3',stroke:'#04101d',strokeThickness:3}).setOrigin(.5).setDepth(41);
    if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:ring,alpha:.45,scaleX:1.18,scaleY:1.18,duration:1800/this.settings.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut',paused:!this.settings.effectsEnabled}));
  }

  private addTorch(point:GridPoint):void{
    const x=point.x*CASTLE_TILE_SIZE+CASTLE_TILE_SIZE/2,y=point.y*CASTLE_TILE_SIZE+6;
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
	this.crystalObjects=[aura,shard];
	if(!this.reducedMotion)this.ambientTweens.push(this.tweens.add({targets:[aura,shard],alpha:{from:.18,to:.62},scale:{from:.96,to:1.05},duration:1900/this.settings.animationSpeed,yoyo:true,repeat:-1,ease:'Sine.inOut',paused:!this.settings.effectsEnabled}));
  }

  private refreshBackground():void{
    const mode=this.settings.holidayMode;
    this.background.setTexture(mode==='christmas'||mode==='halloween'?`castle-${mode}`:'castle-office-background').setDisplaySize(CASTLE_WIDTH,CASTLE_HEIGHT);
    for(const object of this.crystalObjects)object.setVisible(mode!=='christmas');
    this.holiday.configure(mode);
  }

  private drawFire():void{
    this.fire.clear();
    const t=this.fireClock/1000;
    // Layered tongues remain inside the illustrated hearth, anchored above its logs.
    this.fire.fillStyle(0xff8b29,.09).fillEllipse(1280,159,88,64);
    for(let i=0;i<7;i++){
      const x=1256+i*8,y=176;
      const wave=Math.sin(t*(7+i*.4)+i*2);
      const height=15+(i%3)*5+(wave+1)*6;
      this.fire.fillStyle(0xf36b20,.85).fillTriangle(x-6,y,x+wave*3,y-height,x+7,y);
      this.fire.fillStyle(0xffd45e,.95).fillTriangle(x-3,y,x+wave*2,y-height*.7,x+4,y);
      this.fire.fillStyle(0xfff1ae,.9).fillTriangle(x-2,y,x,y-height*.35,x+2,y);
    }
    if(this.settings.effectsEnabled&&!this.reducedMotion)for(let i=0;i<4;i++){
      const phase=(t*.5+i*.27)%1;
      this.fire.fillStyle(0xffd17c,(1-phase)*.8).fillCircle(1264+i*10+Math.sin(t*2+i)*3,166-phase*30,1.2);
    }
  }

  private addFireGlow(x:number,y:number):void{
    this.add.circle(x,y,55,0xff9c3b,.06).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
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

  private destination(controller:CharacterController,directive:CharacterDirective,reserved:ReadonlySet<string>):InteractionTarget{
    let station='';
    if(directive.state==='WORKING')station=controller.profile.workstation;
    else if(directive.state==='REVIEWING')station='review-table';
    else if(directive.state==='DISCUSSING')station='planning-table';
    else if(directive.state==='CELEBRATING')station='quest-board';
    const target=station?this.navigation.station(station,controller.currentCell,reserved):null;
    return target??{point:this.navigation.anchor(controller.profile.homeLocation),state:directive.state};
  }

  private tryIdleMove(controller:CharacterController):void{
    if(!this.settings.movementEnabled||this.focusedCharacterId===controller.profile.characterId)return;
    const reserved=this.reserved(controller.profile.characterId);
    const behavior=(this.identityIndex(controller.profile.characterId)+this.idleSequence++)%5;
    const autonomousCount=[...this.controllers.values()].filter(candidate=>candidate.isAutonomousBusy).length;
    if(behavior===0&&autonomousCount===0&&this.startConversation(controller,reserved))return;
    const station=behavior===1?'planning-table':behavior===2?'library':behavior===3?controller.profile.workstation:'';
    if(station&&autonomousCount<2){
      const target=this.navigation.station(station,controller.currentCell,reserved);
      const work=this.workFor(controller);
      if(target){controller.interact(target.point,reserved,work.label,target.state,work.status,3400,target.facingX);return}
    }
    const destination=this.navigation.roam(this.navigation.anchor(controller.profile.homeLocation),controller.currentCell,reserved);
    if(destination)controller.wander(destination,reserved);
  }

  private reserved(exceptCharacterId:string):ReadonlySet<string>{
    const occupied=new Set<string>();
    for(const [id,controller] of this.controllers){
      if(id===exceptCharacterId)continue;
      occupied.add(cellKey(controller.currentCell));
      const destination=controller.destinationCell;
      if(destination)occupied.add(cellKey(destination));
    }
    return occupied;
  }

  private startConversation(controller:CharacterController,reserved:ReadonlySet<string>):boolean{
    const partner=[...this.controllers.values()]
      .filter(candidate=>candidate!==controller&&candidate.availableForConversation&&candidate.profile.characterId!==this.focusedCharacterId)
      .sort((left,right)=>this.cellDistance(controller.currentCell,left.currentCell)-this.cellDistance(controller.currentCell,right.currentCell))[0];
    if(!partner)return false;
    const meetingPoint=this.navigation.adjacentTo(partner.currentCell,controller.currentCell,reserved);
    if(!meetingPoint||!this.pathfinding.find(controller.currentCell,meetingPoint,reserved).length)return false;
    const work=this.workFor(controller),partnerWork=this.workFor(partner);
    controller.interact(
      meetingPoint,
      reserved,
      work.label,
      'DISCUSSING',
      work.status,
      3600,
      partner.currentCell.x,
      ()=>partner.engage(partnerWork.label,'DISCUSSING',partnerWork.status,3600,meetingPoint.x)
    );
    return true;
  }

  private drawNavigationGrid():void{
    const graphics=this.add.graphics().setDepth(9000);
    for(let y=0;y<CASTLE_ROWS;y++)for(let x=0;x<CASTLE_COLUMNS;x++){
      const blocked=this.navigation.blocked.has(`${x},${y}`);
      graphics.fillStyle(blocked?0xff4968:0x5be5a8,blocked ? .24 : .08).fillRect(x*CASTLE_TILE_SIZE,y*CASTLE_TILE_SIZE,CASTLE_TILE_SIZE-1,CASTLE_TILE_SIZE-1);
    }
  }

  private identityIndex(characterId:string):number{return this.profiles.findIndex(profile=>profile.characterId===characterId)}
  private workFor(controller:CharacterController):Pick<CharacterDirective,'label'|'status'>{
    const directive=this.directivesByCharacter.get(controller.profile.characterId);
    return{label:directive?.label??JIRA_UNAVAILABLE_MESSAGE,status:directive?.status??null};
  }
  private cellDistance(left:GridPoint,right:GridPoint):number{return Math.abs(left.x-right.x)+Math.abs(left.y-right.y)}
  private destroyControllers():void{for(const controller of this.controllers.values())controller.destroy();this.controllers.clear();this.directivesByCharacter.clear()}
}
