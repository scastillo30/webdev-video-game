import {JiraActivityEvent, JiraConnection, JiraIssueSnapshot, JiraSnapshot} from '../../core/jira/jira.models';
import {jiraAssignedWorkPresentation,jiraWorkPresentation} from '../../core/jira/jira-work-presentation';
import {GameConfig,GameProfile} from '../game/engine/game.models';

export interface OfficeJiraEvent {
  eventId:string;authorId:string|null;authorName:string|null;assigneeId:string|null;assigneeName:string|null;
  ticketKey:string;ticketTitle:string;ticketUrl:string;action:string;previousStatus:string|null;newStatus:string|null;
  currentStatus:string|null;timestamp:string;narration:string;statusColor:string;
}

export interface OfficeJiraBridgePayload {
  connection:JiraConnection;
  events:OfficeJiraEvent[];
  userCharacterMap:Record<string,string>;
  workByCharacter:Record<string,OfficeJiraEvent>;
}

const allowedIssue=(issue:JiraIssueSnapshot,config:GameConfig):boolean=>{
  const projectAllowed=!config.settings.jiraProjects.length||config.settings.jiraProjects.includes(issue.projectKey.toUpperCase());
  const typeAllowed=!config.settings.jiraIssueTypes.length||config.settings.jiraIssueTypes.some(type=>type.localeCompare(issue.issueType,undefined,{sensitivity:'accent'})===0);
  return projectAllowed&&typeAllowed;
};

const eventPayload=(event:JiraActivityEvent,issue:JiraIssueSnapshot|null):OfficeJiraEvent=>{
  const presentation=jiraWorkPresentation(event,issue);
  return{eventId:event.eventId,authorId:event.authorId,authorName:event.authorName,assigneeId:event.assigneeId,assigneeName:event.assigneeName,
    ticketKey:event.issueKey,ticketTitle:event.issueSummary,ticketUrl:event.issueUrl,action:event.action,previousStatus:event.previousStatus,
    newStatus:event.newStatus,currentStatus:event.currentStatus??event.newStatus??issue?.status??null,timestamp:event.occurredAt,
    narration:presentation.text,statusColor:presentation.status.cssColor};
};

const assignedIssuePayload=(profile:GameProfile,issue:JiraIssueSnapshot):OfficeJiraEvent=>{
  const presentation=jiraAssignedWorkPresentation(issue);
  return{eventId:`issue:${issue.issueKey}:${issue.updatedAt}`,authorId:profile.jiraAccountId,authorName:profile.displayName,
    assigneeId:issue.assigneeId,assigneeName:issue.assigneeName,ticketKey:issue.issueKey,ticketTitle:issue.summary,ticketUrl:issue.issueUrl,
    action:'WORKING',previousStatus:null,newStatus:null,currentStatus:issue.status,timestamp:issue.updatedAt,
    narration:presentation.text,statusColor:presentation.status.cssColor};
};

export function officeJiraBridgePayload(snapshot:JiraSnapshot,config:GameConfig,profileEvents:Readonly<Record<string,JiraActivityEvent[]>>={}):OfficeJiraBridgePayload{
  const profiles=config.profiles.filter(profile=>profile.enabled);
  const userCharacterMap=Object.fromEntries(profiles.map(profile=>[profile.jiraAccountId||`character:${profile.characterId}`,profile.characterId]));
  const sharedLive=snapshot.connection.configured&&snapshot.connection.state==='live';
  const issues=sharedLive?snapshot.issues.filter(issue=>allowedIssue(issue,config)):[];
  const issuesByKey=new Map(issues.map(issue=>[issue.issueKey,issue]));
  const allowedKeys=new Set(issuesByKey.keys());
  const sharedEvents=sharedLive?snapshot.events.filter(event=>allowedKeys.has(event.issueKey)).map(event=>eventPayload(event,issuesByKey.get(event.issueKey)??null)):[];
  const personalEvents=profiles.flatMap(profile=>(profileEvents[profile.characterId]??[]).map(event=>eventPayload(event,null)));
  const events=[...new Map([...sharedEvents,...personalEvents].map(event=>[event.eventId,event])).values()]
    .sort((left,right)=>Date.parse(right.timestamp)-Date.parse(left.timestamp));
  const workByCharacter:Record<string,OfficeJiraEvent>={};
  for(const profile of profiles){
    const authorId=profile.jiraAccountId||`character:${profile.characterId}`;
    const authored=events.filter(event=>event.authorId===authorId).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0];
    const assigned=profile.jiraAccountId?issues.filter(issue=>issue.assigneeId===profile.jiraAccountId).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0]:undefined;
    if(authored&&(!assigned||Date.parse(authored.timestamp)>=Date.parse(assigned.updatedAt)))workByCharacter[profile.characterId]=authored;
    else if(assigned)workByCharacter[profile.characterId]=assignedIssuePayload(profile,assigned);
  }
  const latestPersonal=[...personalEvents].sort((left,right)=>Date.parse(right.timestamp)-Date.parse(left.timestamp))[0];
  const connection:JiraConnection=sharedLive||!latestPersonal?snapshot.connection:{configured:true,state:'live',lastAttemptAt:latestPersonal.timestamp,lastSuccessAt:latestPersonal.timestamp,message:'Per-character Jira activity connected'};
  return{connection,events,userCharacterMap,workByCharacter};
}
