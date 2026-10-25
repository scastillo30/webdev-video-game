# Swordsman — Sword Wind v004

Eight seconds at 24 fps. Fixes two visual defects from v003:

- The new authored hand closes its exposed fingers and thumb around the brown leather hilt. Hand, hilt and guard are painted together; the straight blade is a separately editable mesh registered to the same texture and rigid wrist control. There is no floating hand overlay or independent hilt movement.
- The forearm is anchored at the actual sleeve mouth (source upper-sleeve artwork x210/y760). The cuff turns with the forearm, and a continuous textured elbow fold connects it to the shoulder sleeve. The skin root extends beneath the cuff lip. Old glove fragments were removed from the bare-forearm mesh.

The reference chest-guard opening and eight-second lowering/return loop are retained. `poster.webp` uses frame 1. `connection_review_001.png`, `connection_review_049.png`, `connection_review_097.png`, and `connection_review_149.png` provide close-up checks of the grip and cuff through the motion.

`rig_validation.json` records sleeve-mouth attachment and visible cuff-center registration for all 193 verification frames, fixed grip, rigid arm lengths, exact loop closure and 8,000 ms export duration. The authored grip and cloth silhouette also received visual review; transform checks alone are not evidence of correct anatomy.

Open `swordsman_sword_wind.blend` for packed, editable sources. Separate shoulder sleeve, elbow fold, turning cuff, forearm, hand/hilt/guard and blade objects are named in the scene. The `wrapped_grip_sword.png` texture is preserved. This is illustrated 2.5D animation, not volumetric swordplay or cloth simulation.

All earlier versions, original references and other character assets remain preserved. Runtime game mappings were not edited; activate v004 through the integration chat.
