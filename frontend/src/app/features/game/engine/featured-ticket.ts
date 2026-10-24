import {JiraIssueSnapshot} from '../../../core/jira/jira.models';
import {FeaturedTicketRule} from './game.models';

const priorityRank=(priority:string|null):number=>{
  const normalized=(priority??'').toLowerCase();
  if(/highest|critical|blocker/.test(normalized))return 0;
  if(/high|major/.test(normalized))return 1;
  if(/medium|normal/.test(normalized))return 2;
  if(/lowest|trivial/.test(normalized))return 4;
  if(/low|minor/.test(normalized))return 3;
  return 5;
};

const timestamp=(value:string|null):number=>{
  if(!value)return Number.POSITIVE_INFINITY;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:Number.POSITIVE_INFINITY;
};

const updatedTimestamp=(value:string):number=>{
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:0;
};

export function chooseFeaturedIssue(issues:JiraIssueSnapshot[],rule:FeaturedTicketRule):JiraIssueSnapshot|null{
  if(!issues.length)return null;
  const sorted=[...issues].sort((a,b)=>{
    if(rule==='highest-priority'){
      const priority=priorityRank(a.priority)-priorityRank(b.priority);
      if(priority)return priority;
    }else if(rule==='nearest-due-date'){
      const due=timestamp(a.dueDate)-timestamp(b.dueDate);
      if(due)return due;
    }
    return updatedTimestamp(b.updatedAt)-updatedTimestamp(a.updatedAt)||a.issueKey.localeCompare(b.issueKey);
  });
  return sorted[0];
}
