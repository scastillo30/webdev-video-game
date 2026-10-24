import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject} from '@angular/core';
import {Subscription} from 'rxjs';
import {JiraStoreService} from '../../core/jira/jira-store.service';
import {JiraSnapshot} from '../../core/jira/jira.models';

@Component({
  selector: 'app-office-view',
  standalone: true,
  template: `<main class="office-view"><iframe #officeFrame src="/legacy-game/index.html?offline=1&gameBuild=11&parentJira=1" title="WEBDEV MMORPG Office View" (load)="sendLatest()"></iframe></main>`
})
export class OfficeViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('officeFrame') private frame?: ElementRef<HTMLIFrameElement>;
  private readonly jira = inject(JiraStoreService);
  private subscription?: Subscription;
  private latest?: JiraSnapshot;

  ngAfterViewInit(): void {
    this.subscription = this.jira.snapshot$.subscribe(snapshot => {
      this.latest = snapshot;
      this.sendLatest();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  protected sendLatest(): void {
    if (!this.latest || !this.frame?.nativeElement.contentWindow) return;
    const events = this.latest.events.map(event => ({
      eventId: event.eventId,
      authorId: event.authorId,
      authorName: event.authorName,
      assigneeId: event.assigneeId,
      assigneeName: event.assigneeName,
      ticketKey: event.issueKey,
      ticketTitle: event.issueSummary,
      ticketUrl: event.issueUrl,
      action: event.action,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      currentStatus: event.currentStatus,
      timestamp: event.occurredAt
    }));
    this.frame.nativeElement.contentWindow.postMessage({type: 'webdev:jira-state:v1', payload: {connection: this.latest.connection, events}}, location.origin);
  }
}
