import {JiraActivityEvent} from './jira.models';

export interface JiraActivityEntry {
  id:string;occurred_at?:string;time:string;badge:string;issue_key:string;issue_summary:string;issue_url:string;
  title_html:string;content_html:string|null;categories:string[];logged_seconds:number;
}

export interface JiraActivityDay {date:string;label:string;entries:JiraActivityEntry[]}
export interface JiraWorklogRollup {issue_key:string;issue_url:string;seconds:number;display:string}

export interface EmployeeJiraActivity {
  available:boolean;reason?:string;message?:string;activity_count?:number;updated?:string;
  days?:JiraActivityDay[];logged_by_issue?:JiraWorklogRollup[];logged_total_seconds?:number;stale?:boolean;
}

export interface JiraActivityProfile {
  characterId:string;displayName:string;jiraAccountId:string|null;jiraActivityUrl:string|null;
}

export type ProfileJiraEvents=Readonly<Record<string,JiraActivityEvent[]>>;

const occurredAt=(day:JiraActivityDay,entry:JiraActivityEntry,updated?:string):string=>{
  if(entry.occurred_at&&Number.isFinite(Date.parse(entry.occurred_at)))return new Date(entry.occurred_at).toISOString();
  const local=new Date(`${day.date}T${entry.time || '00:00'}:00`);
  if(Number.isFinite(local.getTime()))return local.toISOString();
  if(updated&&Number.isFinite(Date.parse(updated)))return new Date(updated).toISOString();
  return new Date(0).toISOString();
};

const activityAction=(badge:string):string=>{
  const value=badge.trim().toLowerCase();
  if(value.includes('transition')||value.includes('moved'))return'MOVED';
  if(value.includes('comment'))return'COMMENTED';
  if(value.includes('create'))return'CREATED';
  if(value.includes('logged'))return'LOGGED WORK';
  return'UPDATED';
};

export function employeeJiraEvents(profile:JiraActivityProfile,activity:EmployeeJiraActivity):JiraActivityEvent[]{
  if(!activity.available)return[];
  const authorId=profile.jiraAccountId||`character:${profile.characterId}`;
  return(activity.days??[]).flatMap(day=>(day.entries??[]).filter(entry=>Boolean(entry.issue_key)).map(entry=>({
    eventId:`profile:${profile.characterId}:${entry.id||`${entry.issue_key}:${day.date}:${entry.time}:${entry.badge}`}`,
    issueKey:entry.issue_key,authorId,authorName:profile.displayName,assigneeId:null,assigneeName:null,
    action:activityAction(entry.badge),previousStatus:null,newStatus:null,currentStatus:null,
    occurredAt:occurredAt(day,entry,activity.updated),issueSummary:entry.issue_summary,issueUrl:entry.issue_url
  }))).sort((left,right)=>Date.parse(right.occurredAt)-Date.parse(left.occurredAt));
}
