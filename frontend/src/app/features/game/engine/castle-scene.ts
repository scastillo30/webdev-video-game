import Phaser from 'phaser';
import {CharacterController} from './character-controller';
import {CharacterPathfinding} from './character-pathfinding';
import {CharacterDirective, GameProfile, GridPoint} from './game.models';

export const CASTLE_WIDTH=1440;
export const CASTLE_HEIGHT=720;
const TILE_SIZE=48;
const COLUMNS=CASTLE_WIDTH/TILE_SIZE;
const ROWS=CASTLE_HEIGHT/TILE_SIZE;
const cellKey=(point:GridPoint):string=>`${point.x},${point.y}`;

const anchors:Record<string,GridPoint>={
  'command-dais':{x:15,y:2},'north-forge':{x:5,y:3},'west-archive':{x:3,y:7},'east-library':{x:26,y:3},
  'south-sanctum':{x:15,y:12},'west-gate':{x:3,y:12},'training-hall':{x:24,y:11},'east-stage':{x:26,y:7},
  'planning-table':{x:12,y:6},'ops-console':{x:8,y:4},'frontend-desk':{x:7,y:8},'api-orb':{x:22,y:4},
  'design-table':{x:13,y:11},'support-desk':{x:7,y:11},'qa-board':{x:21,y:10},'automation-console':{x:23,y:7},
  'quest-board':{x:15,y:4},'review-table':{x:17,y:7},'entrance':{x:15,y:13}
};

export class CastleScene extends Phaser.Scene{
  private readonly controllers=new Map<string,CharacterController>();
  private readonly directiveSignatures=new Map<string,string>();
  private readonly blocked=new Set<string>();
  private pathfinding!:CharacterPathfinding;
  private focusedCharacterId:string|null=null;
  private lastUpdate=0;

  constructor(
    private readonly profiles:GameProfile[],
    private readonly onSelect:(characterId:string)=>void,
    private readonly reducedMotion:boolean,
    private readonly onReady:()=>void
  ){super({key:'castle-command-center'})}

  preload():void{
    for(const profile of this.profiles.filter(item=>item.enabled))this.load.image(`hero-${profile.characterId}`,`/legacy-game/${profile.miniatureAsset}`);
  }

  create():void{
    this.createGrid();
    this.createArchitecture();
    this.createFallbackTextures();
    this.pathfinding=new CharacterPathfinding(COLUMNS,ROWS,this.blocked);
    for(const profile of this.profiles.filter(item=>item.enabled)){
      const home=this.anchor(profile.homeLocation);
      this.controllers.set(profile.characterId,new CharacterController(this,profile,this.pathfinding,TILE_SIZE,home,this.onSelect,this.reducedMotion));
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
    const floor=this.add.graphics();
    floor.fillStyle(0x101e2c,1).fillRect(0,0,CASTLE_WIDTH,CASTLE_HEIGHT);
    for(let row=0;row<ROWS;row++)for(let column=0;column<COLUMNS;column++){
      floor.fillStyle((row+column)%2?0x132637:0x162b3c,1).fillRect(column*TILE_SIZE,row*TILE_SIZE,TILE_SIZE-1,TILE_SIZE-1);
    }
    const glow=this.add.graphics();
    glow.fillGradientStyle(0x1b5470,0x1b5470,0x06101e,0x06101e,.34,.34,.08,.08).fillRect(0,0,CASTLE_WIDTH,CASTLE_HEIGHT);
    for(let column=0;column<COLUMNS;column++){this.blocked.add(`${column},0`);this.blocked.add(`${column},${ROWS-1}`)}
    for(let row=0;row<ROWS;row++){this.blocked.add(`0,${row}`);this.blocked.add(`${COLUMNS-1},${row}`)}
  }

  private createArchitecture():void{
    const wall=this.add.graphics().setDepth(2);
    wall.fillStyle(0x07111d,1).fillRect(0,0,CASTLE_WIDTH,TILE_SIZE).fillRect(0,CASTLE_HEIGHT-TILE_SIZE,CASTLE_WIDTH,TILE_SIZE).fillRect(0,0,TILE_SIZE,CASTLE_HEIGHT).fillRect(CASTLE_WIDTH-TILE_SIZE,0,TILE_SIZE,CASTLE_HEIGHT);
    wall.lineStyle(2,0xb18b50,.7).strokeRect(10,10,CASTLE_WIDTH-20,CASTLE_HEIGHT-20);
    for(const x of [240,720,1200]){
      const window=this.add.graphics().setDepth(3);
      window.fillStyle(0x103853,.9).fillRoundedRect(x-36,8,72,52,30).lineStyle(2,0x6fcbe6,.45).strokeRoundedRect(x-36,8,72,52,30);
    }
    this.add.text(720,20,'CASTLE COMMAND CENTER',{fontFamily:'Cinzel,serif',fontSize:'18px',color:'#eed092',stroke:'#08111d',strokeThickness:5}).setOrigin(.5).setDepth(4);
    this.addFurniture(13,6,4,3,'WAR TABLE');
    this.addFurniture(4,4,3,1,'FORGE');this.addFurniture(23,3,3,1,'ARCHIVES');
    this.addFurniture(5,9,3,1,'SUPPORT');this.addFurniture(21,8,3,1,'QUALITY');
    this.addFurniture(10,10,3,1,'DESIGN');this.addFurniture(18,5,3,1,'REVIEW');
    this.addFurniture(2,4,1,3,'');this.addFurniture(27,5,1,3,'');
    this.addStation(anchors['quest-board'],'QUEST BOARD',0xd9ae57);
    this.addStation(anchors['api-orb'],'API ORB',0x5bd7ef);
    this.addStation(anchors['automation-console'],'AUTOMATION',0xb36bea);
    this.addStation(anchors['entrance'],'GREAT GATE',0x77dbbf);
    for(const point of [anchors['west-gate'],anchors['east-stage'],anchors['north-forge']])this.addTorch(point);
    this.add.text(720,690,'✦  ONE JIRA STREAM · EIGHT DISTINCT HEROES  ✦',{fontFamily:'Cinzel,serif',fontSize:'10px',color:'#a98b57'}).setOrigin(.5).setDepth(4);
  }

  private addFurniture(column:number,row:number,width:number,height:number,label:string):void{
    const x=column*TILE_SIZE,y=row*TILE_SIZE,w=width*TILE_SIZE,h=height*TILE_SIZE;
    const furniture=this.add.graphics().setDepth(20);
    furniture.fillStyle(0x091522,.96).fillRoundedRect(x+5,y+5,w-10,h-10,8).lineStyle(2,0x8e7042,.75).strokeRoundedRect(x+5,y+5,w-10,h-10,8);
    if(label)this.add.text(x+w/2,y+h/2,label,{fontFamily:'Cinzel,serif',fontSize:'9px',color:'#caae78'}).setOrigin(.5).setDepth(21);
    for(let r=row;r<row+height;r++)for(let c=column;c<column+width;c++)this.blocked.add(`${c},${r}`);
  }

  private addStation(point:GridPoint,label:string,color:number):void{
    const x=point.x*TILE_SIZE+TILE_SIZE/2,y=point.y*TILE_SIZE+TILE_SIZE/2;
    const ring=this.add.ellipse(x,y,42,20,color,.12).setStrokeStyle(1,color,.65).setDepth(3);
    this.add.text(x,y+17,label,{fontFamily:'Manrope,sans-serif',fontSize:'7px',color:'#83a9bd'}).setOrigin(.5).setDepth(4);
    if(!this.reducedMotion)this.tweens.add({targets:ring,alpha:.45,scaleX:1.18,scaleY:1.18,duration:1800,yoyo:true,repeat:-1,ease:'Sine.inOut'});
  }

  private addTorch(point:GridPoint):void{
    const x=point.x*TILE_SIZE+TILE_SIZE/2,y=point.y*TILE_SIZE+6;
    const flame=this.add.circle(x,y,5,0xffc55c,.9).setDepth(5);
    this.add.circle(x,y,14,0xff9d36,.08).setDepth(4);
    if(!this.reducedMotion)this.tweens.add({targets:flame,scaleX:.7,scaleY:1.4,alpha:.62,duration:420+point.x*13,yoyo:true,repeat:-1});
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
    if(this.focusedCharacterId===controller.profile.characterId)return;
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
