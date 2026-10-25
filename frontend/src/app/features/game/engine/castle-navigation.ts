import {CharacterState, GridPoint} from './game.models';

export const CASTLE_TILE_SIZE=48;
export const CASTLE_COLUMNS=30;
export const CASTLE_ROWS=15;

interface BlockedArea {id:string;x:number;y:number;width:number;height:number}

export interface InteractionTarget {
  point:GridPoint;
  facingX?:number;
  label:string;
  state:CharacterState;
}

export const CASTLE_ANCHORS:Record<string,GridPoint>={
  'command-dais':{x:15,y:3},'north-forge':{x:5,y:7},'west-archive':{x:8,y:8},'east-library':{x:21,y:4},
  'south-sanctum':{x:15,y:12},'west-gate':{x:9,y:12},'training-hall':{x:24,y:11},'east-stage':{x:23,y:11},
  'planning-table':{x:11,y:7},'ops-console':{x:8,y:6},'frontend-desk':{x:8,y:9},'api-orb':{x:21,y:5},
  'design-table':{x:14,y:10},'support-desk':{x:7,y:11},'qa-board':{x:23,y:10},'automation-console':{x:22,y:7},
  'quest-board':{x:20,y:5},'review-table':{x:19,y:7},'entrance':{x:15,y:13},'library':{x:21,y:4}
};

// These rectangles map the non-walkable visual footprint of the illustrated
// furniture. Interaction slots sit on adjacent walkable cells, never inside it.
export const CASTLE_BLOCKED_AREAS:readonly BlockedArea[]=[
  {id:'north-wall',x:0,y:0,width:30,height:1},
  {id:'south-wall',x:0,y:14,width:30,height:1},
  {id:'west-wall',x:0,y:0,width:1,height:15},
  {id:'east-wall',x:29,y:0,width:1,height:15},
  {id:'crystal-fountain',x:1,y:3,width:5,height:4},
  {id:'northwest-workstation',x:6,y:3,width:5,height:3},
  {id:'planning-table',x:12,y:6,width:7,height:4},
  {id:'fireplace-library',x:22,y:1,width:7,height:4},
  {id:'map-archive-wall',x:23,y:5,width:6,height:3},
  {id:'southwest-workstation',x:1,y:8,width:7,height:3},
  {id:'southeast-workstation',x:24,y:8,width:5,height:3},
  {id:'west-lower-landing',x:1,y:12,width:8,height:2},
  {id:'east-lower-landing',x:21,y:12,width:8,height:2}
];

const stationSlots:Record<string,InteractionTarget[]>={
  'planning-table':[
    {point:{x:11,y:7},facingX:13,label:'Discussing at the planning table',state:'DISCUSSING'},
    {point:{x:19,y:7},facingX:17,label:'Discussing at the planning table',state:'DISCUSSING'},
    {point:{x:14,y:5},facingX:14,label:'Reviewing the holographic plan',state:'DISCUSSING'},
    {point:{x:16,y:5},facingX:16,label:'Reviewing the holographic plan',state:'DISCUSSING'},
    {point:{x:14,y:10},facingX:14,label:'Reviewing the holographic plan',state:'DISCUSSING'},
    {point:{x:16,y:10},facingX:16,label:'Reviewing the holographic plan',state:'DISCUSSING'}
  ],
  'review-table':[
    {point:{x:19,y:7},facingX:17,label:'Reviewing at the planning table',state:'REVIEWING'},
    {point:{x:16,y:10},facingX:16,label:'Reviewing the holographic plan',state:'REVIEWING'}
  ],
  'library':[
    {point:{x:21,y:4},facingX:23,label:'Researching the castle library',state:'REVIEWING'},
    {point:{x:21,y:5},facingX:23,label:'Checking the project archives',state:'REVIEWING'},
    {point:{x:22,y:6},facingX:23,label:'Checking the map archive',state:'REVIEWING'}
  ],
  'quest-board':[
    {point:{x:20,y:5},facingX:23,label:'Celebrating at the quest board',state:'CELEBRATING'},
    {point:{x:20,y:6},facingX:23,label:'Updating the quest board',state:'CELEBRATING'}
  ],
  'ops-console':[
    {point:{x:7,y:6},facingX:8,label:'Working at the operations console',state:'WORKING'},
    {point:{x:8,y:6},facingX:8,label:'Working at the operations console',state:'WORKING'},
    {point:{x:9,y:6},facingX:8,label:'Working at the operations console',state:'WORKING'}
  ],
  'frontend-desk':[
    {point:{x:8,y:8},facingX:6,label:'Working at the frontend desk',state:'WORKING'},
    {point:{x:8,y:9},facingX:6,label:'Working at the frontend desk',state:'WORKING'},
    {point:{x:8,y:10},facingX:6,label:'Working at the frontend desk',state:'WORKING'}
  ],
  'api-orb':[
    {point:{x:21,y:5},facingX:23,label:'Inspecting the API archive',state:'WORKING'},
    {point:{x:22,y:6},facingX:23,label:'Inspecting the API archive',state:'WORKING'}
  ],
  'design-table':[
    {point:{x:14,y:10},facingX:14,label:'Reviewing the design table',state:'WORKING'},
    {point:{x:16,y:10},facingX:16,label:'Reviewing the design table',state:'WORKING'}
  ],
  'support-desk':[
    {point:{x:7,y:11},facingX:7,label:'Working at the support desk',state:'WORKING'},
    {point:{x:8,y:11},facingX:7,label:'Working at the support desk',state:'WORKING'}
  ],
  'qa-board':[
    {point:{x:23,y:9},facingX:25,label:'Testing at the quality desk',state:'WORKING'},
    {point:{x:23,y:10},facingX:25,label:'Testing at the quality desk',state:'WORKING'}
  ],
  'automation-console':[
    {point:{x:22,y:6},facingX:24,label:'Monitoring automation',state:'WORKING'},
    {point:{x:22,y:7},facingX:24,label:'Monitoring automation',state:'WORKING'}
  ]
};

const cellKey=(point:GridPoint):string=>`${point.x},${point.y}`;
const distance=(a:GridPoint,b:GridPoint):number=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export class CastleNavigationModel {
  readonly blocked:ReadonlySet<string>;

  constructor(){
    const blocked=new Set<string>();
    for(const area of CASTLE_BLOCKED_AREAS){
      for(let row=area.y;row<area.y+area.height;row++)for(let column=area.x;column<area.x+area.width;column++)blocked.add(`${column},${row}`);
    }
    this.blocked=blocked;
  }

  isWalkable(point:GridPoint):boolean{
    return point.x>0&&point.y>0&&point.x<CASTLE_COLUMNS-1&&point.y<CASTLE_ROWS-1&&!this.blocked.has(cellKey(point));
  }

  anchor(name:string):GridPoint{return{...(CASTLE_ANCHORS[name]??CASTLE_ANCHORS['entrance'])}}

  station(name:string,from:GridPoint,reserved:ReadonlySet<string>):InteractionTarget|null{
    const candidates=(stationSlots[name]??[])
      .filter(slot=>this.isWalkable(slot.point)&&!reserved.has(cellKey(slot.point)))
      .sort((left,right)=>distance(left.point,from)-distance(right.point,from));
    const selected=candidates[0];
    return selected?{...selected,point:{...selected.point}}:null;
  }

  adjacentTo(point:GridPoint,from:GridPoint,reserved:ReadonlySet<string>):GridPoint|null{
    const candidates=[
      {x:point.x-1,y:point.y},{x:point.x+1,y:point.y},{x:point.x,y:point.y-1},{x:point.x,y:point.y+1}
    ].filter(candidate=>this.isWalkable(candidate)&&!reserved.has(cellKey(candidate)))
      .sort((left,right)=>distance(left,from)-distance(right,from));
    return candidates[0]?{...candidates[0]}:null;
  }

  roam(origin:GridPoint,from:GridPoint,reserved:ReadonlySet<string>,radius=3):GridPoint|null{
    const candidates:GridPoint[]=[];
    for(let y=Math.max(1,origin.y-radius);y<=Math.min(CASTLE_ROWS-2,origin.y+radius);y++){
      for(let x=Math.max(1,origin.x-radius);x<=Math.min(CASTLE_COLUMNS-2,origin.x+radius);x++){
        const point={x,y};
        if(distance(point,origin)>radius||cellKey(point)===cellKey(from)||!this.isWalkable(point)||reserved.has(cellKey(point)))continue;
        candidates.push(point);
      }
    }
    candidates.sort((left,right)=>distance(left,from)-distance(right,from)||cellKey(left).localeCompare(cellKey(right)));
    return candidates[0]?{...candidates[0]}:null;
  }
}
