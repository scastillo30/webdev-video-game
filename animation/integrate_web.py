from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'index.html'
s=p.read_text()
s=s.replace('"rogue_full":"assets/rogue_full.webp"','"rogue_full":"assets/rogue-pointing/poster.webp"')
s=s.replace('"rogue_head":"assets/rogue_head.webp"','"rogue_head":"assets/rogue-pointing/head.webp"')
css='''/* Blender-rendered Rogue: one registered RGBA animation avoids layer drift. */
.puppet-web{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;pointer-events:none}
.has-web-animation .puppet-body,.has-web-animation .puppet-head{display:none}
.has-web-animation:not(.casting) .puppet{animation:none}
'''
s=s.replace('</style>',css+'</style>')
helpers='''const ROGUE_ANIMATION='assets/rogue-pointing/pointing.webp';
const ROGUE_POSTER='assets/rogue-pointing/poster.webp';
function syncWebAnimations(){
  const stopped=paused||reducedMotion||document.hidden||!!activeModal||stage.classList.contains('eco');
  document.querySelectorAll('.puppet-web').forEach(img=>{
    const src=stopped||img.dataset.failed==='true'?ROGUE_POSTER:ROGUE_ANIMATION;
    if(img.getAttribute('src')!==src)img.src=src;
  });
}
function mountWebAnimation(slot,hero){
  const enabled=hero==='rogue'&&heroAsset(hero,'full')===ROGUE_POSTER;
  slot.classList.toggle('has-web-animation',enabled);
  let img=slot.querySelector('.puppet-web');
  if(!enabled){img?.remove();return}
  if(!img){
    img=document.createElement('img');img.className='puppet-web';img.alt='';img.width=384;img.height=576;
    img.onerror=()=>{img.dataset.failed='true';if(img.getAttribute('src')!==ROGUE_POSTER)img.src=ROGUE_POSTER};
    slot.querySelector('.puppet').appendChild(img);
  }
  syncWebAnimations();
}
'''
s=s.replace('async function mountSlot(which,hero)',helpers+'async function mountSlot(which,hero)')
old="slot.querySelector('.puppet-head').src=headSrc;slot.classList.remove('loading');"
new="slot.querySelector('.puppet-head').src=headSrc;mountWebAnimation(slot,hero);slot.classList.remove('loading');"
assert old in s
s=s.replace(old,new)
s=s.replace('function loop(now){requestAnimationFrame(loop);','function loop(now){requestAnimationFrame(loop);syncWebAnimations();')
p.write_text(s)
