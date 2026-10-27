import {COMMANDER_WALK,GUARDIAN_WALK,HEALER_WALK,BARD_WALK,ROGUE_WALK,SWORDSMAN_WALK,COURIER_WALK,MAGE_WALK,DirectionalSpriteConfig} from './directional-walk';

export interface BoardCharacterAsset {
  characterId:string;
  path:string;
  version:string;
  directional?:DirectionalSpriteConfig;
}

const boardCharacterAssets:Readonly<Record<string,BoardCharacterAsset>>=Object.freeze({
  commander:{characterId:'commander',path:'/assets/game-board/characters/v001/commander.png',version:'v001',directional:COMMANDER_WALK},
  guardian:{characterId:'guardian',path:'/assets/game-board/characters/v001/guardian.png',version:'v001',directional:GUARDIAN_WALK},
  rogue:{characterId:'rogue',path:'/assets/game-board/characters/v001/rogue.png',version:'v001',directional:ROGUE_WALK},
  mage:{characterId:'mage',path:'/assets/game-board/characters/v001/mage.png',version:'v001',directional:MAGE_WALK},
  healer:{characterId:'healer',path:'/assets/game-board/characters/v001/healer.png',version:'v001',directional:HEALER_WALK},
  courier:{characterId:'courier',path:'/assets/game-board/characters/v001/courier.png',version:'v001',directional:COURIER_WALK},
  swordsman:{characterId:'swordsman',path:'/assets/game-board/characters/v001/swordsman.png',version:'v001',directional:SWORDSMAN_WALK},
  bard:{characterId:'bard',path:'/assets/game-board/characters/v001/bard.png',version:'v001',directional:BARD_WALK}
});

export const BOARD_CHARACTER_IDS=Object.freeze(Object.keys(boardCharacterAssets));

export function boardCharacterAsset(characterId:string,fallbackPath:string):BoardCharacterAsset{
  return boardCharacterAssets[characterId]??{characterId,path:fallbackPath,version:'profile-fallback'};
}
