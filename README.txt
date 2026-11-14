ZKIDZ – Ocean Maze prototype
- Easiest: open zkidz-standalone.html directly in Chrome/Safari/Edge (single file, works offline from disk).
- Or serve the folder: python3 -m http.server 8765  → http://localhost:8765/ (index.html + game.js + style.css + vendor/three).
Controls: Desktop WASD/arrows move, mouse looks (click to lock, or drag), Space/Shift dash, Q/E rotate camera, Esc pause.
Mobile: thumb joystick bottom-left, red dash button bottom-right, drag empty screen to look around.
Progress saves in the browser (localStorage).

Economy v1 (Zokenomics): see economy.js (adapted from /workspace/zokenomics/chest-dropin.js).
Level-band odds, pity on free maze chests, milestone chests (5/10/20/30/40/50), first chest >= Uncommon,
2 free maze chests + 2 shop chests per day (shop sells Common/Uncommon/Rare only: 150/280/500),
maze starfish credited up to 10+2*min(level,10) (+10 finish), race up to 18 (+10), half pay after 3 activities/day,
+10 daily hello (no streaks), duplicates -> 40% refund + shell shard (or collector bonus once a tier is complete),
8 shards -> kid picks a missing prize. Odds button on the Chests panel.
