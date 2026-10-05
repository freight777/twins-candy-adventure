# Credits

Everything below is free to use (CC0 / public domain). Credit isn't required, but it's nice to say thank you.

- **3D models:** [Kenney](https://kenney.nl) — Food Kit and Nature Kit (CC0).
- **Sky lighting photos:** [Poly Haven](https://polyhaven.com) — Kloofendal 48d partly cloudy, Qwantani noon, Belfast sunset (CC0).
- **Engine:** [three.js](https://threejs.org) (MIT), built with [Vite](https://vite.dev) (MIT).
- **Characters, music, sound effects, scenes and everything else:** made for this game with Claude.

## Home Run Derby motion data
Batting swing and pitching motions come from the CMU Graphics Lab Motion Capture Database (subject 124: "Baseball Swing" 124_07, "Baseball Pitch" 124_01),
which is free to use for any purpose. BVH conversion by Bruce Hahne; per-file copies from https://github.com/una-dinosauria/cmu-mocap.
The raw files are in public/assets/mocap/; tools/export-clips.cjs turns them into the small swing.json / pitch.json clips the game plays.

## Home Run Derby realism assets (all CC0)
- Lighting and sky: Poly Haven "Orlando Stadium" HDRI (https://polyhaven.com/a/orlando_stadium), public/assets/derby/hdr/.
- Surfaces: ambientCG Grass001, Ground054 and Concrete034 (https://ambientcg.com), public/assets/derby/tex/.
- Players' bodies: Quaternius "Universal Animation Library" mannequin (https://quaternius.com), via https://github.com/J-Ponzo/gltf-universal-animation-library, public/assets/derby/char/.
  The uniforms, cap, helmet and name/number are made in code; the motion is the CMU data above.
