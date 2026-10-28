import {DatePipe, NgFor, NgIf} from '@angular/common';
import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject} from '@angular/core';
import {combineLatest, Subscription} from 'rxjs';
import {emptyJiraSnapshot, JiraActivityEvent, JiraIssueSnapshot, JiraSnapshot} from '../../core/jira/jira.models';
import {JiraStoreService} from '../../core/jira/jira-store.service';
import {CharacterDirective, defaultGameSettings, GameProfile, GameSettings, SpectatorState, StatusBehaviorMapping} from './engine/game.models';
import {GameRuntimeService} from './game-runtime.service';
import {GameBehaviorService} from './services/game-behavior.service';
import {GameConfigService} from './services/game-config.service';
import {SpectatorDirectorService} from './services/spectator-director.service';
import {EmployeeJiraActivity, UserJiraService} from '../../core/jira/user-jira.service';
import {jiraRelativeTime, jiraStatusPresentation, jiraWorkPresentation} from '../../core/jira/jira-work-presentation';

@Component({
  selector:'app-game-view',
  standalone:true,
  imports:[DatePipe,NgFor,NgIf],
  providers:[GameRuntimeService,GameBehaviorService,SpectatorDirectorService],
  template:`
    <main class="game-view" [class.tv-mode]="settings.tvModeEnabled" [style.--tv-scale]="settings.tvScale">
      <section class="game-scene-shell" aria-labelledby="gameTitle">
        <div class="game-toolbar">
          <div><small>LIVE GAME BOARD · SHARED JIRA STREAM</small><h1 id="gameTitle">CASTLE COMMAND CENTER</h1></div>
          <div class="game-health" [attr.data-state]="profileActivityAvailable ? 'live' : snapshot.connection.state">
            <i aria-hidden="true"></i>
            <span>{{profileActivityAvailable ? 'profile activity' : (snapshot.connection.configured ? snapshot.connection.state : 'not configured')}}</span>
            <b>{{enabledProfiles.length}} HEROES · {{settings.rotationIntervalSeconds}}S</b>
            <button *ngIf="settings.fullscreenEnabled" type="button" class="fullscreen-control" (click)="toggleFullscreen()" [attr.aria-pressed]="fullscreen">{{fullscreen?'EXIT FULLSCREEN':'FULLSCREEN'}}</button>
          </div>
        </div>
        <div #gameHost class="phaser-host" aria-label="Top-down castle command center with eight roster characters"></div>
        <div class="scene-loading" *ngIf="!runtime.running()" aria-live="polite">SUMMONING THE PARTY…</div>
        <div class="motion-note" *ngIf="runtime.reducedMotion()">REDUCED MOTION · INSTANT TRAVEL</div>
        <div class="board-location" aria-hidden="true"><i></i><span>SKYFORGE KEEP</span><small>DEVELOPER OPERATIONS FLOOR</small></div>
        <div class="hero-shortcuts" aria-label="Focus a party character">
          <button *ngFor="let hero of enabledProfiles" type="button" (click)="selectCharacter(hero.characterId)"
            [attr.aria-label]="'Focus ' + hero.displayName" [attr.aria-pressed]="presentation.focusCharacterId === hero.characterId">
            {{hero.displayName}}
          </button>
        </div>
      </section>

      <section class="game-activity-panel" aria-live="polite">
        <span class="panel-corner panel-corner-nw" aria-hidden="true">✦</span>
        <span class="panel-corner panel-corner-ne" aria-hidden="true">✦</span>
        <span class="panel-corner panel-corner-sw" aria-hidden="true">✦</span>
        <span class="panel-corner panel-corner-se" aria-hidden="true">✦</span>
        <ng-container *ngIf="activeProfile as character; else overviewPanel">
          <div class="activity-portrait">
            <img [src]="'/legacy-game/' + character.portraitAsset" [alt]="character.displayName + ' portrait'">
          </div>
          <div class="activity-copy">
            <div class="activity-heading">
              <span>{{character.characterClass}} · {{character.displayName}}</span>
              <small *ngIf="presentation.active">JIRA USER · {{presentation.active.event.authorName || 'IDENTITY HIDDEN'}}</small>
            </div>
            <ng-container *ngIf="presentation.active as item; else selectedIdle">
              <p class="activity-dialogue">{{dialogueWorkFor(item.event)}} <strong>{{relativeTime(item.event.occurredAt)}}</strong>!</p>
              <a class="ticket-title" [href]="item.event.issueUrl" target="_blank" rel="noopener noreferrer">
                <b>{{item.event.issueKey}}</b> {{item.event.issueSummary}}
              </a>
              <div class="activity-meta">
                <span class="action-badge">ACTION: {{item.event.action}}</span>
                <span class="status-badge" [style.--ticket-status-color]="statusFor(item.event).cssColor">STATUS: {{statusFor(item.event).label}}</span>
                <time [dateTime]="item.event.occurredAt" [title]="item.event.occurredAt | date:'medium'">{{relativeTime(item.event.occurredAt)}}</time>
                <em *ngIf="item.groupedEventCount > 1">{{item.groupedEventCount}} grouped events</em>
              </div>
            </ng-container>
            <ng-template #selectedIdle>
              <strong class="idle-copy">Cannot access JIRA Status</strong>
            </ng-template>
          </div>
        </ng-container>

        <ng-template #overviewPanel>
          <div class="activity-portrait activity-crest">✦</div>
          <div class="activity-copy">
            <div class="activity-heading"><span>PARTY OVERVIEW</span><small>SHARED JIRA EVENT STREAM</small></div>
            <strong class="idle-copy">{{profileActivityAvailable ? 'Per-character Jira activity is available.' : (snapshot.connection.message || 'The party is idle. New mapped activity will enter the spectator queue.')}}</strong>
          </div>
        </ng-template>

        <div class="spectator-controls">
          <span>{{!presentation.autoEnabled ? 'SPECTATOR OFF' : (presentation.paused ? 'PAUSED · ' + presentation.pending + ' PENDING' : 'PLAYING · RANDOM JIRA')}}</span>
          <button type="button" (click)="showPartyOverview()">PARTY OVERVIEW</button>
          <button type="button" (click)="toggleJiraProfile()" [disabled]="!activeProfile" [attr.aria-expanded]="profileOpen">JIRA PROFILE</button>
          <button type="button" class="play-control" (click)="play()" [disabled]="!presentation.autoEnabled||!presentation.paused" [attr.aria-pressed]="presentation.autoEnabled&&!presentation.paused">▶ PLAY</button>
          <button type="button" (click)="pause()" [disabled]="!presentation.autoEnabled||presentation.paused" [attr.aria-pressed]="presentation.paused">Ⅱ PAUSE</button>
          <button type="button" (click)="next()">NEXT →</button>
        </div>
      </section>

      <aside class="jira-profile-drawer" *ngIf="profileOpen&&activeProfile as character" aria-live="polite">
        <header><div><small>EMPLOYEE JIRA PROFILE</small><h2>{{character.displayName}}</h2></div><button type="button" aria-label="Close Jira profile" (click)="profileOpen=false">×</button></header>
        <p class="jira-profile-link-state">{{character.jiraActivityUrl?'ACTIVITY STREAM LINKED':'ACTIVITY STREAM NOT CONFIGURED'}}</p>
        <p *ngIf="profileLoading">FETCHING PERSONAL ACTIVITY…</p>
        <ng-container *ngIf="!profileLoading&&profileActivity as activity">
          <p class="jira-profile-warning" *ngIf="activity.stale">STALE CACHE · {{activity.message}}</p>
          <p class="jira-profile-warning" *ngIf="!activity.available">{{activityReason(activity)}}</p>
          <div class="jira-profile-summary" *ngIf="activity.available"><b>{{activity.activity_count||0}}</b><span>ACTIVITIES</span><b>{{formatLoggedTime(activity.logged_total_seconds||0)}}</b><span>TIME LOGGED</span></div>
          <div class="jira-profile-rollups" *ngIf="activity.logged_by_issue?.length">
            <a *ngFor="let rollup of activity.logged_by_issue" [href]="rollup.issue_url||null" target="_blank" rel="noopener noreferrer"><b>{{rollup.issue_key}}</b><span>{{rollup.display}}</span></a>
          </div>
          <section *ngFor="let day of activity.days">
            <h3>{{day.label}}</h3>
            <a *ngFor="let entry of day.entries" [href]="entry.issue_url||null" target="_blank" rel="noopener noreferrer">
              <time>{{entry.time}}</time><em>{{entry.badge}}</em><span><b>{{entry.issue_key}}</b> {{entry.issue_summary}}</span>
            </a>
          </section>
        </ng-container>
      </aside>
    </main>
  `
})
export class GameViewComponent implements AfterViewInit,OnDestroy{
  @ViewChild('gameHost',{static:true})private gameHost!:ElementRef<HTMLElement>;
  protected readonly jira=inject(JiraStoreService);
  protected readonly runtime=inject(GameRuntimeService);
  private readonly configService=inject(GameConfigService);
  private readonly behavior=inject(GameBehaviorService);
  private readonly director=inject(SpectatorDirectorService);
  private readonly userJira=inject(UserJiraService);
  private readonly subscriptions=new Subscription();
  private baseDirectives:CharacterDirective[]=[];
  private issues:JiraIssueSnapshot[]=[];
  private statusMappings:StatusBehaviorMapping[]=[];
  protected enabledProfiles:GameProfile[]=[];
  protected settings:GameSettings=defaultGameSettings();
  protected snapshot:JiraSnapshot=emptyJiraSnapshot();
  protected presentation:SpectatorState={active:null,focusCharacterId:null,autoEnabled:true,paused:false,pending:0};
  protected activeProfile:GameProfile|null=null;
  protected fullscreen=false;
  protected profileOpen=false;
  protected profileLoading=false;
  protected profileActivity:EmployeeJiraActivity|null=null;
  protected profileActivityAvailable=false;

  ngAfterViewInit():void{
    document.addEventListener('fullscreenchange',this.handleFullscreen);
    this.subscriptions.add(combineLatest([this.configService.config$,this.jira.snapshot$,this.userJira.profileEvents$]).subscribe(([config,snapshot,profileEvents])=>{
      this.snapshot=snapshot;
      this.settings=config.settings;
      this.statusMappings=config.statusMappings;
      this.enabledProfiles=config.profiles.filter(profile=>profile.enabled);
      this.userJira.watchProfileActivity(this.enabledProfiles,config.settings.refreshIntervalSeconds);
      this.profileActivityAvailable=Object.values(profileEvents).some(events=>events.length>0);
      this.issues=snapshot.issues;
      this.runtime.configure(config.settings);
      if(!this.runtime.running())this.runtime.start(this.gameHost.nativeElement,this.enabledProfiles);
      this.director.configure(config.settings.spectatorEnabled,config.settings.rotationIntervalSeconds);
      const result=this.behavior.derive(snapshot,this.enabledProfiles,this.statusMappings,this.settings,profileEvents);
      this.baseDirectives=result.directives;
      if(result.spectatorItems.length)this.director.ingest(result.spectatorItems);
      else this.director.clearActivity();
      this.renderPresentation();
    }));
    this.subscriptions.add(this.director.state$.subscribe(state=>{
      this.presentation=state;
      const nextProfile=this.enabledProfiles.find(profile=>profile.characterId===state.focusCharacterId)??null;
      if(nextProfile?.characterId!==this.activeProfile?.characterId){
        this.activeProfile=nextProfile;this.profileActivity=null;
        if(this.profileOpen)this.loadJiraProfile();
      }else this.activeProfile=nextProfile;
      this.renderPresentation();
    }));
    this.subscriptions.add(this.runtime.selection$.subscribe(characterId=>this.director.manualFocus(characterId)));
  }

  protected play():void{this.director.play()}
  protected pause():void{this.director.pause()}
  protected next():void{this.director.next()}
  protected selectCharacter(characterId:string):void{this.director.manualFocus(characterId)}
  protected showPartyOverview():void{this.profileOpen=false;this.director.showOverview()}
  protected toggleJiraProfile():void{
    if(!this.activeProfile)return;
    this.profileOpen=!this.profileOpen;
    if(this.profileOpen&&!this.profileActivity)this.loadJiraProfile();
  }
  protected activityReason(activity:EmployeeJiraActivity):string{
    if(activity.message)return activity.message;
    if(activity.reason==='not_configured')return'This character has no Jira Activity URL. Add it in Characters.';
    if(activity.reason==='no_jira_account')return'Connect your Jira account in Settings → Jira Integration.';
    if(activity.reason==='credentials_invalid')return'Your Jira login can no longer be read. Reconnect in Settings.';
    return'Jira activity is unavailable.';
  }
  protected formatLoggedTime(seconds:number):string{
    const hours=Math.floor(seconds/3600);const minutes=Math.floor((seconds%3600)/60);
    return hours?`${hours}h ${String(minutes).padStart(2,'0')}m`:`${minutes}m`;
  }
  protected toggleFullscreen():void{
    if(document.fullscreenElement)void document.exitFullscreen();
    else void this.gameHost.nativeElement.closest('.game-view')?.requestFullscreen().catch(()=>undefined);
  }

  protected dialogueWorkFor(event:JiraActivityEvent):string{
    return jiraWorkPresentation(event,this.issues.find(issue=>issue.issueKey===event.issueKey)??null).work;
  }

  protected statusFor(event:JiraActivityEvent){
    const issue=this.issues.find(candidate=>candidate.issueKey===event.issueKey);
    return jiraStatusPresentation(event.currentStatus??event.newStatus??issue?.status);
  }

  protected relativeTime(value:string):string{
    return jiraRelativeTime(value);
  }

  ngOnDestroy():void{
    document.removeEventListener('fullscreenchange',this.handleFullscreen);
    this.subscriptions.unsubscribe();this.director.stop();this.runtime.stop();
  }

  private readonly handleFullscreen=():void=>{this.fullscreen=Boolean(document.fullscreenElement)};

  private loadJiraProfile():void{
    if(!this.activeProfile)return;
    this.profileLoading=true;
    this.userJira.activity(this.activeProfile.characterId).subscribe({
      next:value=>{this.profileActivity=value;this.profileLoading=false},
      error:response=>{this.profileActivity={available:false,reason:'fetch_failed',message:response.error?.detail||'Could not load Jira activity.'};this.profileLoading=false}
    });
  }

  private renderPresentation():void{
    const active=this.presentation.active?this.behavior.directiveFor(this.presentation.active,this.issues,this.statusMappings):null;
    const directives=this.behavior.singleSpeakerDirectives(this.baseDirectives,active);
    this.runtime.applyDirectives(directives);
    this.runtime.focusCharacter(this.presentation.focusCharacterId);
  }
}
