import {CommonModule} from '@angular/common';
import {Component, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';

type Character={id:string;name:string;role:string;epithet:string;bio:string;accent:string;animationPath:string;posterPath:string;thumbPath:string;commentThumbPath:string};
const blank=():Character=>({id:'',name:'',role:'',epithet:'',bio:'',accent:'#69d5ff',animationPath:'',posterPath:'',thumbPath:'',commentThumbPath:''});

@Component({
  selector:'app-character-maintenance',
  standalone:true,
  imports:[CommonModule,FormsModule],
  template:`<main class="maintenance"><aside><div class="aside-title">CHARACTER CODEX</div><button class="new" (click)="create()">＋ ADD CHARACTER</button><button *ngFor="let c of characters" (click)="select(c)" [class.active]="selected===c.id"><img [src]="'/legacy-game/'+c.thumbPath" alt=""><span>{{c.name}}<small>{{c.role}}</small></span></button></aside><form (ngSubmit)="save()"><h1>{{selected?'MODIFY':'ADD'}} CHARACTER</h1><p class="error" *ngIf="error">{{error}}</p><div class="grid"><label>ID<input name="id" [(ngModel)]="edit.id" [readonly]="!!selected" required pattern="[a-z0-9-]+"></label><label>NAME<input name="name" [(ngModel)]="edit.name" required></label><label>ROLE<input name="role" [(ngModel)]="edit.role" required></label><label>ACCENT<input name="accent" [(ngModel)]="edit.accent"></label></div><label>EPITHET<input name="epithet" [(ngModel)]="edit.epithet"></label><label>BIOGRAPHY<textarea name="bio" [(ngModel)]="edit.bio"></textarea></label><fieldset><legend>STRUCTURED ASSETS</legend><label>ANIMATION<input name="animation" [(ngModel)]="edit.animationPath"></label><label>POSTER<input name="poster" [(ngModel)]="edit.posterPath"></label><label>SMALL THUMB<input name="thumb" [(ngModel)]="edit.thumbPath"></label><label>COMMENT THUMB<input name="commentThumb" [(ngModel)]="edit.commentThumbPath"></label></fieldset><footer><button type="button" class="danger" *ngIf="selected" (click)="remove()">DELETE</button><button type="submit" [disabled]="busy">{{busy?'SAVING…':'SAVE CHARACTER'}}</button></footer></form></main>`
})
export class CharacterMaintenanceComponent implements OnInit {
  private readonly http=inject(HttpClient); characters:Character[]=[]; edit=blank(); selected=''; busy=false; error='';
  ngOnInit():void{this.load()}
  load():void{this.http.get<Character[]>('/api/characters').subscribe({next:value=>this.characters=value,error:()=>this.error='Go API unavailable. Start the backend on port 8080.'})}
  select(character:Character):void{this.selected=character.id;this.edit={...character}}
  create():void{this.selected='';this.edit=blank()}
  save():void{this.busy=true;this.error='';const request=this.selected?this.http.put<Character>(`/api/characters/${encodeURIComponent(this.selected)}`,this.edit):this.http.post<Character>('/api/characters',this.edit);request.subscribe({next:()=>{this.busy=false;this.load()},error:error=>{this.busy=false;this.error=error.error?.error||'Save failed'}})}
  remove():void{if(!this.selected||!confirm(`Delete ${this.edit.name}?`))return;this.http.delete(`/api/characters/${encodeURIComponent(this.selected)}`).subscribe({next:()=>{this.load();this.create()},error:error=>this.error=error.error?.error||'Delete failed'})}
}
