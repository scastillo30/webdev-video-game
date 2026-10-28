import {JiraActivityEvent, JiraIssueSnapshot} from './jira.models';

export interface JiraStatusPresentation {
  label: string;
  color: number;
  cssColor: string;
}

export interface JiraWorkPresentation {
  text: string;
  status: JiraStatusPresentation;
}

export const JIRA_UNAVAILABLE_MESSAGE='Cannot access JIRA Status';

const palette={
  complete:{color:0x62dfb8,cssColor:'#62dfb8'},
  blocked:{color:0xff7d96,cssColor:'#ff7d96'},
  review:{color:0xd6a5ff,cssColor:'#d6a5ff'},
  active:{color:0x69d5ff,cssColor:'#69d5ff'},
  waiting:{color:0xf3cb77,cssColor:'#f3cb77'},
  pending:{color:0xf3a3df,cssColor:'#f3a3df'},
  neutral:{color:0x8ee9ff,cssColor:'#8ee9ff'}
} as const;

export function jiraStatusPresentation(status:string|null|undefined):JiraStatusPresentation{
  const label=status?.trim()||'PENDING SYNC';
  const normalized=label.toLowerCase();
  let tone:typeof palette[keyof typeof palette];
  if(/done|closed|resolved|complete|deployed|released/.test(normalized))tone=palette.complete;
  else if(/blocked|impediment|failed|cancelled|canceled/.test(normalized))tone=palette.blocked;
  else if(/review|approval|testing|quality|\bqa\b/.test(normalized))tone=palette.review;
  else if(/progress|doing|active|development|implement/.test(normalized))tone=palette.active;
  else if(/to do|todo|open|backlog|selected|waiting|ready/.test(normalized))tone=palette.waiting;
  else if(/pending sync|unknown|unavailable/.test(normalized))tone=palette.pending;
  else tone=palette.neutral;
  return{label:label.toUpperCase(),...tone};
}

export function jiraRelativeTime(value:string,now=Date.now()):string{
  const elapsed=now-Date.parse(value);
  if(!Number.isFinite(elapsed))return'recently';
  const minutes=Math.max(0,Math.floor(elapsed/60_000));
  if(minutes<1)return'just now';
  if(minutes<60)return`${minutes} ${minutes===1?'minute':'minutes'} ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return`${hours} ${hours===1?'hour':'hours'} ago`;
  const days=Math.floor(hours/24);
  return`${days} ${days===1?'day':'days'} ago`;
}

export function jiraWorkPresentation(event:JiraActivityEvent,issue:JiraIssueSnapshot|null=null,now=Date.now()):JiraWorkPresentation{
  const action=event.action.trim().toUpperCase();
  const when=jiraRelativeTime(event.occurredAt,now);
  let work:string;
  if(action==='MOVED'&&event.previousStatus&&event.newStatus)work=`I moved ${event.issueKey} from ${event.previousStatus} to ${event.newStatus}`;
  else if(/CLOSED|RESOLVED|COMPLETED|DONE/.test(action))work=`I completed ${event.issueKey}`;
  else if(/COMMENT|DISCUS/.test(action))work=`I shared an update on ${event.issueKey}`;
  else if(/CREATED|OPENED/.test(action))work=`I created ${event.issueKey}`;
  else if(/REVIEW|APPROV/.test(action))work=`I reviewed ${event.issueKey}`;
  else if(action==='UPDATED'||action==='EDITED')work=`I have updated ${event.issueKey}`;
  else work=`I worked on ${event.issueKey}`;
  const currentStatus=event.currentStatus??event.newStatus??issue?.status;
  return{text:`${work} ${when}!`,status:jiraStatusPresentation(currentStatus)};
}

export function jiraAssignedWorkPresentation(issue:JiraIssueSnapshot,now=Date.now()):JiraWorkPresentation{
  return{
    text:`I am working on ${issue.issueKey}; it was updated ${jiraRelativeTime(issue.updatedAt,now)}!`,
    status:jiraStatusPresentation(issue.status)
  };
}
