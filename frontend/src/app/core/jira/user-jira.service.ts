import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {BehaviorSubject, Observable, catchError, finalize, forkJoin, map, of, tap} from 'rxjs';
import {JiraActivityEvent} from './jira.models';
import {EmployeeJiraActivity,JiraActivityProfile,ProfileJiraEvents,employeeJiraEvents} from './profile-activity-events';

export type {EmployeeJiraActivity,JiraActivityDay,JiraActivityEntry,JiraActivityProfile,JiraWorklogRollup,ProfileJiraEvents} from './profile-activity-events';

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

@Injectable({providedIn:'root'})
export class UserJiraService {
  private readonly http=inject(HttpClient);
  private readonly statusSubject=new BehaviorSubject<JiraCredentialStatus|null>(null);
  private readonly profileEventsSubject=new BehaviorSubject<ProfileJiraEvents>({});
  private watchedProfiles:JiraActivityProfile[]=[];
  private watchedSignature='';
  private refreshTimer:number|null=null;
  private profileRequestActive=false;
  private lastProfileLoadAt=0;
  readonly status$=this.statusSubject.asObservable();
  readonly profileEvents$=this.profileEventsSubject.asObservable();

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

  watchProfileActivity(profiles:JiraActivityProfile[],refreshIntervalSeconds=60):void{
    const eligible=profiles.filter(profile=>Boolean(profile.jiraActivityUrl));
    const intervalSeconds=Math.max(15,refreshIntervalSeconds);
    const signature=JSON.stringify({intervalSeconds,profiles:eligible.map(profile=>[profile.characterId,profile.displayName,profile.jiraAccountId,profile.jiraActivityUrl])});
    if(signature!==this.watchedSignature){
      this.watchedSignature=signature;this.watchedProfiles=eligible;this.profileEventsSubject.next({});this.lastProfileLoadAt=0;
      if(this.refreshTimer!==null)window.clearInterval(this.refreshTimer);
      this.refreshTimer=eligible.length?window.setInterval(()=>this.loadProfileActivity(),intervalSeconds*1000):null;
    }
    if(Date.now()-this.lastProfileLoadAt>5_000)this.loadProfileActivity();
  }

  refreshProfileActivity():void{this.lastProfileLoadAt=0;this.loadProfileActivity()}

  private loadProfileActivity():void{
    if(this.profileRequestActive)return;
    if(!this.watchedProfiles.length){this.profileEventsSubject.next({});this.lastProfileLoadAt=Date.now();return}
    this.profileRequestActive=true;
    const profiles=[...this.watchedProfiles];
    forkJoin(profiles.map(profile=>this.activity(profile.characterId).pipe(
      map(activity=>employeeJiraEvents(profile,activity)),catchError(()=>of([] as JiraActivityEvent[]))
    ))).pipe(finalize(()=>this.profileRequestActive=false)).subscribe(results=>{
      this.lastProfileLoadAt=Date.now();
      this.profileEventsSubject.next(Object.fromEntries(profiles.map((profile,index)=>[profile.characterId,results[index]])));
    });
  }
}
