import {JiraActivityEvent, JiraIssueSnapshot} from '../../../core/jira/jira.models';

export type CharacterState = 'IDLE' | 'WALKING' | 'WORKING' | 'DISCUSSING' | 'REVIEWING' | 'BLOCKED' | 'CELEBRATING';

export interface GameProfile {
  characterId: string;
  displayName: string;
  characterClass: string;
  jiraAccountId: string | null;
  homeLocation: string;
  workstation: string;
  miniatureAsset: string;
  portraitAsset: string;
  enabled: boolean;
}

export interface GameSettings {
  scene: 'castle-command-center';
  movementEnabled: boolean;
  effectsEnabled: boolean;
  animationSpeed: number;
  spectatorEnabled: boolean;
  rotationIntervalSeconds: number;
  tvScale: number;
  soundEnabled: boolean;
}

export interface StatusBehaviorMapping {
  status: string;
  behavior: CharacterState;
}

export interface GameConfig {
  settings: GameSettings;
  profiles: GameProfile[];
  statusMappings: StatusBehaviorMapping[];
}

export interface GridPoint {x:number;y:number}

export interface CharacterDirective {
  characterId: string;
  state: CharacterState;
  issue: JiraIssueSnapshot | null;
  event: JiraActivityEvent | null;
  label: string;
}

export interface SpectatorItem {
  character: GameProfile;
  event: JiraActivityEvent;
  groupedEventCount: number;
}

export interface SpectatorState {
  active: SpectatorItem | null;
  focusCharacterId: string | null;
  autoEnabled: boolean;
  paused: boolean;
  pending: number;
}

export interface GameBehaviorResult {
  directives: CharacterDirective[];
  spectatorItems: SpectatorItem[];
}
