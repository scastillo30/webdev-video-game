import {GameSettings} from './game.models';

export const HOLIDAY_ITEMS=['pumpkins','bats','cobwebs','trees','gifts','garlands'] as const;
export interface HolidayPlacement {item:typeof HOLIDAY_ITEMS[number];x:number;y:number;width:number;height:number}
// All footprints stay on existing blocked furniture/landings or above the north wall.
const placements:Record<'halloween'|'christmas',HolidayPlacement[]>={
  halloween:[
    {item:'pumpkins',x:80,y:445,width:44,height:44},{item:'pumpkins',x:1330,y:445,width:44,height:44},
    {item:'pumpkins',x:1380,y:160,width:40,height:40},
    {item:'bats',x:565,y:28,width:68,height:40},{item:'bats',x:860,y:25,width:54,height:34},
    {item:'cobwebs',x:4,y:4,width:100,height:100},{item:'cobwebs',x:1330,y:4,width:100,height:100}
  ],
  christmas:[
    {item:'trees',x:55,y:405,width:65,height:90},{item:'trees',x:1125,y:100,width:65,height:90},
    {item:'gifts',x:290,y:450,width:55,height:55},{item:'gifts',x:1180,y:450,width:55,height:55},
    {item:'garlands',x:540,y:4,width:116,height:65},{item:'garlands',x:790,y:4,width:116,height:65},
    {item:'garlands',x:1240,y:82,width:90,height:50}
  ]
};
export function holidayPlacements(settings:GameSettings):HolidayPlacement[]{
  if(settings.holidayMode!=='halloween'&&settings.holidayMode!=='christmas')return [];
  return placements[settings.holidayMode].filter(placement=>settings.holidayItems?.includes(placement.item));
}
