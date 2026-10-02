# Adalyn & Esmae's Candy Adventure: Game Plan (v0.1)

## 1. The pitch
A bedtime story turned into a game. Twin 5-year-olds, Adalyn and Esmae, chase a shiny
thing at the beach, get sucked down a whirlpool, tumble through a tunnel, and land in a
candy world. They become a Unicorn (Adalyn) and a Mermaid (Esmae), explore a
Willy Wonka-style chocolate room, play a Candyland-style board game, meet the King and
Queen, and warp home to wake up at the beach with their parents.

**Design rules for a 5-year-old audience**
- Zero reading required. Everything is spoken (voice-over) and shown with icons.
- Big touch targets, one-finger taps and drags, no tiny UI.
- Nothing is ever "game over". Traps are silly, not scary; everyone eventually wins.
- Short scenes (1-3 min each) so it works as a bedtime story you can pause.
- Gentle, bright, happy music. Reward every tap with a sound or sparkle.

## 2. Scenes (the whole game, in order)

| # | Scene | What the kids do | Key pieces needed |
|---|-------|------------------|-------------------|
| 0 | Title screen | Tap the big Play button | Logo, music, the twins' faces |
| 1 | Beach | Walk along the shore, spot the shiny thing, tap it, swim out | Beach, ocean, sun, 2 girl characters, parents in background |
| 2 | Whirlpool | Watch the whirlpool pull them under (short cutscene) | Water swirl effect, splash sound |
| 3 | Tunnel fall | Tumble down a crazy tunnel (Alice in Wonderland style); maybe steer or collect sparkles | Endless tunnel effect, floating objects (clocks, teacups, stars) |
| 4 | Candy room arrival + Talking Cat | Cat appears, explains the Candyland game and the chocolate prize | Cat character, voice-over |
| 5 | Transformation | Adalyn becomes a Unicorn, Esmae a Mermaid (tap to transform, sparkle burst) | Unicorn and mermaid models/art, transform effect |
| 6 | Chocolate room exploration | Free-roam the Wonka-style room, tap candy to eat it (Eat button) | Chocolate river and waterfall, giant lollipops, mushrooms, candy trees, eating animation, crunch sounds |
| 7 | Start space | Walk to the Start square | Transition |
| 8 | Candyland board game | Punch a dice block above their head (Mario Party style), move along the board, boosts and traps | Board, dice block, tokens, boost/trap squares, turn logic |
| 9 | Finish and royalty | King and Queen congratulate them, say candy is on its way | King and Queen characters, confetti |
| 10 | Warp home | Zoom back up the tunnel to the beach | Reuse tunnel (reversed) |
| 11 | Wake-up ending | Parents wake the girls from a "nap", everyone giggles, The End | Parents, giggle sounds, end card |

## 3. Technology recommendation (beginner-friendly, iPad-ready)

**Build it as a web game.** It runs in the browser on your computer now, and on an iPad
via Safari. You can tap "Add to Home Screen" and it launches full-screen like an app, with
no App Store, no $99 Apple developer fee, and no Mac needed. If you ever want a real App
Store version, we can wrap it later.

Proposed stack (I write the code, you don't need to learn it):
- **Vite**: the build tool that runs the game locally.
- **Three.js** for 3D: tunnel fall, candy room, board, dice. A 3D look makes it feel
  special, and it is the most popular option with the most open-source assets.
  (Alternative: **Phaser**, a 2D engine. Simpler, and storybook-illustrated 2D could
  look lovely and be much easier to get right. See question 3.)
- **Howler.js**: audio.
- **Open-source / free asset sources to check**: Kenney.nl (CC0), Quaternius (CC0),
  Poly Pizza, OpenGameArt, itch.io free packs, Mixamo-style animation sources,
  Freesound (sound effects), Pixabay Music.
- Voice-over: your own recordings (best for kids: your voice, telling the story!) or
  generated text-to-speech as placeholders.

## 4. Biggest gaps and risks (what I need to research)
1. **Unicorn and mermaid characters.** Free 3D models of these are rare. Options:
   (a) kids' own faces/photos on stylized bodies, (b) 2D illustrated characters,
   (c) modify a free horse model and add horn/mane, (d) commission/buy a pack.
2. **Likeness of the girls.** Customizable avatars (hair colour, etc.) are doable,
   photos of children never leave the device, and nothing is uploaded anywhere.
3. **The "Wonka room" look**: achievable with candy-colored 3D shapes, but needs care.
4. **The tunnel**: a shader/particle trick. Very doable and looks great.
5. **Board game logic**: easy to build. We need to design the board layout.
6. **iPad performance**: 3D must stay light. Safari on iPad is capable but we'll test early.
7. **Audio on iPad**: Safari requires a tap before sound plays, so the title screen's Play button solves it.

## 5. Build phases (rough, ~3-5 weeks of evenings)
- **Phase 1, Skeleton**: all scenes as placeholder screens, tap-to-advance, runs on iPad. 
- **Phase 2, Hero moments**: tunnel, whirlpool, dice-punch board game (the most fun parts).
- **Phase 3, Candy room**: explore + eat interaction.
- **Phase 4, Art pass**: swap in real characters, backgrounds, lighting, particles.
- **Phase 5, Voice and sound**: narration, music, effects.
- **Phase 6, Polish and playtest with the girls**: fix what confuses a 5-year-old.

## 6. Decisions (locked in)
- **Players:** turn-taking. A "who goes first / swap characters" button on the menu; during the board game turns alternate automatically.
- **Look:** 3D. Blend of Willy Wonka (chocolate room), Candyland, Mario Party (board and dice block), Alice in Wonderland (tunnel), and a beautiful beach.
- **Characters:** identical twins, brown hair, brown eyes. Adalyn wears orange, Esmae wears pink. No photos.
- **Voice-over:** v2. v1 uses on-screen icons, sound effects and music (and maybe silly sound "voices").
- **Skills:** the girls have finished Putt-Putt Saves the Zoo on iPad, so tap-and-drag is fine.
- **Device:** iPad Air, iOS 18.7.8, no Mac. Web game, "Add to Home Screen".
- **Board:** Mario Party-style candy path with traps and boosts (licorice slide, gumdrop jump, etc.).
- **Length:** about 10-15 min. Beach and candy room are free-roam. The trigger for the next scene is the shiny object in the ocean, and the Start square on the board.

## 7. Research findings: where assets come from
- **Candy and food models:** Kenney's Food Kit (CC0, glTF) and Kenney candy and chocolate wrappers on Poly Pizza; Quaternius packs (CC0).
  Many big candy props (lollipops, gumdrops, candy canes, mushrooms, trees) are simple shapes we can build ourselves in code with candy-coloured glossy materials, which is both lighter and more consistent.
- **Ocean and sky:** three.js ships `Water` and `Sky` shaders in its official examples, and there are mobile-friendly ocean scenes on GitHub (MIT).
- **Tunnel, whirlpool, chocolate river:** custom shaders. Nothing off the shelf, but they are well-known techniques.
- **Characters:** no ready-made unicorn-girl or mermaid-girl exists. Plan: build one stylized girl character (brown hair, shared body) and add outfit variants (orange or pink dress), then add a unicorn horn/ears/tail for Adalyn and a mermaid tail for Esmae, with sparkle transformations to hide the seams.
  Fallback: generate or buy models on Meshy / CGTrader (check licences first).

## 8. Setup blockers
- Node.js is not installed on this PC (needed to run the dev server). Git is not installed either (needed to save versions and publish).
- Publishing the game so the iPad can open it: free hosting on GitHub Pages or Netlify (needs an account, which you would create yourself).
