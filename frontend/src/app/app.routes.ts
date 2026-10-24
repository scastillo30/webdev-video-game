import {Routes} from '@angular/router';

export const routes: Routes = [
  {path: '', title: 'WEBDEV MMORPG · Office View', loadComponent: () => import('./features/office/office-view.component').then(module => module.OfficeViewComponent)},
  {path: 'game', title: 'WEBDEV MMORPG · Game View', loadComponent: () => import('./features/game/game-view.component').then(module => module.GameViewComponent)},
  {path: 'characters', title: 'WEBDEV MMORPG · Characters', loadComponent: () => import('./features/characters/character-maintenance.component').then(module => module.CharacterMaintenanceComponent)},
  {path: 'settings/game', title: 'WEBDEV MMORPG · Game Settings', loadComponent: () => import('./features/settings/game-settings.component').then(module => module.GameSettingsComponent)},
  {path: '**', redirectTo: ''}
];
