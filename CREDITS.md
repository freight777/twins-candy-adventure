# Credits

Everything below is free to use (CC0 / public domain). Credit isn't required, but it's nice to say thank you.

- **3D models:** [Kenney](https://kenney.nl) — Food Kit and Nature Kit (CC0).
- **Sky lighting photos:** [Poly Haven](https://polyhaven.com) — Kloofendal 48d partly cloudy, Qwantani noon, Belfast sunset (CC0).
- **Engine:** [three.js](https://threejs.org) (MIT), built with [Vite](https://vite.dev) (MIT).
- **Celebration particles** (confetti, fireworks): [three.quarks](https://github.com/Alchemist0823/three.quarks) (MIT).
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
- Players' bodies and faces: Quaternius "Universal Base Characters" Superhero Male (CC0, https://quaternius.com/packs/universalbasecharacters.html), public/assets/derby/char/ubc/
  (textures resized for the web). The baseball uniforms, caps, helmet, hair and name/number are generated in code (src/derby/skinned.js).

## Sparkle Plinko sounds (CC0)
- Peg clinks, bumper bells, the plunger, coins and the pizzicato / steel-drum jingles: [Kenney](https://kenney.nl) Impact Sounds, Interface Sounds, Casino Audio and Music Jingles (CC0), the same packs Wishwood uses, joined into public/assets/plinko/sfx.mp3 by tools/plinko-sfx.mjs.

## Claw Machine
- Toy physics: [cannon-es](https://github.com/pmndrs/cannon-es) (MIT).
- The machine, the arcade, the plush toys and their fabric shading are all made in code (src/claw/); no downloaded art.

## Sparkle Match
- Pieces, friends and pictures: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D renders by Microsoft (MIT), fetched by tools/fetch-art.mjs into public/assets/match/.
- Sounds: [Kenney](https://kenney.nl) Interface Sounds, Impact Sounds, Casino Audio and Music Jingles (CC0), joined into public/assets/match/sfx.mp3 by tools/game-sfx.mjs.
- Rendering: [PixiJS](https://pixijs.com) (MIT). Tweens: [GSAP](https://gsap.com) (free "no charge" licence). Confetti: [canvas-confetti](https://github.com/catdad/canvas-confetti) (ISC).
- The rule engine, the 100 levels and their calibration come from the Sparkle Match build spec.

## Puzzle Shelf
- Theme pictures and maze shapes (the shapes are the pictures' silhouettes): [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D renders by Microsoft (MIT), public/assets/shelf/ and src/shelf/shapes.js, made by tools/fetch-art.mjs.
- Sounds: [Kenney](https://kenney.nl) RPG Audio, Interface Sounds, Impact Sounds and Music Jingles (CC0), joined into public/assets/shelf/sfx.mp3 by tools/game-sfx.mjs.
- The maze generator (Growing Tree) comes from the Puzzle Shelf build spec, after Jamis Buck's write-ups.
