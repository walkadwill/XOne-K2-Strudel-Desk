// Primecut Xone:K2 Strudel Desk: sixteen tracks at 122 bpm in E minor, one K2 column per part, 3 layers.
// Reload strudel.cc in Chromium, paste, press Ctrl+Enter. MIDI must be allowed for strudel.cc.
// Push the faders up first: a part stays silent until its fader moves.
//
// LAYER button (bottom left): red = play the parts, orange = DJ EQ, green = tracks.
// Buttons and faders do the same job on every layer; the layer changes what the knobs do.
//
// RED layer (and green)  drums   bass    chords  lead
// top clicky knob        CC 0    CC 1    CC 2    CC 3   turn: track A pattern 1-4; press: back to 1
// top button             48      49      50      51     mute (green playing, red muted)
// second button          44      45      46      47     section: Intro, Groove, Breakdown, Drop
// knob, top row          4       5       6       7      filter (dark to bright)
// knob, middle row       8       9       10      11     reverb
// knob, bottom row       12      13      14      15     echo
// fader                  16      17      18      19     level (every track)
//
// ORANGE layer: DJ EQ    column 1 = the track playing (outgoing), column 2 = the track coming in.
//   top knob = treble, middle knob = mid, bottom knob = bass. Centre and right = full, left = cut.
//   Treble cuts the highs, bass cuts the lows (both with filters), mid turns down the chords and lead.
//   Each track keeps its own EQ, so after a blend the new track's settings carry over.
//   Columns 3 and 4 knobs do nothing on orange.
//   Kill switches (orange only): in columns 1 and 2, top button = treble kill, second = mid kill,
//   third = bass kill, for the outgoing (col 1) and incoming (col 2) track. Press again to bring it back.
//   A kill lights its button on the orange layer. Columns 3 and 4 buttons keep their usual jobs.
//
// Bottom grid A-P = track slots: A B C D = notes 36-39, E-H 32-35, I-L 28-31, M-P 24-27.
//   Tap a letter once: CUE. It plays in the headphones only, in time, so you can check it and set
//   its EQ (orange layer, column 2) before anyone hears it. Tap a different letter to cue that instead.
//   Tap the cued letter again: on the next 4-bar phrase it blends into the speakers over 8 bars,
//   and the headphones go quiet. The bass swaps cleanly at the halfway point.
//   Grid lights: green = playing, red = blending in, amber = cued in the headphones.
//
// Outputs (laptop default output "K2 Split"): Strudel's left channel = HD3s (master, mono),
//   right channel = headphones (cue, mono). Reload strudel.cc before pasting: Strudel fixes each
//   lane's outputs the first time it plays.
//
//   A Cry desk         909 house, the four-pattern track (clicky knobs pick its patterns)
//   B Night drive      808, rolling sub, plucked 7ths
//   C Low tide         dub techno: Korg KR-55, chord stab drowned in echo
//   D Glass cathedral  piano pulse, strings and cello over a soft Akai MPC60 beat
//   E Northern lights  melancholy synth-pop: Korg DDM-110, string machine, square arp, choir lead
//   F Acid rain        Roland 909 with a 303-style acid line that opens and closes over 8 bars
//   G Liquid           broken 2-step: Akai MPC60, electric piano 7ths, bell lead
//   H Coastline        bossa dub: Roland 707 clave, nylon guitar, vibraphone
//   I Carbon           ambient psy: 909, rolling sub, halo pad, kalimba
//   J Slow light       crunchy 808, repeated piano chords, saw swell
//   K Tape garden      Korg Minipops, wobbling detuned pad, lo-fi lead
//   L Han river 4am    deep house: Roland 626, electric piano, koto in E minor pentatonic
//   M Long night       progressive: 909, Moog-style fat bass, sweep pad, pluck arp, strings
//   N Bare wire        minimal: Roland 606, one stab, one blip
//   O Baroque engine   Roland R-8 house under harpsichord, cello and violin
//   P Last ferry       downtempo closer: Akai MPC60, choir and strings, piano
//
// Every track is 122 bpm, 4-bar cycles, E minor, so any letter blends into any other (Camelot 9A).
// Patterns, sections and blends all start on a bar line, so nothing cuts a bar in half.
// K2 sends on MIDI channel 14.
// The Layer button sends note 12 (to orange), 16 (to green), 20 (to red), and adds 36 / 72 to button notes.

setcpm(122 / 4) // one cycle = one bar
const BAR = 240 / 122 // seconds per bar
const BLEND_BARS = 8

// Which layers play in each section (1 = on). Mutes and faders still apply on top.
//                 kick  tops  bass  chords  lead
const SECTIONS = [
  /* Intro     */ [1,    0,    0,    1,      0],
  /* Groove    */ [1,    1,    1,    1,      0],
  /* Breakdown */ [0,    0,    0,    1,      1],
  /* Drop      */ [1,    1,    1,    1,      1],
]

// State lives on globalThis so pressing Ctrl+Enter again keeps your settings and adds no second listener.
const K2 = (globalThis.__k2v6 ??= {
  muted: [false, false, false, false], out: null, wired: false, sw: {},
  deck: { cur: 0, to: null, start: null, timer: null },
  layer: 'red', knob: {}, fader: {}, eq: {}, cue: null,
})

K2.preview ??= null // the slot playing in the headphones, or null
const send = (msg) => K2.out && K2.out.send(msg)
const setLight = (note, colour) => { // colour: null (off), 0 red, 36 amber, 72 green
  for (const c of [0, 36, 72]) send([0x8d, note + c, 0])
  if (colour !== null) send([0x9d, note + colour, 127])
}
const nowBars = () => { try { return Number(getTime()) } catch (e) { return 0 } }

// A switcher holds a choice that only changes on a bar line. A press reads Strudel's playback
// clock, queues the change for the next bar and commits it with a timer; Strudel only reads it.
const switcher = (name, initial, show) => {
  const s = (K2.sw[name] ??= { cur: initial, next: null, at: null, timer: null })
  s.show = show
  s.target = () => (s.next !== null ? s.next : s.cur)
  s.queue = (v) => {
    clearTimeout(s.timer)
    const now = nowBars()
    if (v === s.cur) { s.next = null; s.at = null; s.show(); return }
    s.next = v
    s.at = Math.floor(now) + 1
    s.show()
    s.timer = setTimeout(() => { s.cur = s.next; s.next = null; s.at = null; s.show() }, (s.at - now) * BAR * 1000 + 50)
  }
  s.valueAt = (t) => (s.next !== null && s.at !== null && Number(t) >= s.at ? s.next : s.cur)
  return s
}

const section = switcher('section', 1, () => {
  for (let i = 0; i < 4; i++) setLight(44 + i, i === section.cur ? 72 : i === section.next ? 0 : null)
})
const pattern = [0, 1, 2, 3].map((part) =>
  switcher('pattern' + part, 0, () => setLight(52 + part, [null, 0, 36, 72][pattern[part].target()])))
const lightMute = (part) => setLight(48 + part, K2.muted[part] ? 0 : 72)

// ---- Track slots and the 8-bar blend ----
const SLOT_NAMES = ['Cry desk', 'Night drive', 'Low tide', 'Glass cathedral', 'Northern lights', 'Acid rain',
  'Liquid', 'Coastline', 'Carbon', 'Slow light', 'Tape garden', 'Han river 4am', 'Long night', 'Bare wire',
  'Baroque engine', 'Last ferry'] // A-P
const slotNote = (i) => 36 - 4 * Math.floor(i / 4) + (i % 4)
const slotOf = (note) => { for (let i = 0; i < 16; i++) if (slotNote(i) === note) return i; return -1 }
const showSlots = () => {
  const d = K2.deck
  for (let i = 0; i < 16; i++) {
    const colour = i === d.cur ? 72 : i === d.to ? 0 : i === K2.preview ? 36 : null
    setLight(slotNote(i), colour)
  }
  if (K2.showKills) K2.showKills() // outgoing and incoming may have changed
}
const loadSlot = (i) => {
  const d = K2.deck
  const now = nowBars()
  // A blend whose 8 bars are over counts as finished even if its timer never fired.
  if (d.to !== null && d.start !== null && now >= d.start + BLEND_BARS) { d.cur = d.to; d.to = null; d.start = null; showSlots() }
  if (i < 0 || i >= SLOT_NAMES.length || i === d.cur) return
  K2.cue = i
  if (K2.preview !== i) { K2.preview = i; showSlots(); return } // first tap: cue it
  if (d.to !== null) return // a blend is already running; the cue stays
  K2.preview = null // second tap: blend it in
  d.to = i
  d.start = Math.floor(now / 4) * 4 + 4 // next 4-bar phrase
  showSlots()
  clearTimeout(d.timer)
  d.timer = setTimeout(() => { d.cur = d.to; d.to = null; d.start = null; showSlots() },
    (d.start + BLEND_BARS - now) * BAR * 1000 + 50)
}
// The track coming in: the one blending in, else the last letter pressed, else the next loaded slot.
const incoming = () => {
  const d = K2.deck
  if (d.to !== null) return d.to
  if (K2.cue !== null && K2.cue !== d.cur) return K2.cue
  return (d.cur + 1) % SLOT_NAMES.length
}
// How loud track `track` is for part `part` at bar t: 1 or 0 outside a blend; during one,
// an equal-power fade for drums, chords and lead, and a clean swap at halfway for the bass.
const mixWeight = (track, part, t) => {
  const d = K2.deck, T = Number(t)
  if (d.to === null || d.start === null || T < d.start) return track === d.cur ? 1 : 0
  const u = Math.min(1, (T - d.start) / BLEND_BARS)
  if (track === d.cur) return part === 1 ? (u < 0.5 ? 1 : 0) : Math.cos(u * Math.PI / 2)
  if (track === d.to) return part === 1 ? (u < 0.5 ? 0 : 1) : Math.sin(u * Math.PI / 2)
  return 0
}

// ---- Knobs, faders and EQ, read straight from the K2 ----
const eqOf = (track) => (K2.eq[track] ??= { treble: 0.5, mid: 0.5, bass: 0.5, kill: { treble: false, mid: false, bass: false } })
const KILL_ROW = { 48: 'treble', 44: 'mid', 40: 'bass' } // first note of each button row
// Kill-switch lights live on the orange layer (note + 36), so they never touch the red layer's lights.
const showKills = () => {
  const tracks = [K2.deck.cur, incoming()]
  for (const [base, band] of Object.entries(KILL_ROW))
    for (let c = 0; c < 2; c++) send([0x9d, Number(base) + c + 36, eqOf(tracks[c]).kill[band] ? 127 : 0])
}
const EQ_BAND = { 0: 'treble', 1: 'mid', 2: 'bass' } // knob row
const knob = (cc, dflt = 0) => K2.knob[cc] ?? dflt

if (!K2.wired) {
  const access = await navigator.requestMIDIAccess()
  K2.out = [...access.outputs.values()].find((o) => o.name.includes('XONE')) ?? null
  for (const input of access.inputs.values()) {
    if (!input.name.includes('XONE')) continue
    input.addEventListener('midimessage', (e) => K2.onMidi(e.data))
  }
  K2.wired = true
}
// Re-pointed on every Ctrl+Enter, so edits to the handling below take effect without a reload.
K2.onMidi = ([status, raw, val]) => {
  const kind = status & 0xf0
  if (kind === 0x90 && val > 0) {
    if (raw === 12) { K2.layer = 'orange'; return }
    if (raw === 16) { K2.layer = 'green'; return }
    if (raw === 20) { K2.layer = 'red'; return }
    // Buttons do the same job on every layer: fold the +36 / +72 the layer adds back off.
    const num = raw >= 96 ? raw - 72 : raw >= 60 ? raw - 36 : raw
    // Except on orange, where the first three buttons of columns 1 and 2 are EQ kill switches.
    const onOrange = raw >= 60 && raw < 96
    const killBase = num >= 48 && num <= 49 ? 48 : num >= 44 && num <= 45 ? 44 : num >= 40 && num <= 41 ? 40 : null
    if (onOrange && killBase !== null) {
      const c = num - killBase, band = KILL_ROW[killBase]
      const eq = eqOf(c === 0 ? K2.deck.cur : incoming())
      eq.kill[band] = !eq.kill[band]
      showKills()
      return
    }
    if (num >= 48 && num <= 51) { const p = num - 48; K2.muted[p] = !K2.muted[p]; lightMute(p) }
    else if (num >= 44 && num <= 47) section.queue(num - 44)
    else if (num >= 52 && num <= 55) pattern[num - 52].queue(0)            // press clicky knob: pattern 1
    else if (num >= 24 && num <= 39) loadSlot(slotOf(num))                    // A-P grid
  } else if (kind === 0xb0) {
    const v = val / 127
    if (raw <= 3) {                                                           // turn clicky knob
      const step = val === 1 ? 1 : val === 127 ? -1 : 0
      const p = pattern[raw]
      p.queue(Math.max(0, Math.min(3, p.target() + step)))
    } else if (raw >= 16 && raw <= 19) K2.fader[raw] = v                      // faders: every layer
    else if (raw >= 4 && raw <= 15) {
      if (K2.layer === 'orange') {
        const col = (raw - 4) % 4, row = Math.floor((raw - 4) / 4)
        if (col === 0) eqOf(K2.deck.cur)[EQ_BAND[row]] = v                    // outgoing
        else if (col === 1) eqOf(incoming())[EQ_BAND[row]] = v               // incoming
      } else K2.knob[raw] = v                                                 // red / green
    }
  }
}
K2.showKills = showKills
;[0, 1, 2, 3].forEach(lightMute)
section.show()
pattern.forEach((p) => p.show())
showSlots()

// Filter for one track's part: the red-layer filter knob, then the track's treble cut on top.
// The desk only ever closes a sound's own filter further, so a track's built-in filters (the acid
// sweep, a dark bass) survive with the knobs fully open.
const lowHz = (track, part) => {
  const knobHz = 250 + knob(4 + part, 1) * (16000 - 250) // starts open until the knob moves
  const eq = eqOf(track), t = eq.treble
  const trebleHz = eq.kill.treble ? 600 : t >= 0.5 ? 20000 : 800 + (t / 0.5) * (20000 - 800)
  return Math.min(knobHz, trebleHz)
}
const highHz = (track) => {
  const eq = eqOf(track), b = eq.bass
  return eq.kill.bass ? 400 : b >= 0.5 ? 20 : 20 + ((0.5 - b) / 0.5) * 780
}
const midLevel = (track, part) => {
  const eq = eqOf(track)
  return part >= 2 ? (eq.kill.mid ? 0 : Math.min(1, eq.mid / 0.5)) : 1
}
const eqd = (pat, track, part) => pat.withValue((v) => ({
  ...v,
  cutoff: Math.min(v.cutoff ?? 20000, lowHz(track, part)),
  hcutoff: Math.max(v.hcutoff ?? 0, highHz(track)),
}))

// Gates: section layer on, times blend weight and the mid EQ. Track A also checks its chosen pattern.
// Silent notes are dropped, so the fifteen tracks that aren't playing cost the browser nothing.
const live = (pat) => pat.filterHaps((h) => (h.value.velocity ?? 1) > 0)
const gateA = (layer, part, v) => signal((t) =>
  SECTIONS[section.valueAt(t)][layer] * (pattern[part].valueAt(t) === v ? 1 : 0) * mixWeight(0, part, t) * midLevel(0, part))
const gate = (track, layer, part) => signal((t) =>
  SECTIONS[section.valueAt(t)][layer] * mixWeight(track, part, t) * midLevel(track, part))
const cueOn = (track) => (K2.preview === track ? 1 : 0)
const cueGateA = (layer, part, v) => signal((t) =>
  SECTIONS[section.valueAt(t)][layer] * (pattern[part].valueAt(t) === v ? 1 : 0) * cueOn(0) * midLevel(0, part))
const cueGate = (track, layer, part) => signal((t) =>
  SECTIONS[section.valueAt(t)][layer] * cueOn(track) * midLevel(track, part))

// One column of the K2 per part: level and mute, then reverb and echo, which only ever add to a
// sound's own (so a dub track keeps its echo with the knob at zero).
const col = (pat, i) => pat.withValue((v) => ({
  ...v,
  postgain: (v.postgain ?? 1) * (K2.fader[16 + i] ?? 0) * 1.1 * (K2.muted[i] ? 0 : 1),
  room: Math.max(v.room ?? 0, knob(8 + i)),
  delay: Math.max(v.delay ?? 0, knob(12 + i) * 0.6),
  delaytime: v.delaytime ?? 0.375,
  delayfeedback: v.delayfeedback ?? 0.45,
}))

// ======== Track A: "Cry desk" ========
// drums [kick, tops]: 1 straight, 2 broken, 3 half-time, 4 driving.
const DRUMS_A = [
  ["bd*4",               "~ cp, [~ hh]*4, ~ ~ ~ oh"],
  ["bd ~ ~ bd ~ ~ bd ~", "~ cp, hh*8"],
  ["bd ~ ~ ~ ~ ~ ~ ~",   "~ ~ cp ~, [~ hh]*4"],
  ["bd*4, ~ ~ ~ [~ bd]", "~ cp, hh*16, [~ oh]*2, ~ rim ~ rim"],
]
const drumsAWith = (g) => stack(...DRUMS_A.flatMap(([kick, tops], v) => [
  live(s(kick).bank("RolandTR909").gain(0.9).velocity(g(0, 0, v))),
  live(s(tops).bank("RolandTR909").gain(0.9).velocity(g(1, 0, v))),
]))
const drumsA = drumsAWith(gateA)

// bass: 1 off-beat, 2 rolling, 3 octave jumps, 4 long sub.
const ROOTS = "<e2 c2 a1 b1>"
const bassA = [
  note(ROOTS).struct("[~ x]*4").s("sawtooth").lpq(6).decay(0.15).sustain(0),
  note(ROOTS).struct("~ x x x ~ x x x ~ x x x ~ x x x").s("sawtooth").lpq(6).decay(0.1).sustain(0).gain(0.8),
  note("<[~ e2 ~ e3]*2 [~ c2 ~ c3]*2 [~ a1 ~ a2]*2 [~ b1 ~ b2]*2>").s("sawtooth").lpq(6).decay(0.15).sustain(0),
  note("<e1 c1 a0 b0>").s("sine").attack(0.05).release(0.4).gain(1.2),
]

// chords, Em C Am B: 1 pad, 2 off-beat stabs, 3 syncopated stabs, 4 arpeggio.
const CHORDS = "<[e3,g3,b3] [c3,e3,g3] [a2,c3,e3] [b2,d#3,f#3]>"
const chordsA = [
  note(CHORDS).s("sawtooth").attack(0.4).release(1.2).gain(0.35),
  note(CHORDS).struct("[~ x]*4").s("sawtooth").decay(0.12).sustain(0).gain(0.3),
  note(CHORDS).struct("x ~ ~ x ~ ~ x ~").s("sawtooth").decay(0.2).sustain(0).gain(0.3),
  note("<[e3,g3,b3,e4] [c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d#3,f#3,b3]>").arp("0 1 2 3 2 1 2 3")
    .s("triangle").decay(0.18).sustain(0).gain(0.4),
]

// lead, chord tones on each bar: 1 sparse, 2 answer phrase, 3 high arpeggio, 4 long tones.
const leadA = [
  n("<[0 ~ ~ 2] [~ 4 ~ 3] [2 ~ ~ ~] [~ ~ 1 ~]>").scale("E4:minor").s("triangle").attack(0.05).release(0.6).gain(0.5),
  n("<[4 ~ 2 ~] [7 ~ ~ 5] [~ 3 5 ~] [4 ~ 1 ~]>").scale("E4:minor").s("triangle").attack(0.05).release(0.6).gain(0.5),
  n("<[0 2 4 2] [7 5 2 5] [3 5 7 5] [4 1 4 1]>").scale("E5:minor").s("triangle").decay(0.15).sustain(0).gain(0.35),
  n("<0 7 3 4>").scale("E4:minor").s("triangle").attack(0.3).release(1.5).gain(0.45),
]
const gatedA = (pats, layer, part, g = gateA) => stack(...pats.map((p, v) => live(p.velocity(g(layer, part, v)))))

// ======== Tracks B-P ========
// Each one: kick and tops (drums column), bass, chords, lead. Same tempo, same key, same 4-bar cycle.
// Chord names in the comments; every lead note is checked against the chord under it.
const TRACKS = [
  null, // A is built above

  // B "Night drive": Em C Am B. 808 with 16th hats, rolling triangle sub, plucked 7ths, a high sung line.
  {
    kick: s("bd*4").bank("RolandTR808").gain(0.95),
    tops: stack(s("~ ~ ~ rim, [~ hh]*4, ~ cp ~ ~").bank("RolandTR808").gain(0.95),
      s("hh*16").bank("RolandTR808").gain("[.2 .45]*8")),
    bass: note("<e1 c1 a0 b0>").add(note("<12 12 24 12>")).struct("x ~ x x ~ x x ~ x ~ x x ~ x x ~")
      .s("triangle").decay(0.12).sustain(0.2).release(0.1).gain(1.1),
    chords: note("<[e3,b3,d4,g4] [c3,g3,b3,e4] [a2,e3,g3,c4] [b2,f#3,a3,d#4]>")
      .struct("x ~ x ~ ~ x ~ x").s("square").decay(0.25).sustain(0).gain(0.22),
    lead: n("<[7 ~ ~ ~ 5 ~ 4 ~] [4 ~ ~ ~ 2 ~ 0 ~] [~ ~ 3 ~ 5 ~ 7 ~] [8 ~ ~ ~ ~ ~ 4 ~]>")
      .scale("E4:minor").s("sine").attack(0.08).release(0.9).gain(0.6),
  },

  // C "Low tide": Em7 Em7 Cmaj7 D. Dub techno. Korg KR-55, one chord stab drowned in its own echo.
  {
    kick: s("bd*4").bank("KorgKR55").gain(1),
    tops: s("[~ hh]*4, ~ ~ ~ [~ rim], ~ ~ ~ ~ ~ ~ ~ [~ oh]").bank("KorgKR55").gain(0.5),
    bass: note("<e1 e1 c1 d1>").struct("x ~ ~ x ~ ~ x ~").s("sine").decay(0.4).sustain(0.3).gain(1.1),
    chords: note("<[e3,g3,b3,d4] [e3,g3,b3,d4] [c3,e3,g3,b3] [d3,f#3,a3,d4]>").struct("~ x ~ ~ ~ ~ x ~")
      .s("sawtooth").lpf(1400).decay(0.2).sustain(0).gain(0.28)
      .room(0.5).delay(0.55).delaytime(0.375).delayfeedback(0.62),
    lead: n("<[~ ~ 4 ~] ~ [~ ~ ~ 2] [~ 1 ~ ~]>").scale("E5:minor").s("sine").attack(0.02).release(0.5)
      .gain(0.35).delay(0.5).delaytime(0.5).delayfeedback(0.5),
  },

  // D "Glass cathedral": Em C G D. Piano pulse in eighths, string bed, a cello carrying the line.
  {
    kick: s("bd ~ bd ~").bank("AkaiMPC60").gain(0.75),
    tops: s("hh*8").bank("AkaiMPC60").gain("[.18 .3]*4"),
    bass: note("<e1 c1 g1 d1>").s("sine").attack(0.1).release(0.8).gain(1),
    chords: stack(
      note("<[e3,g3,b3] [c3,e3,g3] [g2,b2,d3] [d3,f#3,a3]>").struct("x*8").s("gm_piano").gain(0.4),
      note("<[e3,b3,g4] [c3,g3,e4] [g2,d3,b3] [d3,a3,f#4]>").s("gm_string_ensemble_1").attack(0.6).release(1.5).gain(0.35),
    ),
    lead: n("<[4 ~ 3 ~] [2 ~ ~ ~] [4 ~ 5 ~] [3 ~ 1 ~]>").scale("E3:minor").s("gm_cello")
      .attack(0.2).release(1).gain(0.7),
  },

  // E "Northern lights": Em D C Am. Melancholy synth-pop: Korg DDM-110, string machine, square arp, choir lead.
  {
    kick: s("bd*4").bank("KorgDDM110").gain(0.95),
    tops: s("~ cp, [~ hh]*4, hh*16").bank("KorgDDM110").gain(0.45),
    bass: note("<e2 d2 c2 a1>").struct("x ~ x ~ x ~ x x").s("square").lpf(600).decay(0.2).sustain(0.3).gain(0.65),
    chords: stack(
      note("<[e3,g3,b3] [d3,f#3,a3] [c3,e3,g3] [a2,c3,e3]>").s("gm_synth_strings_1").attack(0.5).release(1.5).gain(0.4),
      note("<[e4,g4,b4] [d4,f#4,a4] [c4,e4,g4] [a3,c4,e4]>").arp("0 1 2 1 0 1 2 1").s("square")
        .lpf(2500).decay(0.12).sustain(0).gain(0.16).delay(0.3),
    ),
    lead: n("<[7 ~ ~ 6] [8 ~ ~ ~] [4 ~ 2 ~] [2 ~ 0 ~]>").scale("E4:minor").s("gm_lead_6_voice")
      .attack(0.1).release(0.8).gain(0.45),
  },

  // F "Acid rain": Em Em C Em. Roland 909 and a 303-style line whose filter opens and closes over 8 bars.
  {
    kick: s("bd*4").bank("RolandTR909").gain(1),
    tops: stack(s("~ cp, [~ oh]*4").bank("RolandTR909").gain(0.6), s("hh*16").bank("RolandTR909").gain("[.25 .4]*8")),
    bass: note("e1 e2 e1 [e1 g1] e1 d2 e1 [b1 e2]").s("sawtooth")
      .lpf(sine.range(300, 2600).slow(8)).lpq(14).decay(0.15).sustain(0).gain(0.55),
    chords: note("<[e3,g3,b3] [e3,g3,b3] [c3,e3,g3] [e3,g3,b3]>").struct("~ ~ x ~ ~ ~ ~ ~")
      .s("sawtooth").lpf(1800).decay(0.25).sustain(0).gain(0.25).room(0.4),
    lead: n("<[~ ~ ~ ~ 7 ~ ~ ~] ~ [~ ~ 9 ~ ~ ~ 7 ~] ~>").scale("E5:minor").s("square").lpf(1800)
      .decay(0.2).sustain(0.2).gain(0.2).delay(0.4),
  },

  // G "Liquid": Cmaj7 Bm7 Am7 Em9. Broken 2-step on an Akai MPC60, electric piano 7ths, a bell lead.
  {
    kick: s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("AkaiMPC60").gain(1),
    tops: stack(s("~ ~ ~ ~ sd ~ ~ [~ sd] ~ ~ ~ ~ sd ~ ~ ~").bank("AkaiMPC60").gain(0.7),
      s("hh*16").bank("AkaiMPC60").gain("[.2 .35 .25 .35]*4")),
    bass: note("<c2 b1 a1 e1>").struct("x ~ ~ ~ ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~").s("sine")
      .attack(0.02).sustain(0.6).release(0.6).gain(1.1),
    chords: stack(
      note("<[c3,e3,g3,b3] [b2,d3,f#3,a3] [a2,c3,e3,g3] [e3,g3,b3,d4,f#4]>").struct("x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ x ~ ~ ~")
        .s("gm_epiano1").release(1.5).gain(0.5),
      note("<[c3,g3,b3] [b2,f#3,a3] [a2,e3,g3] [e3,b3,d4]>").s("gm_pad_warm").attack(1).release(2).gain(0.25),
    ),
    lead: n("<[4 ~ 2 ~] [3 ~ 1 ~] [2 ~ 0 ~] [~ 6 ~ 4]>").scale("E5:minor").s("gm_vibraphone")
      .gain(0.45).room(0.3),
  },

  // H "Coastline": Em9 Am9 Cmaj7 B7. Bossa dub: Roland 707 clave, nylon guitar, vibraphone.
  {
    kick: s("bd ~ ~ bd bd ~ ~ bd").bank("RolandTR707").gain(0.85),
    tops: stack(s("rim ~ ~ rim ~ ~ rim ~ ~ ~ rim ~ rim ~ ~ ~").bank("RolandTR707").gain(0.55).delay(0.3),
      s("[~ hh]*4").bank("RolandTR707").gain(0.35)),
    bass: note("<e2 a1 c2 b1>").struct("x ~ ~ x ~ ~ x ~").s("triangle").decay(0.3).sustain(0.3).gain(1),
    chords: note("<[e3,g3,b3,d4,f#4] [a2,c3,e3,g3,b3] [c3,e3,g3,b3] [b2,d#3,f#3,a3]>")
      .struct("x ~ ~ x ~ ~ x ~").s("gm_acoustic_guitar_nylon").gain(0.5),
    lead: n("<[7 ~ ~ 4] [~ 5 ~ ~] [4 ~ ~ 2] [~ ~ 3 ~]>").scale("E4:minor").s("gm_vibraphone")
      .gain(0.5).delay(0.35).delaytime(0.375).delayfeedback(0.4),
  },

  // I "Carbon": Em Em C D. Ambient psy: soft 909, rolling sub, halo pad, kalimba answering itself.
  {
    kick: s("bd*4").bank("RolandTR909").gain(0.8),
    tops: s("[~ hh]*4, ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ rim ~").bank("RolandTR909").gain(0.35),
    bass: note("<e1 e1 c1 d1>").struct("~ x x x ~ x x x ~ x x x ~ x x x").s("sine")
      .decay(0.1).sustain(0).gain(1.1),
    chords: note("<[e3,b3,g4] [e3,b3,g4] [c3,g3,e4] [d3,a3,f#4]>").s("gm_pad_halo").attack(1).release(2).gain(0.45),
    lead: n("<[0 ~ 4 ~ 7 ~ 4 ~] [0 ~ 4 ~ 9 ~ 7 ~] [5 ~ 7 ~ 9 ~ ~ ~] [6 ~ 8 ~ 10 ~ ~ ~]>").scale("E4:minor")
      .s("gm_kalimba").gain(0.45).delay(0.4).delaytime(0.375).delayfeedback(0.5),
  },

  // J "Slow light": Em G/D C B. Crunchy Roland 808, repeated piano chords, a slow saw swell on top.
  {
    kick: s("bd ~ ~ bd ~ ~ bd ~, ~ ~ ~ ~ ~ ~ ~ [~ bd]").bank("RolandTR808").shape(0.4).gain(0.8),
    tops: stack(s("~ cp ~ cp").bank("RolandTR808").shape(0.3).gain(0.6), s("hh*8").bank("RolandTR808").gain(0.3)),
    bass: note("<e1 g1 c1 b0>").struct("x ~ ~ ~ x ~ ~ ~").s("sawtooth").lpf(400)
      .attack(0.01).sustain(0.6).release(0.5).shape(0.3).gain(0.6),
    chords: note("<[e3,g3,b3] [d3,g3,b3] [c3,e3,g3] [b2,d#3,f#3]>").struct("x ~ x ~ x x ~ x")
      .s("gm_piano").gain(0.45),
    lead: n("<[7 ~ ~ ~] [9 ~ ~ ~] [9 ~ 7 ~] [8 ~ ~ ~]>").scale("E4:minor").s("sawtooth").lpf(1200)
      .attack(0.6).release(1.5).gain(0.25),
  },

  // K "Tape garden": Em D Cmaj7 D. Korg Minipops, a wobbling detuned pad, a lo-fi lead with tape wow.
  {
    kick: s("bd ~ ~ ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ ~ ~").bank("KorgMinipops").gain(0.9),
    tops: s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~, hh*8").bank("KorgMinipops").gain(0.5),
    bass: note("<e1 d1 c1 d1>").struct("x ~ ~ ~ ~ ~ x ~").s("sine").sustain(0.5).release(0.4).gain(1),
    chords: note("<[e3,g3,b3] [d3,f#3,a3] [c3,e3,g3,b3] [d3,f#3,a3]>").s("sawtooth").vib(3).vibmod(0.12)
      .lpf(900).attack(0.5).release(1.5).gain(0.3),
    lead: n("<[4 ~ 2 ~ ~ ~ ~ ~] [3 ~ ~ ~ 1 ~ ~ ~] [2 ~ 4 ~ ~ ~ ~ ~] [1 ~ ~ ~ ~ ~ ~ ~]>").scale("E4:minor")
      .s("triangle").vib(4).vibmod(0.2).attack(0.05).release(0.8).gain(0.45),
  },

  // L "Han river 4am": Em9 Em9 Cmaj7 D6. Deep house on a Roland 626, electric piano, koto in E minor pentatonic.
  {
    kick: s("bd*4").bank("RolandTR626").gain(0.95),
    tops: s("~ cp, [~ hh]*4, ~ ~ ~ ~ ~ ~ ~ [~ oh]").bank("RolandTR626").gain(0.5),
    bass: note("<e1 e1 c1 d1>").struct("~ x ~ x ~ x x ~").s("sine").decay(0.25).sustain(0.4).gain(1.1),
    chords: note("<[e3,g3,b3,d4,f#4] [e3,g3,b3,d4,f#4] [c3,e3,g3,b3] [d3,f#3,a3,b3]>").struct("~ x ~ ~ ~ x ~ ~")
      .s("gm_epiano1").gain(0.45).room(0.3),
    lead: n("<[4 ~ 3 ~ 1 ~ ~ ~] [~ ~ 4 ~ 7 ~ ~ ~] [6 ~ 4 ~ ~ ~ 3 ~] [~ ~ 7 ~ ~ ~ ~ ~]>")
      .scale("E4:minor pentatonic").s("gm_koto").gain(0.5).room(0.4),
  },

  // M "Long night": Em Em C B7. Progressive: 909, Moog-style fat resonant bass, sweep pad, pluck arp, strings.
  {
    kick: s("bd*4").bank("RolandTR909").gain(1),
    tops: stack(s("~ cp, [~ oh]*4").bank("RolandTR909").gain(0.5), s("hh*16").bank("RolandTR909").gain("[.2 .35]*8")),
    bass: note("<e1 e1 c1 b0>").struct("~ x x x ~ x x x ~ x x x ~ x x x").s("sawtooth")
      .lpf(500).lpq(8).decay(0.12).sustain(0).gain(0.7),
    chords: stack(
      note("<[e3,b3,g4] [e3,b3,g4] [c3,g3,e4] [b2,f#3,d#4]>").s("gm_pad_sweep").attack(1).release(2).gain(0.35),
      note("<[e4,g4,b4] [e4,g4,b4] [c4,e4,g4] [b3,d#4,f#4]>").arp("0 1 2 0 1 2 0 1").s("triangle")
        .decay(0.1).sustain(0).gain(0.25).delay(0.45).delaytime(0.375).delayfeedback(0.5),
    ),
    lead: note("<b4 b4 g4 [f#4 a4]>").s("gm_string_ensemble_1").attack(0.8).release(1.5).gain(0.4),
  },

  // N "Bare wire": Em7 throughout. Minimal: Roland 606, one stab, one blip, lots of space.
  {
    kick: s("bd*4").bank("RolandTR606").gain(1),
    tops: s("[~ hh]*4, ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ lt ~ ~").bank("RolandTR606").gain(0.45),
    bass: note("e1").struct("x ~ ~ x ~ ~ x ~ ~ ~ x ~ ~ ~ ~ ~").s("sine").decay(0.2).sustain(0).gain(1.1),
    chords: note("[e3,b3,d4]").struct("~ ~ x ~ ~ ~ ~ ~").s("square").lpf(1200).decay(0.08).sustain(0).gain(0.25)
      .delay(0.5).delaytime(0.375).delayfeedback(0.55),
    lead: n("<[~ ~ ~ 7] ~ [~ ~ ~ 9] [~ 6 ~ ~]>").scale("E5:minor").s("sine").decay(0.06).sustain(0).gain(0.35),
  },

  // O "Baroque engine": Em C Am B. Roland R-8 house under a harpsichord, walking cello, violin line.
  {
    kick: s("bd*4").bank("RolandR8").gain(0.95),
    tops: s("~ cp, [~ hh]*4").bank("RolandR8").gain(0.5),
    bass: note("<[e2 b1 e2 g2] [c2 g1 c2 e2] [a1 e1 a1 c2] [b1 f#1 b1 d#2]>").s("gm_cello").gain(0.7),
    chords: note("<[e3,g3,b3,e4] [c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d#3,f#3,b3]>").arp("0 1 2 3 2 1 2 3 0 1 2 3 2 1 2 3")
      .s("gm_harpsichord").gain(0.4),
    lead: note("<[e5 d5 e5 b4] [c5 b4 c5 g4] [a4 b4 c5 e5] [d#5 f#5 b4 d#5]>").s("gm_violin")
      .attack(0.05).release(0.4).gain(0.45),
  },

  // P "Last ferry": Em C G D. Downtempo closer: Akai MPC60, choir and strings, piano melody.
  {
    kick: s("bd ~ ~ ~ ~ ~ bd ~").bank("AkaiMPC60").gain(0.85),
    tops: s("~ ~ sd ~, hh*8").bank("AkaiMPC60").gain(0.35),
    bass: note("<e1 c1 g1 d1>").s("sine").attack(0.05).sustain(0.8).release(0.6).gain(1),
    chords: stack(
      note("<[e3,g3,b3] [c3,e3,g3] [g2,b2,d3] [d3,f#3,a3]>").s("gm_choir_aahs").attack(0.8).release(2).gain(0.35),
      note("<[e3,b3,g4] [c3,g3,e4] [g2,d3,b3] [d3,a3,f#4]>").s("gm_string_ensemble_1").attack(1).release(2).gain(0.3),
    ),
    lead: n("<[4 ~ ~ 3 2 ~ ~ ~] [2 ~ ~ 1 0 ~ ~ ~] [~ ~ 4 ~ 2 ~ 1 ~] [1 ~ ~ ~ ~ ~ ~ ~]>").scale("E4:minor")
      .s("gm_piano").gain(0.5).room(0.4),
  },
]

// Gate every part of every track B-P, then lay them out one K2 column per part.
const gatedTracks = (g) => TRACKS.map((t, i) => t && {
  drums: stack(live(t.kick.velocity(g(i, 0, 0))), live(t.tops.velocity(g(i, 1, 0)))),
  bass: live(t.bass.velocity(g(i, 2, 1))),
  chords: live(t.chords.velocity(g(i, 3, 2))),
  lead: live(t.lead.velocity(g(i, 4, 3))),
}).map((parts, i) => parts && Object.fromEntries(
  Object.entries(parts).map(([k, p], j) => [k, eqd(p, i, j)])))
  .filter(Boolean)
const others = gatedTracks(gate)
const cueOthers = gatedTracks(cueGate)
const column = (k, list = others) => list.map((t) => t[k])

// Master: faders, mutes, reverb and echo, to the HD3s. Cue: the cued track before the faders, to the headphones.
const master = stack(
  col(stack(eqd(drumsA, 0, 0), ...column('drums')), 0),
  col(stack(eqd(gatedA(bassA, 2, 1), 0, 1), ...column('bass')), 1),
  col(stack(eqd(gatedA(chordsA, 3, 2), 0, 2), ...column('chords')), 2),
  col(stack(eqd(gatedA(leadA, 4, 3), 0, 3), ...column('lead')), 3),
)
const cue = stack(
  eqd(drumsAWith(cueGateA), 0, 0), ...column('drums', cueOthers),
  eqd(gatedA(bassA, 2, 1, cueGateA), 0, 1), ...column('bass', cueOthers),
  eqd(gatedA(chordsA, 3, 2, cueGateA), 0, 2), ...column('chords', cueOthers),
  eqd(gatedA(leadA, 4, 3, cueGateA), 0, 3), ...column('lead', cueOthers),
)

stack(
  master.orbit(11).channels("1:1"),
  cue.orbit(12).channels("2:2"),
)
