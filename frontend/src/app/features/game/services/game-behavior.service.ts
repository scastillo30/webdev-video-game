import {Injectable} from '@angular/core';
import {JiraIssueSnapshot, JiraSnapshot} from '../../../core/jira/jira.models';
import {stateForStatus} from '../engine/character-state-machine';
import {chooseFeaturedIssue} from '../engine/featured-ticket';
import {CharacterDirective, CharacterState, GameBehaviorResult, GameProfile, GameSettings, SpectatorItem, StatusBehaviorMapping} from '../engine/game.models';
import {jiraStatusPresentation,jiraWorkPresentation} from '../../../core/jira/jira-work-presentation';

@Injectable()
export class GameBehaviorService{
  derive(snapshot:JiraSnapshot,profiles:GameProfile[],statusMappings:StatusBehaviorMapping[],settings:GameSettings):GameBehaviorResult{
    const byJiraId=this.mapping(profiles);
    const issuesByCharacter=new Map<string,JiraIssueSnapshot[]>();
    const jiraConnected=snapshot.connection.configured&&snapshot.connection.state==='live';
    const allowedIssues=jiraConnected?snapshot.issues.filter(issue=>this.inScope(issue,settings)):[];
    for(const issue of allowedIssues){
      const character=issue.assigneeId?byJiraId.get(issue.assigneeId):undefined;
      if(character){
        const issues=issuesByCharacter.get(character.characterId)??[];
        issues.push(issue);issuesByCharacter.set(character.characterId,issues);
      }
    }
    const directives=profiles.filter(profile=>profile.enabled).map(profile=>{
      const issue=chooseFeaturedIssue(issuesByCharacter.get(profile.characterId)??[],settings.featuredTicketRule);
      let state:CharacterState=issue?this.configuredState(issue.status,issue.statusCategory,statusMappings):'IDLE';
      if(state==='CELEBRATING')state='IDLE';
      return{characterId:profile.characterId,state,issue,event:null,label:this.persistentLabel(state,issue),status:issue?jiraStatusPresentation(issue.status):null};
    });
    const spectatorItems:SpectatorItem[]=[];
    const allowedKeys=new Set(allowedIssues.map(issue=>issue.issueKey));
    for(const event of jiraConnected?snapshot.events:[]){
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

  private persistentLabel(state:CharacterState,issue:JiraIssueSnapshot|null):string{
    if(!issue||state==='IDLE')return'';
    if(state==='BLOCKED')return`I am waiting on a dependency for ${issue.issueKey}.`;
    if(state==='REVIEWING')return`I am reviewing ${issue.issueKey}.`;
    return`I am working on ${issue.issueKey}.`;
  }

}
