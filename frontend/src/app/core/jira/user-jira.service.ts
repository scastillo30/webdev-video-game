import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {BehaviorSubject, Observable, tap} from 'rxjs';

export interface JiraCredentialStatus {
  connected:boolean;
  invalid:boolean;
  host:string;
  username:string|null;
  expires_at:string|null;
}

export interface JiraTestResult {success:boolean;message:string}

export interface JiraUserConnection {
  configured:'none'|'invalid'|'present';
  host:string;
  last_sync_at:string|null;
}

export interface JiraActivityEntry {
  id:string;time:string;badge:string;issue_key:string;issue_summary:string;issue_url:string;
  title_html:string;content_html:string|null;categories:string[];logged_seconds:number;
}

export interface JiraActivityDay {date:string;label:string;entries:JiraActivityEntry[]}
export interface JiraWorklogRollup {issue_key:string;issue_url:string;seconds:number;display:string}

export interface EmployeeJiraActivity {
  available:boolean;reason?:string;message?:string;activity_count?:number;updated?:string;
  days?:JiraActivityDay[];logged_by_issue?:JiraWorklogRollup[];logged_total_seconds?:number;stale?:boolean;
}

@Injectable({providedIn:'root'})
export class UserJiraService {
  private readonly http=inject(HttpClient);
  private readonly statusSubject=new BehaviorSubject<JiraCredentialStatus|null>(null);
  readonly status$=this.statusSubject.asObservable();

  loadStatus():void{
    this.http.get<JiraCredentialStatus>('/api/jira/credential').subscribe({next:value=>this.statusSubject.next(value)});
  }

  test(server:string,username:string,password:string):Observable<JiraTestResult>{
    return this.http.post<JiraTestResult>('/api/jira/test-connection',{server,username,password});
  }

  save(server:string,username:string,password:string):Observable<JiraCredentialStatus>{
    return this.http.put<JiraCredentialStatus>('/api/jira/credential',{server,username,password}).pipe(tap(value=>this.statusSubject.next(value)));
  }

  disconnect():Observable<JiraCredentialStatus>{
    return this.http.delete<JiraCredentialStatus>('/api/jira/credential').pipe(tap(value=>this.statusSubject.next(value)));
  }

  activity(characterId:string,limit=50):Observable<EmployeeJiraActivity>{
    return this.http.get<EmployeeJiraActivity>(`/api/employees/${encodeURIComponent(characterId)}/activity`,{params:{limit}});
  }

  refreshProfiles():void{
    this.http.post('/api/employees/activity/refresh',{}).subscribe({error:()=>undefined});
  }
}
