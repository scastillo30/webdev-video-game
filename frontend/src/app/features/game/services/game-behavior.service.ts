import {Injectable} from '@angular/core';
import {JiraActivityEvent,JiraIssueSnapshot, JiraSnapshot} from '../../../core/jira/jira.models';
import {stateForStatus} from '../engine/character-state-machine';
import {chooseFeaturedIssue} from '../engine/featured-ticket';
import {CharacterDirective, CharacterState, GameBehaviorResult, GameProfile, GameSettings, SpectatorItem, StatusBehaviorMapping} from '../engine/game.models';
import {JIRA_UNAVAILABLE_MESSAGE,jiraAssignedWorkPresentation,jiraWorkPresentation} from '../../../core/jira/jira-work-presentation';

@Injectable()
export class GameBehaviorService{
  derive(snapshot:JiraSnapshot,profiles:GameProfile[],statusMappings:StatusBehaviorMapping[],settings:GameSettings):GameBehaviorResult{
    const byJiraId=this.mapping(profiles);
    const issuesByCharacter=new Map<string,JiraIssueSnapshot[]>();
    const eventsByCharacter=new Map<string,JiraActivityEvent[]>();
    const jiraConnected=snapshot.connection.configured&&snapshot.connection.state==='live';
    const allowedIssues=jiraConnected?snapshot.issues.filter(issue=>this.inScope(issue,settings)):[];
    for(const issue of allowedIssues){
      const character=issue.assigneeId?byJiraId.get(issue.assigneeId):undefined;
      if(character){
        const issues=issuesByCharacter.get(character.characterId)??[];
        issues.push(issue);issuesByCharacter.set(character.characterId,issues);
      }
    }
    const allowedKeys=new Set(allowedIssues.map(issue=>issue.issueKey));
    const allowedEvents=jiraConnected?snapshot.events.filter(event=>allowedKeys.has(event.issueKey)):[];
    for(const event of allowedEvents){
      const character=event.authorId?byJiraId.get(event.authorId):undefined;
      if(character){
        const events=eventsByCharacter.get(character.characterId)??[];
        events.push(event);eventsByCharacter.set(character.characterId,events);
      }
    }
    const directives=profiles.filter(profile=>profile.enabled).map(profile=>{
      const assignedIssue=chooseFeaturedIssue(issuesByCharacter.get(profile.characterId)??[],settings.featuredTicketRule);
      const latestEvent=[...(eventsByCharacter.get(profile.characterId)??[])].sort((left,right)=>Date.parse(right.occurredAt)-Date.parse(left.occurredAt))[0]??null;
      const useEvent=Boolean(latestEvent&&(!assignedIssue||Date.parse(latestEvent.occurredAt)>=Date.parse(assignedIssue.updatedAt)));
      const event=useEvent?latestEvent:null;
      const issue=event?allowedIssues.find(candidate=>candidate.issueKey===event.issueKey)??null:assignedIssue;
      const status=event?.currentStatus??event?.newStatus??issue?.status??'';
      const category=issue?.statusCategory??'';
      let state:CharacterState=status?this.configuredState(status,category,statusMappings):'IDLE';
      if(state==='CELEBRATING')state='IDLE';
      const presentation=event?jiraWorkPresentation(event,issue):issue?jiraAssignedWorkPresentation(issue):null;
      return{characterId:profile.characterId,state,issue,event,label:presentation?.text??JIRA_UNAVAILABLE_MESSAGE,status:presentation?.status??null};
    });
    const spectatorItems:SpectatorItem[]=[];
    for(const event of allowedEvents){
      const character=event.authorId?byJiraId.get(event.authorId):undefined;
      if(character&&allowedKeys.has(event.issueKey))spectatorItems.push({character,event,groupedEventCount:1});
    }
    return{directives,spectatorItems};
  }

  directiveFor(item:SpectatorItem,issues:JiraIssueSnapshot[],statusMappings:StatusBehaviorMapping[]):CharacterDirective{
    const issue=issues.find(candidate=>candidate.issueKey===item.event.issueKey)??null;
    const event=item.event;
    const status=event.currentStatus??event.newStatus??issue?.status??'';
    const category=issue?.statusCategory??'';
    let state=this.configuredState(status,category,statusMappings);
    const action=event.action.toUpperCase();
    if(/CLOSED|RESOLVED|COMPLETED|DONE/.test(action))state='CELEBRATING';
    else if(/REVIEW|APPROV/.test(action))state='REVIEWING';
    else if(/COMMENT|DISCUSS/.test(action))state='DISCUSSING';
    else if(state==='IDLE')state='WORKING';
    const presentation=jiraWorkPresentation(event,issue);
    const grouped=item.groupedEventCount>1?`${presentation.text} I also have ${item.groupedEventCount-1} more ${item.groupedEventCount===2?'update':'updates'} to share.`:presentation.text;
    return{characterId:item.character.characterId,state,issue,event,label:grouped,status:presentation.status};
  }

  private mapping(profiles:GameProfile[]):Map<string,GameProfile>{
    return new Map(profiles.filter(profile=>profile.enabled&&profile.jiraAccountId).map(profile=>[profile.jiraAccountId!,profile]));
  }

  private inScope(issue:JiraIssueSnapshot,settings:GameSettings):boolean{
    const projectAllowed=!settings.jiraProjects.length||settings.jiraProjects.includes(issue.projectKey.toUpperCase());
    const typeAllowed=!settings.jiraIssueTypes.length||settings.jiraIssueTypes.some(type=>type.localeCompare(issue.issueType,undefined,{sensitivity:'accent'})===0);
    return projectAllowed&&typeAllowed;
  }

  private configuredState(status:string,category:string,mappings:StatusBehaviorMapping[]):CharacterState{
    const configured=mappings.find(mapping=>mapping.status.localeCompare(status,undefined,{sensitivity:'accent'})===0);
    return configured?.behavior??stateForStatus(status,category);
  }

}
