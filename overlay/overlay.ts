// Draws the Primecut K2 desk overlay: one SVG per layer, labels taken from k2-starter.js.
const out = process.argv[2] ?? '.'

const W = 760, H = 1480
const COLS = [0, 1, 2, 3].map((c) => 160 + c * 160)
const PARTS = ['DRUMS', 'BASS', 'CHORDS', 'LEAD']
const SLOTS = ['Cry desk', 'Night drive', 'Low tide', 'Glass cathedral', 'Northern lights', 'Acid rain',
  'Liquid', 'Coastline', 'Carbon', 'Slow light', 'Tape garden', 'Han river 4am', 'Long night', 'Bare wire',
  'Baroque engine', 'Last ferry']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (x: number, y: number, s: string, size = 13, fill = '#e8e8e8', weight = 400, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(s)}</text>`
const lines = (x: number, y: number, ls: string[], size = 12, fill = '#e8e8e8', weight = 400) =>
  ls.map((l, i) => text(x, y + i * (size + 3), l, size, fill, weight)).join('')

type Layer = {
  file: string, name: string, accent: string, subtitle: string,
  encoder: (c: number) => string[], knobs: (row: number, c: number) => string[] | null,
  buttons: (row: number, c: number) => { label: string[], tint?: string } | null,
}

const knob = (x: number, y: number, r: number, label: string[] | null, accent: string, clicky = false) => {
  const on = label !== null
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${on ? '#2a2a2e' : '#1c1c1f'}" stroke="${on ? accent : '#3a3a3f'}" stroke-width="${clicky ? 3 : 2}" ${clicky ? 'stroke-dasharray="4 3"' : ''}/>` +
    `<line x1="${x}" y1="${y - r + 4}" x2="${x}" y2="${y - r / 3}" stroke="${on ? '#fff' : '#555'}" stroke-width="2"/>` +
    (on ? lines(x, y + r + 16, label!, 12) : text(x, y + r + 16, '-', 12, '#555'))
}
const button = (x: number, y: number, label: string[] | null, tint = '#444') => {
  const on = label !== null
  return `<rect x="${x - 58}" y="${y - 20}" width="116" height="40" rx="6" fill="${on ? '#2a2a2e' : '#1c1c1f'}" stroke="${on ? tint : '#3a3a3f'}" stroke-width="2"/>` +
    (on ? lines(x, y + (label!.length === 1 ? 5 : -2), label!, 12) : text(x, y + 5, '-', 12, '#555'))
}

const draw = (L: Layer) => {
  const p: string[] = []
  p.push(`<rect width="${W}" height="${H}" fill="#121214"/>`)
  p.push(`<rect x="40" y="30" width="${W - 80}" height="${H - 60}" rx="22" fill="#18181b" stroke="#333" stroke-width="2"/>`)
  p.push(`<rect x="40" y="30" width="${W - 80}" height="70" rx="22" fill="${L.accent}"/>`)
  p.push(`<rect x="40" y="80" width="${W - 80}" height="20" fill="${L.accent}"/>`)
  p.push(text(W / 2, 64, L.name, 26, '#111', 800))
  p.push(text(W / 2, 90, L.subtitle, 14, '#111', 600))
  COLS.forEach((x, c) => p.push(text(x, 135, PARTS[c], 15, L.accent, 800)))

  // Clicky encoders
  COLS.forEach((x, c) => p.push(knob(x, 180, 26, L.encoder(c), L.accent, true)))
  // Three rows of knobs
  for (let row = 0; row < 3; row++) COLS.forEach((x, c) => p.push(knob(x, 290 + row * 105, 24, L.knobs(row, c), L.accent)))
  // Three rows of buttons
  for (let row = 0; row < 3; row++) COLS.forEach((x, c) => {
    const b = L.buttons(row, c)
    p.push(button(x, 620 + row * 58, b ? b.label : null, b?.tint ?? L.accent))
  })
  // Faders
  COLS.forEach((x) => {
    p.push(`<rect x="${x - 4}" y="800" width="8" height="200" rx="4" fill="#0c0c0e" stroke="#333"/>`)
    p.push(`<rect x="${x - 26}" y="900" width="52" height="24" rx="4" fill="#3a3a40" stroke="#888"/>`)
    p.push(text(x, 1022, 'LEVEL', 12, '#e8e8e8', 600))
  })
  p.push(text(W / 2, 1045, 'Faders work on every layer. A part stays silent until its fader moves.', 12, '#999'))

  // A-P grid
  p.push(text(W / 2, 1078, 'TRACKS: tap once to cue in headphones, tap again to blend in', 13, '#e8e8e8', 700))
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const i = r * 4 + c, x = COLS[c], y = 1112 + r * 58
    p.push(`<rect x="${x - 70}" y="${y - 22}" width="140" height="46" rx="6" fill="#2a2a2e" stroke="#666" stroke-width="1.5"/>`)
    p.push(text(x - 58, y + 6, String.fromCharCode(65 + i), 18, L.accent, 800, 'start'))
    p.push(text(x + 8, y + 5, SLOTS[i], 11, '#e8e8e8'))
  }
  // Lights legend
  const ly = 1355
  ;[['#3c3', 'playing'], ['#e33', 'blending in'], ['#e9a23b', 'cued in headphones']].forEach(([col, lab], i) => {
    const x = 170 + i * 170
    p.push(`<circle cx="${x}" cy="${ly}" r="7" fill="${col}"/>` + text(x + 14, ly + 4, lab, 12, '#ccc', 400, 'start'))
  })
  // Bottom row
  p.push(button(COLS[0], 1405, ['LAYER', 'red / orange / green'], L.accent))
  p.push(knob(COLS[1], 1405, 18, null, L.accent))
  p.push(knob(COLS[2], 1405, 18, null, L.accent))
  p.push(button(COLS[3], 1405, null))
  p.push(text(W / 2, 1462, 'Primecut K2 desk for Strudel · draft overlay', 11, '#777'))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Liberation Sans, Nimbus Sans, sans-serif">${p.join('')}</svg>`
}

const playLayer = (name: string, accent: string, subtitle: string, file: string): Layer => ({
  file, name, accent, subtitle,
  encoder: () => ['turn: pattern 1-4', 'press: back to 1'],
  knobs: (row) => [['FILTER', 'dark to bright'], ['REVERB'], ['ECHO']][row],
  buttons: (row) => row === 0 ? { label: ['MUTE'], tint: '#3c3' } : row === 1 ? { label: ['SECTION', ['Intro', 'Groove', 'Breakdown', 'Drop'][0]] } : null,
})

const layers: Layer[] = [
  {
    ...playLayer('RED LAYER: PLAY', '#e5484d', 'Shape each part: filter, reverb, echo. Green layer does the same.', 'k2-overlay-red.svg'),
    buttons: (row, c) => row === 0 ? { label: ['MUTE', 'green on / red muted'], tint: '#3c3' }
      : row === 1 ? { label: ['SECTION', ['Intro', 'Groove', 'Breakdown', 'Drop'][c]] } : null,
  },
  {
    file: 'k2-overlay-orange.svg', name: 'ORANGE LAYER: DJ EQ', accent: '#f0a03c',
    subtitle: 'Column 1 = track playing (out) · Column 2 = track coming in',
    encoder: () => ['turn: pattern 1-4', 'press: back to 1'],
    knobs: (row, c) => c > 1 ? null : [[c === 0 ? 'OUT TREBLE' : 'IN TREBLE'], [c === 0 ? 'OUT MID' : 'IN MID'], [c === 0 ? 'OUT BASS' : 'IN BASS']][row].concat(['left = cut']),
    buttons: (row, c) => c <= 1
      ? { label: [['TREBLE KILL', 'MID KILL', 'BASS KILL'][row], c === 0 ? 'outgoing' : 'incoming'], tint: '#f0a03c' }
      : row === 0 ? { label: ['MUTE'], tint: '#3c3' } : row === 1 ? { label: ['SECTION', ['Intro', 'Groove', 'Breakdown', 'Drop'][c]] } : null,
  },
]

for (const L of layers) await Bun.write(`${out}/${L.file}`, draw(L))
console.log('wrote', layers.map((l) => l.file).join(', '))
