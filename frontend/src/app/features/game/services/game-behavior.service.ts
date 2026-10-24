import {Injectable} from '@angular/core';
import {JiraActivityEvent, JiraIssueSnapshot, JiraSnapshot} from '../../../core/jira/jira.models';
import {stateForStatus} from '../engine/character-state-machine';
import {CharacterDirective, CharacterState, GameBehaviorResult, GameProfile, SpectatorItem, StatusBehaviorMapping} from '../engine/game.models';

@Injectable()
export class GameBehaviorService{
  derive(snapshot:JiraSnapshot,profiles:GameProfile[],statusMappings:StatusBehaviorMapping[]):GameBehaviorResult{
    const byJiraId=this.mapping(profiles);
    const newestIssueByCharacter=new Map<string,JiraIssueSnapshot>();
    for(const issue of [...snapshot.issues].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))){
      const character=issue.assigneeId?byJiraId.get(issue.assigneeId):undefined;
      if(character&&!newestIssueByCharacter.has(character.characterId))newestIssueByCharacter.set(character.characterId,issue);
    }
    const directives=profiles.filter(profile=>profile.enabled).map(profile=>{
      const issue=newestIssueByCharacter.get(profile.characterId)??null;
      let state:CharacterState=issue?this.configuredState(issue.status,issue.statusCategory,statusMappings):'IDLE';
      if(state==='CELEBRATING')state='IDLE';
      return{characterId:profile.characterId,state,issue,event:null,label:this.persistentLabel(state,issue)};
    });
    const spectatorItems:SpectatorItem[]=[];
    for(const event of snapshot.events){
      const character=event.authorId?byJiraId.get(event.authorId):undefined;
      if(character)spectatorItems.push({character,event,groupedEventCount:1});
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
    return{characterId:item.character.characterId,state,issue,event,label:this.eventLabel(event,state,item.groupedEventCount)};
  }

  private mapping(profiles:GameProfile[]):Map<string,GameProfile>{
    return new Map(profiles.filter(profile=>profile.enabled&&profile.jiraAccountId).map(profile=>[profile.jiraAccountId!,profile]));
  }

  private configuredState(status:string,category:string,mappings:StatusBehaviorMapping[]):CharacterState{
    const configured=mappings.find(mapping=>mapping.status.localeCompare(status,undefined,{sensitivity:'accent'})===0);
    return configured?.behavior??stateForStatus(status,category);
  }

  private persistentLabel(state:CharacterState,issue:JiraIssueSnapshot|null):string{
    if(!issue||state==='IDLE')return'';
    if(state==='BLOCKED')return`${issue.issueKey}: awaiting dependency`;
    if(state==='REVIEWING')return`Reviewing ${issue.issueKey}`;
    return`Assigned: ${issue.issueKey}`;
  }

  private eventLabel(event:JiraActivityEvent,state:CharacterState,grouped:number):string{
    let label:string;
    if(state==='CELEBRATING')label=`${event.issueKey}: task completed!`;
    else if(event.action.toUpperCase()==='MOVED'&&event.previousStatus&&event.newStatus)label=`${event.issueKey}: ${event.previousStatus} → ${event.newStatus}`;
    else if(state==='BLOCKED')label=`${event.issueKey}: awaiting dependency`;
    else if(state==='REVIEWING')label=`Review started: ${event.issueKey}`;
    else label=`${event.action.toUpperCase()} ${event.issueKey}`;
    return grouped>1?`${label} (+${grouped-1} more)`:label;
  }
}
