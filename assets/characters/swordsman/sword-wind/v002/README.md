# Swordsman — Sword Wind v002

Eight seconds at 24 fps. This revision fixes v001’s cuff pivot and fixed upper arm. New illustrated upper sleeve, forearm, closed hand and isolated sword parts form an articulated shoulder → elbow → wrist → grip hierarchy. The hilt sits behind the curled fingers, with the guard below the fist. The sword and hand share a wrist transform, so the blade stays rigid and the hilt cannot slide.

The low guard maintains about six degrees of anatomical elbow flexion. The raised guard reaches about 126 degrees. Wrist adjustment stays between two and eight degrees. A controlled lowering, hold, lift and raised hold complete the loop; the cape retains its independent wind motion.

Open `swordsman_sword_wind.blend` and edit the named CTRL objects. All textures are packed. `idle.webp` is the transparent animated preview; `poster.webp` is the low guard. Review poses: `raised.png`, `transition.png`, `lowered.png`, `lifting.png`. `rig_validation.json` records transform, arm length, grip and loop checks across frames 1–193, plus export duration.

This is an illustrated 2.5D puppet, with movement in the image plane. It improves the joint mechanics and grip continuity; it is not a volumetric swordplay simulation. Generated artwork reconstructs the moving parts. All v001 exports and original art are preserved. The runtime registry remains unchanged and still uses its previously integrated version.
