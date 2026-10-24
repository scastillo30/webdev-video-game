import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, distinctUntilChanged, map} from 'rxjs';
import {emptyJiraSnapshot, JiraActivityEvent, JiraConnection, JiraSnapshot} from './jira.models';

@Injectable({providedIn: 'root'})
export class JiraStoreService {
  private readonly http = inject(HttpClient);
  private readonly state = new BehaviorSubject<JiraSnapshot>(emptyJiraSnapshot());
  private stream: EventSource | null = null;

  readonly snapshot$ = this.state.asObservable();
  readonly connection$ = this.snapshot$.pipe(map(snapshot => snapshot.connection), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)));
  readonly issues$ = this.snapshot$.pipe(map(snapshot => snapshot.issues));
  readonly events$ = this.snapshot$.pipe(map(snapshot => snapshot.events));

  constructor() {
    this.loadSnapshot();
    this.connect();
  }

  private loadSnapshot(): void {
    this.http.get<JiraSnapshot>('/api/jira/snapshot').subscribe({
      next: snapshot => this.replace(snapshot),
      error: () => this.updateConnection({state: 'disconnected', configured: false, lastAttemptAt: null, lastSuccessAt: null, message: 'Go Jira API unavailable'})
    });
  }

  private connect(): void {
    if (this.stream || typeof EventSource === 'undefined') return;
    this.stream = new EventSource('/api/jira/events');
    this.stream.addEventListener('snapshot', event => this.replace(this.parse<JiraSnapshot>(event)));
    this.stream.addEventListener('activity', event => this.addEvent(this.parse<JiraActivityEvent>(event)));
    this.stream.addEventListener('connection', event => this.updateConnection(this.parse<JiraConnection>(event)));
    this.stream.onerror = () => {
      const current = this.state.value.connection;
      this.updateConnection({...current, state: current.lastSuccessAt ? 'reconnecting' : 'disconnected', message: 'Reconnecting to shared Jira stream'});
    };
  }

  private parse<T>(event: Event): T {
    return JSON.parse((event as MessageEvent<string>).data) as T;
  }

  private replace(snapshot: JiraSnapshot): void {
    this.state.next({
      issues: Array.isArray(snapshot.issues) ? snapshot.issues : [],
      events: Array.isArray(snapshot.events) ? snapshot.events : [],
      connection: snapshot.connection || emptyJiraSnapshot().connection
    });
  }

  private addEvent(event: JiraActivityEvent): void {
    const current = this.state.value;
    if (current.events.some(existing => existing.eventId === event.eventId)) return;
    this.state.next({...current, events: [event, ...current.events].slice(0, 100)});
  }

  private updateConnection(connection: JiraConnection): void {
    this.state.next({...this.state.value, connection});
  }
}
