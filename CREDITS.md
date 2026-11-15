# ZKIDZ credits

## Background music

All four loops are licensed [CC0 1.0 (public domain)](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not required; we list the authors and sources here with thanks.

| In-game use | Track | Author | License | Source | Length |
|---|---|---|---|---|---|
| Lobby, Closet, and Shop | [Underwater Ambient Pad](https://opengameart.org/content/underwater-ambient-pad) | isaiah658 | CC0 | https://opengameart.org/content/underwater-ambient-pad | 0:17 |
| Maze and Match Cards | [Happy Vibes](https://opengameart.org/content/happy-vibes) | Ruskerdax | CC0 | https://opengameart.org/content/happy-vibes | 0:45 |
| Race | [Frenzied Swimming](https://opengameart.org/content/frenzied-swimming) | Some Weirdo | CC0 | https://opengameart.org/content/frenzied-swimming | 1:04 |
| Reef Sort | [Aquaria](https://opengameart.org/content/aquaria) | cynicmusic | CC0 | https://opengameart.org/content/aquaria | 0:44 |

Files live in `audio/` as mono 44.1 kHz loops in three formats: AAC `.m4a` (preferred on iPhone/iPad Safari), MP3, and OGG Vorbis. The game picks a format with `canPlayType`.

The single-file `zkidz-standalone.html` does **not** embed these tracks, so the file stays smaller. When you open it from the game folder (or the live site), it loads `audio/` next to the page (m4a/mp3/ogg). If you open the HTML file by itself, it falls back to the hosted copies at https://zgrokbotz.github.io/zkidz/audio/.
