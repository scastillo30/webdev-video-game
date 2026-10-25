import {DatePipe, NgIf} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {JiraConnection, JiraSnapshot} from '../../core/jira/jira.models';

interface JiraDiagnostics {
  startedAt:string;
  pollIntervalSeconds:number;
  pollCount:number;
  successfulPolls:number;
  failedPolls:number;
  skippedPolls:number;
  lastPollDurationMs:number;
  subscriberCount:number;
}

interface AuditEntry {
  id:number;
  requestId:string;
  action:string;
  method:string;
  path:string;
  statusCode:number;
  durationMs:number;
  occurredAt:string;
}

interface OperationsStatus {
  status:'ok'|'degraded';
  serverStartedAt:string;
  uptimeSeconds:number;
  jira:JiraDiagnostics;
  connection:JiraConnection;
  issueCount:number;
  eventCount:number;
  database:string;
  build:{version:string;commit:string;builtAt:string;target:string};
  targetFps:number;
  tvModeEnabled:boolean;
  recentAudit:AuditEntry[];
}

@Component({
  standalone:true,
  imports:[DatePipe,NgIf],
  template:`
    <main class="operations-page">
      <header class="operations-heading">
        <div><p>PHASE 15 · OPERATIONAL AUDIT</p><h1>Castle Systems Console</h1><span>Credential-safe runtime telemetry and administrative request correlation.</span></div>
        <div class="operations-actions">
          <button type="button" (click)="load()" [disabled]="loading">{{loading?'CHECKING…':'REFRESH STATUS'}}</button>
          <button type="button" class="primary" (click)="refreshJira()" [disabled]="refreshing">{{refreshing?'REFRESHING…':'REFRESH JIRA NOW'}}</button>
          <a href="/diagnostics/soak.html" target="_blank" rel="noopener">OPEN TV SOAK RUNNER ↗</a>
        </div>
      </header>

      <p *ngIf="error" class="operations-alert">{{error}}</p>
      <section *ngIf="status as current" class="operations-grid" [attr.data-health]="current.status">
        <article class="operations-card hero-card">
          <small>OVERALL READINESS</small><strong>{{current.status}}</strong>
          <span>{{current.status==='ok'?'Core services are responding.':'Jira is configured but not currently live.'}}</span>
          <i aria-hidden="true"></i>
        </article>
        <article class="operations-card">
          <small>GO + SQLITE</small><strong>{{formatUptime(current.uptimeSeconds)}}</strong>
          <dl><div><dt>Version</dt><dd>{{current.build.version}}</dd></div><div><dt>Commit</dt><dd>{{shortCommit(current.build.commit)}}</dd></div><div><dt>Target</dt><dd>{{current.build.target}}</dd></div><div><dt>Database</dt><dd>{{current.database}}</dd></div><div><dt>Started</dt><dd>{{current.serverStartedAt|date:'medium'}}</dd></div><div><dt>Target frame rate</dt><dd>{{current.targetFps}} FPS</dd></div><div><dt>TV mode</dt><dd>{{current.tvModeEnabled?'Enabled':'Disabled'}}</dd></div></dl>
        </article>
        <article class="operations-card">
          <small>JIRA CONNECTION</small><strong>{{current.connection.state}}</strong>
          <dl><div><dt>Configured</dt><dd>{{current.connection.configured?'Yes':'No'}}</dd></div><div><dt>Last success</dt><dd>{{current.connection.lastSuccessAt?(current.connection.lastSuccessAt|date:'medium'):'Never'}}</dd></div><div><dt>Stream clients</dt><dd>{{current.jira.subscriberCount}}</dd></div></dl>
        </article>
        <article class="operations-card">
          <small>INGESTION</small><strong>{{current.issueCount}} issues</strong>
          <dl><div><dt>Activity events</dt><dd>{{current.eventCount}}</dd></div><div><dt>Poll cadence</dt><dd>{{current.jira.pollIntervalSeconds}} seconds</dd></div><div><dt>Last poll</dt><dd>{{current.jira.lastPollDurationMs}} ms</dd></div></dl>
        </article>
        <article class="operations-card wide-card">
          <small>POLLER TELEMETRY</small>
          <div class="operations-metrics"><span><b>{{current.jira.pollCount}}</b>Total polls</span><span><b>{{current.jira.successfulPolls}}</b>Successful</span><span><b>{{current.jira.failedPolls}}</b>Failed</span><span><b>{{current.jira.skippedPolls}}</b>Not configured</span></div>
          <p>{{current.connection.message}}</p>
        </article>
        <article class="operations-card wide-card runbook-card">
          <small>PHASE 9 · RELEASE SOAK</small><strong>Run on the target television host</strong>
          <p>The soak runner can hold Game View steady or cycle Game → Office → Game while checking that exactly one Phaser canvas is mounted, route teardown releases it, the API remains responsive, and browser heap does not trend upward unexpectedly.</p>
          <a href="/diagnostics/soak.html?auto=1" target="_blank" rel="noopener">START FOUR-HOUR SOAK ↗</a>
        </article>
        <article class="operations-card wide-card audit-card">
          <small>RECENT ADMINISTRATIVE ACTIVITY</small><strong>{{current.recentAudit.length}} recorded mutations</strong>
          <p *ngIf="!current.recentAudit.length">No administrative mutations have been recorded since this database was created.</p>
          <div *ngIf="current.recentAudit.length" class="audit-list" role="list" aria-label="Recent administrative activity">
            @for (entry of current.recentAudit; track entry.id) {
              <div role="listitem" class="audit-row">
                <span class="audit-action">{{entry.action}}</span>
                <span>{{entry.method}} · {{entry.path}}</span>
                <span [class.audit-success]="entry.statusCode<400" [class.audit-failure]="entry.statusCode>=400">HTTP {{entry.statusCode}}</span>
                <span>{{entry.durationMs}} ms</span>
                <time [attr.datetime]="entry.occurredAt">{{entry.occurredAt|date:'medium'}}</time>
                <code title="Request correlation ID">{{shortRequest(entry.requestId)}}</code>
              </div>
            }
          </div>
        </article>
        <article class="operations-card wide-card retention-card">
          <small>PHASE 16 · DATA RETENTION</small><strong>Preview, back up, then prune</strong>
          <p>Retention maintenance removes only expired Jira activity events and administrative audit rows. Current issue snapshots, characters, mappings, and game configuration remain untouched.</p>
          <code>webdev-admin prune --db data/game.db --event-days 180 --audit-days 365</code>
        </article>
      </section>
    </main>
  `
})
export class OperationsComponent implements OnInit,OnDestroy {
  private readonly http=inject(HttpClient);
  private timer:number|undefined;
  protected status:OperationsStatus|null=null;
  protected loading=false;
  protected refreshing=false;
  protected error='';

  ngOnInit():void{this.load();this.timer=window.setInterval(()=>this.load(false),10000)}
  ngOnDestroy():void{if(this.timer!==undefined)window.clearInterval(this.timer)}

  protected load(showLoading=true):void{
    if(showLoading)this.loading=true;
    this.http.get<OperationsStatus>('/api/operations/status').subscribe({
      next:value=>{this.status=value;this.loading=false;this.error=''},
      error:()=>{this.loading=false;this.error='Operations API unavailable. Confirm that the Go service is running.'}
    });
  }

  protected refreshJira():void{
    if(this.refreshing)return;
    this.refreshing=true;this.error='';
    this.http.post<JiraSnapshot>('/api/jira/refresh',{}).subscribe({
      next:()=>{this.refreshing=false;this.load()},
      error:()=>{this.refreshing=false;this.error='Manual Jira refresh failed. Check the connection message and server logs.'}
    });
  }

  protected formatUptime(seconds:number):string{
    const days=Math.floor(seconds/86400);
    const hours=Math.floor((seconds%86400)/3600);
    const minutes=Math.floor((seconds%3600)/60);
    return days?`${days}d ${hours}h`:hours?`${hours}h ${minutes}m`:`${minutes}m`;
  }

  protected shortCommit(commit:string):string{return commit==='unknown'?commit:commit.slice(0,12)}
  protected shortRequest(requestId:string):string{return requestId.slice(0,12)}
}
