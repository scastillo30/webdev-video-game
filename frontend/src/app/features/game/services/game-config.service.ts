import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, filter, tap} from 'rxjs';
import {GameConfig} from '../engine/game.models';

@Injectable({providedIn:'root'})
export class GameConfigService{
  private readonly http=inject(HttpClient);
  private readonly state=new BehaviorSubject<GameConfig|null>(null);
  private readonly errorState=new BehaviorSubject<string>('');
  readonly config$=this.state.asObservable().pipe(filter((value):value is GameConfig=>value!==null));
  readonly error$=this.errorState.asObservable();

  constructor(){this.reload()}

  reload():void{
    this.errorState.next('');
    this.http.get<GameConfig>('/api/game/config').subscribe({next:config=>this.state.next(config),error:()=>this.errorState.next('Game configuration API unavailable')});
  }

  save(config:GameConfig):Observable<GameConfig>{
    return this.http.put<GameConfig>('/api/game/config',config).pipe(tap(saved=>{this.errorState.next('');this.state.next(saved)}));
  }
}
