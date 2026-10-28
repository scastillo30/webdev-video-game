import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject} from '@angular/core';
import {combineLatest,Subscription} from 'rxjs';
import {JiraStoreService} from '../../core/jira/jira-store.service';
import {UserJiraService} from '../../core/jira/user-jira.service';
import {GameConfigService} from '../game/services/game-config.service';
import {OfficeJiraBridgePayload,officeJiraBridgePayload} from './office-jira-bridge';

@Component({
  selector: 'app-office-view',
  standalone: true,
  template: `<main class="office-view"><iframe #officeFrame src="/legacy-game/index.html?offline=1&gameBuild=14&parentJira=1" title="WEBDEV MMORPG Office View" (load)="sendLatest()"></iframe></main>`
})
export class OfficeViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('officeFrame') private frame?: ElementRef<HTMLIFrameElement>;
  private readonly jira = inject(JiraStoreService);
  private readonly userJira = inject(UserJiraService);
  private readonly config = inject(GameConfigService);
  private subscription?: Subscription;
  private latest?: OfficeJiraBridgePayload;

  ngAfterViewInit(): void {
    this.subscription = combineLatest([this.jira.snapshot$,this.config.config$,this.userJira.profileEvents$]).subscribe(([snapshot,config,profileEvents]) => {
      this.userJira.watchProfileActivity(config.profiles.filter(profile=>profile.enabled),config.settings.refreshIntervalSeconds);
      this.latest = officeJiraBridgePayload(snapshot,config,profileEvents);
      this.sendLatest();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  protected sendLatest(): void {
    if (!this.latest || !this.frame?.nativeElement.contentWindow) return;
    this.frame.nativeElement.contentWindow.postMessage({type:'webdev:jira-state:v1',payload:this.latest},location.origin);
  }
}
