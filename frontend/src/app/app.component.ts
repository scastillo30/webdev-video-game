import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';

type Character={id:string;name:string;role:string;epithet:string;bio:string;accent:string;animationPath:string;posterPath:string;thumbPath:string;commentThumbPath:string};
const blank=():Character=>({id:'',name:'',role:'',epithet:'',bio:'',accent:'#69d5ff',animationPath:'',posterPath:'',thumbPath:'',commentThumbPath:''});

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.component.html'})
export class AppComponent implements OnInit{
  private http=inject(HttpClient); characters:Character[]=[]; edit=blank(); selected=''; busy=false; error=''; showMaintenance=false;
  ngOnInit(){this.load()}
  load(){this.http.get<Character[]>('/api/characters').subscribe({next:v=>this.characters=v,error:()=>this.error='Go API unavailable. Start the backend on port 8080.'})}
  select(c:Character){this.selected=c.id;this.edit={...c}}
  create(){this.selected='';this.edit=blank();this.showMaintenance=true}
  save(){this.busy=true;this.error='';const request=this.selected?this.http.put<Character>(`/api/characters/${encodeURIComponent(this.selected)}`,this.edit):this.http.post<Character>('/api/characters',this.edit);request.subscribe({next:()=>{this.busy=false;this.load();this.showMaintenance=false},error:e=>{this.busy=false;this.error=e.error?.error||'Save failed'}})}
  remove(){if(!this.selected||!confirm(`Delete ${this.edit.name}?`))return;this.http.delete(`/api/characters/${encodeURIComponent(this.selected)}`).subscribe({next:()=>{this.load();this.showMaintenance=false},error:e=>this.error=e.error?.error||'Delete failed'})}
}
