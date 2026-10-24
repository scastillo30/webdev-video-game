import {GridPoint} from './game.models';

const key=(point:GridPoint):string=>`${point.x},${point.y}`;
const distance=(a:GridPoint,b:GridPoint):number=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export class CharacterPathfinding {
  constructor(private readonly columns:number,private readonly rows:number,private readonly blocked:ReadonlySet<string>){}

  find(start:GridPoint,goal:GridPoint,reserved:ReadonlySet<string>=new Set()):GridPoint[]{
    if(key(start)===key(goal))return[];
    const frontier:{point:GridPoint;score:number}[]=[{point:start,score:0}],cameFrom=new Map<string,GridPoint>(),cost=new Map<string,number>([[key(start),0]]);
    while(frontier.length){
      frontier.sort((a,b)=>a.score-b.score);
      const current=frontier.shift()!.point;
      if(key(current)===key(goal))return this.reconstruct(cameFrom,start,goal);
      for(const next of this.neighbors(current)){
        const nextKey=key(next);
        if(this.blocked.has(nextKey)||reserved.has(nextKey))continue;
        const newCost=(cost.get(key(current))??0)+1;
        if(newCost>=(cost.get(nextKey)??Number.POSITIVE_INFINITY))continue;
        cost.set(nextKey,newCost);cameFrom.set(nextKey,current);frontier.push({point:next,score:newCost+distance(next,goal)});
      }
    }
    return[];
  }

  private neighbors(point:GridPoint):GridPoint[]{
    return[{x:point.x+1,y:point.y},{x:point.x-1,y:point.y},{x:point.x,y:point.y+1},{x:point.x,y:point.y-1}].filter(next=>next.x>0&&next.y>0&&next.x<this.columns-1&&next.y<this.rows-1);
  }

  private reconstruct(cameFrom:Map<string,GridPoint>,start:GridPoint,goal:GridPoint):GridPoint[]{
    const path:GridPoint[]=[];let current=goal;
    while(key(current)!==key(start)){path.unshift(current);const previous=cameFrom.get(key(current));if(!previous)return[];current=previous}
    return path;
  }
}
