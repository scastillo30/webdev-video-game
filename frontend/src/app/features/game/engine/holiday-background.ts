import Phaser from 'phaser';
import {GameSettings} from './game.models';

// Coordinates follow the approved 1774 × 887 backgrounds.
export class HolidayBackground{
  private readonly windows:Phaser.GameObjects.Graphics;
  private readonly lights:Phaser.GameObjects.Graphics;
  private readonly maskShape:Phaser.GameObjects.Graphics;
  private mode:GameSettings['holidayMode']='none';
  private clock=0;
  constructor(scene:Phaser.Scene,width:number,height:number){
    const sx=width/1774,sy=height/887;
    this.windows=scene.add.graphics().setScale(sx,sy).setDepth(3);
    this.lights=scene.add.graphics().setScale(sx,sy).setDepth(5);
    this.maskShape=scene.make.graphics({x:0,y:0},false).setScale(sx,sy);
    // Inset openings keep effects behind stone frames and foreground plants.
    for(const [left,right,top,bottom] of [[663,747,25,151],[812,961,13,163],[1031,1108,27,150]]){
      const center=(left+right)/2,radius=(right-left)/2;
      this.maskShape.fillStyle(0xffffff).beginPath().moveTo(left,bottom).lineTo(left,top+radius);
      for(let i=0;i<=24;i++){
        const angle=Math.PI+i*Math.PI/24;
        this.maskShape.lineTo(center+Math.cos(angle)*radius,top+radius+Math.sin(angle)*radius);
      }
      this.maskShape.lineTo(right,bottom).closePath().fillPath();
    }
    this.windows.setMask(this.maskShape.createGeometryMask());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.windows.clearMask(true);this.maskShape.destroy()});
  }
  configure(mode:GameSettings['holidayMode']):void{
    if(mode===this.mode)return;
    this.mode=mode;this.clock=0;this.windows.clear();this.lights.clear();
  }
  update(delta:number,settings:GameSettings,reducedMotion:boolean):void{
    this.windows.clear();this.lights.clear();
    if(this.mode==='none'||!settings.effectsEnabled||reducedMotion)return;
    this.clock+=Math.min(delta,100)*settings.animationSpeed;
    const t=this.clock/1000;
    if(this.mode==='christmas'){
      for(let i=0;i<65;i++){
        const x=650+(i*73.31+Math.sin(t*.7+i)*7)%475,y=(i*31.7+t*(9+i%7))%180;
        this.windows.fillStyle(0xf5fbff,.45+(i%4)*.12).fillCircle(x,y,.7+(i%3)*.35);
      }
      const bulbs=[[135,183],[122,205],[148,211],[110,232],[137,238],[162,240],[96,258],[123,267],[152,270],[179,266],[80,288],[108,297],[139,301],[168,296],[195,291],[98,319],[129,326],[161,323],[185,314]];
      bulbs.forEach(([x,y],i)=>{
        const pulse=(Math.sin(t*(1.7+i%3*.3)+i*2.4)+1)/2,color=[0xffdb72,0xff715b,0xa4ff9b,0xfff2c1][i%4];
        this.lights.fillStyle(color,.05+pulse*.16).fillCircle(x,y,5+pulse*3);
        this.lights.fillStyle(color,.35+pulse*.65).fillCircle(x,y,1.5+pulse);
      });
    }else{
      // Fly through the windows, fade out, then remain absent before the next visit.
      const phase=t%22;
      if(phase>=10)return;
      const progress=phase/10,x=635+progress*510,y=77+Math.sin(progress*Math.PI*3)*22;
      const alpha=Math.min(1,phase,10-phase)*.9,ink=0x1b102b;
      this.windows.lineStyle(2,0x6a3924,alpha).lineBetween(x-25,y+11,x+26,y+4);
      this.windows.fillStyle(0x86603e,alpha).fillTriangle(x-28,y+6,x-28,y+17,x-13,y+10);
      this.windows.fillStyle(ink,alpha).fillCircle(x+2,y-11,4).fillTriangle(x-10,y+6,x+1,y-10,x+11,y+5);
      this.windows.fillTriangle(x-4,y-16,x+1,y-28,x+8,y-16).fillEllipse(x+2,y-15,19,4);
      this.windows.lineStyle(3,ink,alpha).lineBetween(x+5,y-4,x+15,y+1).lineBetween(x,y+4,x+7,y+10);
      this.windows.fillStyle(ink,alpha).fillTriangle(x-6,y-6,x-22,y+4,x-9,y+3);
    }
  }
}
