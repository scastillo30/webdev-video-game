import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, shareReplay} from 'rxjs';
import {GameProfile} from '../engine/game.models';

@Injectable({providedIn:'root'})
export class GameProfileService {
  private readonly http=inject(HttpClient);
  readonly profiles$:Observable<GameProfile[]>=this.http.get<GameProfile[]>('/api/game/profiles').pipe(shareReplay({bufferSize:1,refCount:false}));
}
