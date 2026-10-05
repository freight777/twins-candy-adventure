# Tony's Home Run Derby (src/derby)

A kid-simple home run game: the pitch comes in on the left or right side, tap that side inside a wide timing window and it is a home run; three outs ends the game.

| File | What it does |
| --- | --- |
| `game.js` | Renderer + post chain, game loop and flow (pitch, swing, hit-stop, home run, aerial replay), quality tiers, Day/Night, title/HUD wiring |
| `stadium.js` | The ballpark: wall (radius by angle), stepped three-deck seating with seat backs/aisles drawn in a shader, ~12k instanced fans, roof/frieze/lamp banks/flags, video board, night lights and skyline, `setMode('day'|'night')` |
| `skinned.js` | Human body (CC0 Universal Base Characters) retargeted from CMU mocap by "aim retargeting"; the uniform is a smoothed, thickened cloth shell grown off the body (pinstripes, belt, collar, socks, soles, gloves); helmet/cap, hair, jersey name/number decal skinned onto the back |
| `players.js` | Batter and pitcher: loads the mocap clips, stance/idle/swing/windup poses |
| `props.js` | Baseball, bat (lathe), fielder's glove |
| `tracer.js`, `swingtrail.js` | Broadcast-style ball tracer and bat swing trail |

Notes
- Debug hooks: `window.derby` (see the end of `game.js`). `derby.S.debugCam = { p, l }` freezes the camera for close-ups.
- Quality tiers live in `src/quality.js`; this game stores its own `derbyTier` and recovers from slow moments instead of staying on low.
- All assets are CC0 / free to use; credits are in `CREDITS.md`. No team logos or league marks.
