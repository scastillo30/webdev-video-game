import {Injectable, NgZone, inject, signal} from '@angular/core';
import Phaser from 'phaser';
import {Subject} from 'rxjs';
import {CastleScene, CASTLE_HEIGHT, CASTLE_WIDTH} from './engine/castle-scene';
import {CharacterDirective, defaultGameSettings, GameProfile, GameSettings} from './engine/game.models';

@Injectable()
export class GameRuntimeService{
  private readonly zone=inject(NgZone);
  private game:Phaser.Game|null=null;
  private scene:CastleScene|null=null;
  private pendingDirectives:CharacterDirective[]=[];
  private pendingFocus:string|null=null;
  private manuallyPaused=false;
  private settings:GameSettings=defaultGameSettings();
  private readonly selectionSubject=new Subject<string>();
  readonly selection$=this.selectionSubject.asObservable();
  readonly running=signal(false);
  readonly paused=signal(false);
  readonly reducedMotion=signal(false);

  start(host:HTMLElement,profiles:GameProfile[]):void{
    if(this.game)return;
    this.reducedMotion.set(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.zone.runOutsideAngular(()=>{
      this.scene=new CastleScene(
        profiles,
        characterId=>this.zone.run(()=>this.selectionSubject.next(characterId)),
        this.reducedMotion(),
        this.settings,
        ()=>{this.running.set(true);this.scene?.configure(this.settings);this.scene?.applyDirectives(this.pendingDirectives);this.scene?.focusCharacter(this.pendingFocus)}
      );
      this.game=new Phaser.Game({
        type:Phaser.AUTO,
        parent:host,
        width:CASTLE_WIDTH,
        height:CASTLE_HEIGHT,
        backgroundColor:'#050b15',
        transparent:false,
        scene:[this.scene],
        fps:{target:this.settings.targetFps,limit:this.settings.targetFps,forceSetTimeOut:false},
        scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:CASTLE_WIDTH,height:CASTLE_HEIGHT},
        render:{antialias:true,pixelArt:false,roundPixels:true,powerPreference:'low-power'}
      });
      document.addEventListener('visibilitychange',this.handleVisibility);
    });
  }

  configure(settings:GameSettings):void{
    this.settings=settings;
    if(this.scene?.scene?.isActive())this.scene.configure(settings);
  }

  applyDirectives(directives:CharacterDirective[]):void{
    this.pendingDirectives=directives;
    if(this.scene?.scene?.isActive())this.scene.applyDirectives(directives);
  }

  focusCharacter(characterId:string|null):void{
    this.pendingFocus=characterId;
    if(this.scene?.scene?.isActive())this.scene.focusCharacter(characterId);
  }

  setPaused(paused:boolean):void{
    this.manuallyPaused=paused;
    this.paused.set(paused);
    this.syncLoop();
  }

  stop():void{
    document.removeEventListener('visibilitychange',this.handleVisibility);
    this.zone.runOutsideAngular(()=>this.game?.destroy(true));
    this.game=null;this.scene=null;this.pendingDirectives=[];this.pendingFocus=null;this.manuallyPaused=false;
    this.running.set(false);this.paused.set(false);
  }

  private readonly handleVisibility=():void=>this.syncLoop();

  private syncLoop():void{
    if(!this.game)return;
    if(document.hidden||this.manuallyPaused)this.game.loop.sleep();
    else this.game.loop.wake();
  }
}
