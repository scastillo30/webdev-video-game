from PIL import Image
import os, shutil
import numpy as np
base=os.path.dirname(os.path.abspath(__file__)); dst=os.path.join(base,'assets')
heroes='commander guardian rogue mage healer courier swordsman bard'.split()
for hero in heroes:
    im=Image.open(f'{dst}/{hero}_full.webp').convert('RGBA')
    arr=np.array(im).copy(); h,w=arr.shape[:2]; Y=np.arange(h)[:,None]
    # Natural broad blend across shoulders/collars; parts align perfectly in neutral pose.
    bodyfactor=np.clip((Y-175)/65,0,1)
    headfactor=np.clip((245-Y)/65,0,1)
    for part,factor in [('body',bodyfactor),('head',headfactor)]:
        data=arr.copy(); data[:,:,3]=np.rint(data[:,:,3].astype(float)*factor).astype(np.uint8)
        Image.fromarray(data,'RGBA').save(f'{dst}/{hero}_{part}.webp','WEBP',quality=82,method=2)
print('created',sum(os.path.getsize(f'{dst}/{v}') for v in os.listdir(dst))/1e6,'MB')
