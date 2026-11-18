# Notes for Claude (or any coding agent)

The whole desk is one Strudel program, `k2-desk.js`. You can't reach the K2 from a terminal: the K2 talks to the browser over Web MIDI, and Strudel makes the sound. Your job is to edit the code. The person tests by pasting it into strudel.cc and pressing Ctrl+Enter.

## Lessons from building it (each one cost real time)

- **A part is silent until its fader moves.** Before blaming MIDI or audio routing for "no sound", ask whether the faders are up.
- **Strudel fixes a lane's outputs (orbit and channels) the first time it plays.** After changing `.channels()` or the output device, reload strudel.cc before testing again, or the old routing stays.
- **Channel numbers start at 1 and wrap around** the number of outputs the browser opened. On a 2-output stream, `"3:4"` plays on 1–2, so it can land in the headphones without any error. Check `new AudioContext().destination.maxChannelCount` first.
- **Test routing by ear, one beep per channel pair**, before touching the desk. Logs and meters have misled us before; what the person hears decides.
- **On Linux, browsers give Strudel only 2 channels**, so the desk sends the master as mono left and the cue as mono right, then a PipeWire loopback splits them (see the README). For macOS, see `MACOS.md`.
- **The K2 is on MIDI channel 14.** The Layer button sends note 12 (orange), 16 (green) or 20 (red), and switching layer shifts the button notes by 36 or 72 (see the comment near the top of `k2-desk.js`). The desk listens to any input whose name contains `XONE`.
- **Desk state lives on `globalThis`**, so pressing Ctrl+Enter again keeps the settings and doesn't add a second MIDI listener. If you change the shape of that state, change its key too, or old state carries over.

## Musical rules

- Every track is 122 bpm in E minor (Camelot 9A), on 4-bar cycles. Breaking that breaks the blends.
- Patterns, sections and blends start on a bar line. A blend runs 8 bars and starts on the next 4-bar phrase.
- The knobs only ever close a sound's own filter and only add to its own reverb and echo, so a track's built-in sweeps survive with the knobs at rest.

## Before handing a change back

- Run the file through `@strudel/transpiler` and `@strudel/core` with a fake K2 if you can, and check that every track still makes events.
- Say plainly what you tested and what still needs ears on a real K2.
