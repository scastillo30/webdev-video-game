import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultGameSettings} from '../src/app/features/game/engine/game.models';
import {holidayPlacements} from '../src/app/features/game/engine/holiday-decorations';
import {CastleNavigationModel,CASTLE_TILE_SIZE} from '../src/app/features/game/engine/castle-navigation';

test('holiday modes isolate selections and permit an empty scene',()=>{
 const settings=defaultGameSettings();
 assert.equal(holidayPlacements(settings).length,0);
 settings.holidayMode='halloween';
 assert.ok(holidayPlacements(settings).every(item=>['pumpkins','bats','cobwebs'].includes(item.item)));
 settings.holidayItems=['pumpkins'];
 assert.equal(holidayPlacements(settings).length,3);
 settings.holidayMode='christmas';
 assert.equal(holidayPlacements(settings).length,0);
 settings.holidayItems=[];
 assert.equal(holidayPlacements(settings).length,0);
});

test('floor decoration footprints stay within existing blocked areas',()=>{
 const settings=defaultGameSettings(),navigation=new CastleNavigationModel();
 for(const mode of ['halloween','christmas'] as const){
 settings.holidayMode=mode;
 for(const item of holidayPlacements(settings).filter(item=>['pumpkins','trees','gifts'].includes(item.item))){
 for(let y=Math.floor(item.y/CASTLE_TILE_SIZE);y<=Math.floor((item.y+item.height-1)/CASTLE_TILE_SIZE);y++)
 for(let x=Math.floor(item.x/CASTLE_TILE_SIZE);x<=Math.floor((item.x+item.width-1)/CASTLE_TILE_SIZE);x++)
 assert.ok(navigation.blocked.has(`${x},${y}`),`${item.item} occupies walkable cell ${x},${y}`);
 }
 }
});
