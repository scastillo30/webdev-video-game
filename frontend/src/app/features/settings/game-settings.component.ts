import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';
import {CharacterState, GameConfig, GameProfile, StatusBehaviorMapping} from '../game/engine/game.models';
import {GameConfigService} from '../game/services/game-config.service';

const cloneConfig=(config:GameConfig):GameConfig=>({
  settings:{...config.settings},
  profiles:config.profiles.map(profile=>({...profile})),
  statusMappings:config.statusMappings.map(mapping=>({...mapping}))
});

@Component({
  selector:'app-game-settings',
  standalone:true,
  imports:[CommonModule,FormsModule],
  template:`
    <main class="game-settings-page">
      <header class="settings-heading">
        <div><p>GAME VIEW · CONFIGURATION</p><h1>Command Center Settings</h1></div>
        <span>Server validated · SQLite persisted</span>
      </header>

      <div class="settings-loading" *ngIf="!edit">LOADING COMMAND CENTER CONFIGURATION…</div>
      <form *ngIf="edit as config" (ngSubmit)="save()" class="game-settings-form">
        <p class="settings-alert error" *ngIf="error">{{error}}</p>
        <p class="settings-alert success" *ngIf="saved">Configuration saved. Game View will use it immediately.</p>

        <section class="settings-card">
          <div class="settings-card-title"><span>01</span><div><h2>Scene & Motion</h2><p>Runtime behavior without changing character-owned animation files.</p></div></div>
          <div class="settings-grid settings-grid-four">
            <label>SCENE<select name="scene" [(ngModel)]="config.settings.scene"><option value="castle-command-center">Castle Command Center</option></select></label>
            <label>ANIMATION SPEED<input name="animationSpeed" type="number" min="0.5" max="2" step="0.1" [(ngModel)]="config.settings.animationSpeed" required></label>
            <label class="toggle-setting"><input name="movementEnabled" type="checkbox" [(ngModel)]="config.settings.movementEnabled"><span>MOVEMENT ENABLED<small>Characters use A* routes.</small></span></label>
            <label class="toggle-setting"><input name="effectsEnabled" type="checkbox" [(ngModel)]="config.settings.effectsEnabled"><span>ENVIRONMENT EFFECTS<small>Torches, station glow, celebrations.</small></span></label>
          </div>
        </section>

        <section class="settings-card">
          <div class="settings-card-title"><span>02</span><div><h2>Spectator & Display</h2><p>Presentation timing and typography for office TVs.</p></div></div>
          <div class="settings-grid settings-grid-four">
            <label class="toggle-setting"><input name="spectatorEnabled" type="checkbox" [(ngModel)]="config.settings.spectatorEnabled"><span>AUTOMATIC SPECTATOR<small>Fair rotation between mapped users.</small></span></label>
            <label>ROTATION SECONDS<input name="rotationInterval" type="number" min="5" max="300" [(ngModel)]="config.settings.rotationIntervalSeconds" required></label>
            <label>TV TEXT SCALE<input name="tvScale" type="number" min="0.8" max="1.4" step="0.05" [(ngModel)]="config.settings.tvScale" required></label>
            <label class="toggle-setting"><input name="soundEnabled" type="checkbox" [(ngModel)]="config.settings.soundEnabled"><span>SOUND ENABLED<small>Reserved for scene cues.</small></span></label>
          </div>
        </section>

        <section class="settings-card">
          <div class="settings-card-title"><span>03</span><div><h2>Jira User → Character</h2><p>Use the stable Jira account ID. Blank means intentionally unmapped.</p></div></div>
          <div class="mapping-table" role="table" aria-label="Jira character mappings">
            <div class="mapping-row mapping-head" role="row"><span>Character</span><span>Jira account ID</span><span>Home</span><span>Workstation</span><span>Enabled</span></div>
            <div class="mapping-row" role="row" *ngFor="let profile of config.profiles;trackBy:trackProfile">
              <div class="mapping-character"><img [src]="'/legacy-game/'+profile.portraitAsset" alt=""><span>{{profile.displayName}}<small>{{profile.characterClass}}</small></span></div>
              <label><span class="sr-only">{{profile.displayName}} Jira account ID</span><input [name]="profile.characterId+'Jira'" [(ngModel)]="profile.jiraAccountId" placeholder="Unmapped"></label>
              <label><span class="sr-only">{{profile.displayName}} home</span><select [name]="profile.characterId+'Home'" [(ngModel)]="profile.homeLocation"><option *ngFor="let location of homeLocations" [value]="location.value">{{location.label}}</option></select></label>
              <label><span class="sr-only">{{profile.displayName}} workstation</span><select [name]="profile.characterId+'Work'" [(ngModel)]="profile.workstation"><option *ngFor="let station of workstations" [value]="station.value">{{station.label}}</option></select></label>
              <label class="mapping-enabled"><input [name]="profile.characterId+'Enabled'" type="checkbox" [(ngModel)]="profile.enabled"><span>{{profile.enabled?'ON':'OFF'}}</span></label>
            </div>
          </div>
        </section>

        <section class="settings-card">
          <div class="settings-card-title"><span>04</span><div><h2>Jira Status Behaviors</h2><p>Exact Jira status names override the safe default behavior classifier.</p></div><button type="button" class="small-action" (click)="addStatus()">＋ ADD STATUS</button></div>
          <div class="status-mappings">
            <div class="status-mapping" *ngFor="let mapping of config.statusMappings;let index=index;trackBy:trackStatus">
              <label>JIRA STATUS<input [name]="'status'+index" [(ngModel)]="mapping.status" maxlength="100" required></label>
              <label>GAME BEHAVIOR<select [name]="'behavior'+index" [(ngModel)]="mapping.behavior"><option *ngFor="let behavior of behaviors" [value]="behavior">{{behavior}}</option></select></label>
              <button type="button" aria-label="Remove status mapping" (click)="removeStatus(index)">×</button>
            </div>
          </div>
        </section>

        <footer class="settings-actions">
          <button type="button" (click)="reload()" [disabled]="saving">RESET</button>
          <button type="submit" class="primary" [disabled]="saving">{{saving?'SAVING…':'SAVE CONFIGURATION'}}</button>
        </footer>
      </form>
    </main>
  `
})
export class GameSettingsComponent implements OnInit,OnDestroy{
  private readonly service=inject(GameConfigService);
  private readonly subscriptions=new Subscription();
  protected edit:GameConfig|null=null;
  protected saving=false;
  protected saved=false;
  protected error='';
  protected readonly behaviors:CharacterState[]=['IDLE','WORKING','DISCUSSING','REVIEWING','BLOCKED','CELEBRATING'];
  protected readonly homeLocations=[
    {value:'command-dais',label:'Command Dais'},{value:'north-forge',label:'North Forge'},{value:'west-archive',label:'West Archive'},{value:'east-library',label:'East Library'},
    {value:'south-sanctum',label:'South Sanctum'},{value:'west-gate',label:'West Gate'},{value:'training-hall',label:'Training Hall'},{value:'east-stage',label:'East Stage'}
  ];
  protected readonly workstations=[
    {value:'planning-table',label:'Planning Table'},{value:'ops-console',label:'Ops Console'},{value:'frontend-desk',label:'Frontend Desk'},{value:'api-orb',label:'API Orb'},
    {value:'design-table',label:'Design Table'},{value:'support-desk',label:'Support Desk'},{value:'qa-board',label:'QA Board'},{value:'automation-console',label:'Automation Console'}
  ];

  ngOnInit():void{
    this.subscriptions.add(this.service.config$.subscribe(config=>this.edit=cloneConfig(config)));
    this.subscriptions.add(this.service.error$.subscribe(error=>this.error=error));
  }
  ngOnDestroy():void{this.subscriptions.unsubscribe()}
  protected reload():void{this.saved=false;this.error='';this.service.reload()}
  protected addStatus():void{this.edit?.statusMappings.push({status:'',behavior:'WORKING'})}
  protected removeStatus(index:number):void{this.edit?.statusMappings.splice(index,1)}
  protected trackProfile(_:number,profile:GameProfile):string{return profile.characterId}
  protected trackStatus(index:number,_mapping:StatusBehaviorMapping):number{return index}

  protected save():void{
    if(!this.edit||this.saving)return;
    this.error='';this.saved=false;
    const ids=this.edit.profiles.map(profile=>profile.jiraAccountId?.trim()).filter((value):value is string=>Boolean(value));
    if(new Set(ids).size!==ids.length){this.error='Each Jira account ID can map to only one character.';return}
    this.saving=true;
    this.service.save(this.edit).subscribe({
      next:config=>{this.edit=cloneConfig(config);this.saving=false;this.saved=true},
      error:response=>{this.saving=false;this.error=response.error?.error||'Could not save configuration'}
    });
  }
}
