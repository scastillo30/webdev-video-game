import {AsyncPipe, DatePipe, NgIf} from '@angular/common';
import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {JiraStoreService} from '../../core/jira/jira-store.service';
import {GameRuntimeService} from './game-runtime.service';

@Component({
  selector: 'app-game-view',
  standalone: true,
  imports: [AsyncPipe, DatePipe, NgIf],
  providers: [GameRuntimeService],
  template: `
    <main class="game-view">
      <section class="game-scene-shell" aria-labelledby="gameTitle">
        <div class="scene-grid" aria-hidden="true"></div>
        <div class="scene-crest" aria-hidden="true">✦</div>
        <div class="scene-copy">
          <p>PHASE II · SHARED STREAM ONLINE</p>
          <h1 id="gameTitle">CASTLE COMMAND CENTER</h1>
          <span>The scene lifecycle and Jira event foundation are ready for the Phase III renderer.</span>
        </div>
        <div class="scene-status"><i></i>{{runtime.running() ? 'SCENE ACTIVE' : 'SCENE STOPPED'}}</div>
      </section>
      <section class="game-stream-panel" *ngIf="jira.snapshot$ | async as snapshot" aria-live="polite">
        <div class="stream-portrait">✧</div>
        <div class="stream-copy">
          <small>SHARED JIRA EVENT STREAM</small>
          <strong>{{snapshot.connection.configured ? snapshot.connection.state : 'NOT CONFIGURED'}}</strong>
          <span>{{snapshot.connection.message || 'Waiting for Jira configuration'}}</span>
        </div>
        <div class="stream-metrics"><b>{{snapshot.issues.length}}</b><span>ISSUES</span></div>
        <div class="stream-metrics"><b>{{snapshot.events.length}}</b><span>EVENTS</span></div>
        <time *ngIf="snapshot.connection.lastSuccessAt" [dateTime]="snapshot.connection.lastSuccessAt">{{snapshot.connection.lastSuccessAt | date:'short'}}</time>
      </section>
    </main>
  `
})
export class GameViewComponent implements OnInit, OnDestroy {
  protected readonly jira = inject(JiraStoreService);
  protected readonly runtime = inject(GameRuntimeService);
  ngOnInit(): void { this.runtime.start(); }
  ngOnDestroy(): void { this.runtime.stop(); }
}
