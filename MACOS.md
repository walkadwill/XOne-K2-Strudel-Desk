# Running the desk on macOS

The desk was built and played on Linux. Nobody has tried it on macOS yet, so this page sets out what we know, what we expect to change, and how to test it in a few minutes.

## What's proven (on Linux, with a real K2)

- The K2 sends MIDI on **channel 14**, its factory default. The desk listens to any MIDI input whose name contains `XONE`.
- The K2's sound card has two stereo pairs. The **front pair (outputs 1–2) is the headphone jack**. The **rear pair (outputs 3–4) is the main outputs** to your speakers.
- In Strudel, `.channels()` numbers start at 1. A value above the number of outputs the browser opened wraps back around, so on a 2-output stream `"3:4"` plays on 1–2.
- Strudel fixes a lane's outputs the first time it plays. After changing outputs or devices, **reload strudel.cc** before pasting the desk again.

## Why Linux needed a workaround

On Linux, Chrome and Firefox gave Strudel only **2 output channels**, even with the K2 set as a 4-channel device. So the desk sends everything mono instead: the master on the left channel and the cue on the right. A small PipeWire loopback then sends the left channel to the rear pair and the right channel to the front pair (see the README). That is the reason for these two lines at the end of `k2-desk.js`:

```js
master.orbit(11).channels("1:1"),
cue.orbit(12).channels("2:2"),
```

## What we expect on macOS (untested)

CoreAudio usually shows a multichannel USB interface to Chrome with all its outputs. If Chrome gives Strudel all **4** of the K2's channels, there is no need for the loopback, and the cue and the master can both stay in stereo:

```js
master.orbit(11).channels("3:4"),   // rear pair: speakers
cue.orbit(12).channels("1:2"),      // front pair: headphones
```

If Chrome gives Strudel only 2 channels, those values wrap and **everything plays in the headphones**. In that case, use an aggregate or loopback device such as BlackHole to split the channels, the same way the Linux loopback does.

## Two-minute test

1. Plug in the K2. In **Audio MIDI Setup**, check that the K2 shows **4 output channels**. In **System Settings → Sound → Output**, choose the K2.
2. Open strudel.cc in Chrome. Open the developer console (⌥⌘J) and run:
   ```js
   new AudioContext().destination.maxChannelCount
   ```
   **4** means the direct route should work. **2** means you need the aggregate device.
3. Reload strudel.cc and play this. It sends a low beep to outputs 1–2 and a high beep to outputs 3–4:
   ```js
   stack(
     note("c3*2").s("sine").orbit(5).channels("1:2"),
     note("c5*2").s("sine").orbit(6).channels("3:4"),
   )
   ```
   The low beep should be in the headphones only, and the high beep on the speakers only. If they're the other way round, swap the two channel values in the desk.
4. Change the last two lines of `k2-desk.js` to the macOS version above. Reload, paste, push the faders up, and tap a letter once. It should play in the headphones only.

## Also check

- Chrome asks for MIDI permission the first time. Safari has no Web MIDI, so use Chrome or another Chromium browser.
- The K2's MIDI input name on macOS may differ from Linux. If the knobs do nothing, run `navigator.requestMIDIAccess().then(a => [...a.inputs.values()].map(i => i.name))` in the console and check that the name contains `XONE`.

If it works, please open an issue or a pull request with what you found, and we'll make the macOS lines the default there.
