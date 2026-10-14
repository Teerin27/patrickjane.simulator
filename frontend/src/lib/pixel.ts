/** The three hand-drawn portraits. Any other suspect id is drawn as the 'generic' figure. */
export type Look = 'lorraine' | 'pike' | 'doyle'
export type Mood = 'calm' | 'nervous' | 'angry' | 'broken'
export type Px = (string | null)[]
type Fn = (x: number, y: number) => boolean

export const W = 64
export const K = '#1A1414'
const chk = (x: number, y: number) => (x + y) % 2 === 0

const SKIN: Record<Look, string[]> = {
  lorraine: ['#E0A98A', '#B87A5E', '#8A5240'],
  pike: ['#E0A98A', '#B87A5E', '#8A5240'],
  doyle: ['#C68B66', '#9A6248', '#6E4232'],
}
const CLOTH: Record<Look, string[]> = {
  lorraine: ['#C8323C', '#7A1E2A', '#1B2033'],
  pike: ['#35495A', '#2C3350', '#1B2033'],
  doyle: ['#6B5A3C', '#473B27', '#1B2033'],
}
const HAIR: Record<Look, string[]> = {
  lorraine: ['#3A2330', '#3A2330', '#241219'],
  pike: ['#8A8A9A', '#8A8A9A', '#5A5A6A'],
  doyle: ['#2C3350', K, K],
}

// Suspects from cases other than the sample (generated ones) have no hand-drawn portrait. They get one
// plain figure (short hair, shirt and tie) whose colours come from a hash of their id, so each stays
// recognisable between screens and two different suspects rarely look alike.
const LOOKS: readonly string[] = ['lorraine', 'pike', 'doyle']
const GENERIC_SKIN = [['#E0A98A', '#B87A5E', '#8A5240'], ['#C68B66', '#9A6248', '#6E4232'], ['#F0C8A8', '#C99A7A', '#9A6E56'], ['#8A5A40', '#6A4230', '#4A2E22']]
const GENERIC_CLOTH = [['#35495A', '#2C3350', '#1B2033'], ['#6B5A3C', '#473B27', '#1B2033'], ['#4B6B4A', '#31492F', '#1B2033'], ['#7A5A6E', '#553E4C', '#1B2033'], ['#8A8A9A', '#5A5A6A', '#1B2033']]
const GENERIC_HAIR = [['#3A2330', '#3A2330', '#241219'], ['#8A8A9A', '#8A8A9A', '#5A5A6A'], ['#2C3350', K, K], ['#8A5A2C', '#6A4220', '#3A2410'], ['#C4A97A', '#8A6E4B', '#5A4630']]

function hash(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}
const pick = <T,>(list: T[], h: number, salt: number) => list[Math.floor(h / salt) % list.length]

// u runs from lit (negative) to shadow (positive); lamp sits upper-left
function shade(x: number, y: number, u: number, c: string[]) {
  if (u < -1) return c[0]
  if (u < 2) return chk(x, y) ? c[0] : c[1]
  if (u < 6) return c[1]
  if (u < 8) return chk(x, y) ? c[1] : c[2]
  return c[2]
}

function paint(b: Px, t: Fn, f: (x: number, y: number) => string | null) {
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (t(x, y)) {
    const c = f(x, y)
    if (c) b[y * W + x] = c
  }
}
function outer(b: Px, t: Fn) {
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++)
    if (!t(x, y) && (t(x + 1, y) || t(x - 1, y) || t(x, y + 1) || t(x, y - 1))) b[y * W + x] = K
}
const set = (b: Px, x: number, y: number, c: string) => {
  if (x >= 0 && x < W && y >= 0 && y < W) b[y * W + x] = c
}

function bgPixel(x: number, y: number) {
  const d = Math.hypot(x - 8, y - 14)
  if (x > 46 && y % 8 < 2) return d > 40 ? '#0F1220' : '#1B2033'
  if (d < 4) return '#FFD97A'
  if (d < 7) return '#F2B33D'
  if (d < 11) return '#C27C1E'
  if (d < 16) return chk(x, y) ? '#C27C1E' : '#8A6E4B'
  if (d < 22) return '#8A6E4B'
  if (d < 28) return chk(x, y) ? '#8A6E4B' : '#2C3350'
  if (d < 38) return '#2C3350'
  if (d < 46) return chk(x, y) ? '#2C3350' : '#1B2033'
  return '#1B2033'
}

// bare: leave the lamp-lit backdrop out (null pixels) so the figure can sit in another scene
export function renderPortrait(id: string, mood: Mood, blink: boolean, sweatY: number | null, bare = false, look?: Appearance): Px {
  // The three hand-drawn suspects keep their portraits. Everyone else is drawn from the look their case gives them.
  if (look && !LOOKS.includes(id)) return renderAppearance(look, mood, blink, sweatY, bare)
  const b: Px = Array(W * W).fill(null)
  // 'generic' wears Doyle's cut (short hair, shirt and tie) in colours picked from the id
  const known = LOOKS.includes(id)
  const who: Look | 'generic' = known ? (id as Look) : 'generic'
  const h = hash(id)
  const S = known ? SKIN[who as Look] : pick(GENERIC_SKIN, h, 1)
  const C = known ? CLOTH[who as Look] : pick(GENERIC_CLOTH, h, 7)
  const H = known ? HAIR[who as Look] : pick(GENERIC_HAIR, h, 31)
  const head: Fn = (x, y) => ((x - 32) / 12) ** 2 + ((y - 28) / 15) ** 2 <= 1
  const torso: Fn = (x, y) => y >= 46 && Math.abs(x - 32) <= Math.min(31, 12 + (y - 46) * 1.4)
  const ax = (x: number) => Math.abs(x - 32)

  // torso + outfit
  paint(b, torso, (x, y) => shade(x, y, (x - 28) * 0.55, C))
  if (who === 'lorraine') {
    const v: Fn = (x, y) => y >= 46 && y <= 54 && ax(x) <= (55 - y) * 0.8
    paint(b, v, (x, y) => shade(x, y, (x - 30) * 0.6, S))
    outer(b, (x, y) => v(x, y) || (y >= 38 && y < 46 && ax(x) <= 4)) // y >= 38: just the neck, not a line up through the hair
    set(b, 32, 55, '#F2B33D')
    set(b, 31, 54, '#F2B33D')
    set(b, 33, 54, '#F2B33D')
  }
  if (who !== 'lorraine') {
    const half = who === 'pike' ? 4 : 5
    const shirt: Fn = (x, y) => y >= 46 && ax(x) <= half + (y - 46) * 0.2
    paint(b, shirt, (x, y) => shade(x, y, (x - 30) * 0.8, ['#F4ECD8', '#E6D5AE', '#C4A97A']))
    outer(b, shirt)
    if (who === 'pike') {
      paint(b, (x, y) => y >= 49 && (x === 32 || x === 33) && y < 63, (x) => (x === 32 ? '#C8323C' : '#7A1E2A'))
      for (let y = 46; y < 49; y++) for (let x = 31; x <= 34; x++) set(b, x, y, '#7A1E2A')
    } else {
      for (let x = 27; x <= 37; x++) for (let y = 47; y <= 49; y++) if (x !== 32) set(b, x, y, x < 32 ? '#C8323C' : '#7A1E2A')
      set(b, 32, 48, K)
      set(b, 32, 53, K)
      set(b, 32, 58, K)
    }
  }
  outer(b, torso)

  // long hair behind the face
  if (who === 'lorraine') {
    const back: Fn = (x, y) => ((x - 32) / 17) ** 2 + ((y - 32) / 21) ** 2 <= 1 && !(y >= 42 && ax(x) < 11)
    paint(b, back, (x, y) => shade(x, y, x - 32 + (y - 28) * 0.25, H))
    outer(b, back)
  }

  // neck
  paint(b, (x, y) => x >= 28 && x <= 36 && y >= 38 && y <= 45, (x) => (x >= 33 ? S[2] : S[1]))
  for (let y = 41; y <= 45; y++) {
    set(b, 27, y, K)
    set(b, 37, y, K)
  }

  // ears + head
  const earL: Fn = (x, y) => ((x - 19) / 2.6) ** 2 + ((y - 29) / 3.4) ** 2 <= 1
  const earR: Fn = (x, y) => ((x - 45) / 2.6) ** 2 + ((y - 29) / 3.4) ** 2 <= 1
  paint(b, earL, () => S[0])
  paint(b, earR, () => S[2])
  outer(b, (x, y) => earL(x, y) || earR(x, y))
  paint(b, head, (x, y) => shade(x, y, x - 32 + (y - 28) * 0.25, S))
  outer(b, head)

  // nose
  for (let y = 30; y <= 33; y++) set(b, 32, y, S[2])
  set(b, 31, 34, S[2])
  set(b, 32, 34, S[2])

  // stubble / mustache
  if (who === 'doyle') paint(b, (x, y) => head(x, y) && y >= 34 && y <= 42 && (x + y * 2) % 3 === 0, () => S[2])
  if (who === 'pike')
    paint(b, (x, y) => x >= 27 && x <= 37 && (y === 34 || (y === 35 && (x < 30 || x > 34))), (x) => (x > 33 ? '#5A5A6A' : '#8A8A9A'))

  // hair
  let hair: Fn
  if (who === 'lorraine') hair = (x, y) => head(x, y) && (y <= 19 || (ax(x) >= 10 && y <= 38) || (y <= 23 && x <= 27))
  else if (who === 'pike') hair = (x, y) => head(x, y) && ((y <= 14 && ax(x) >= 6) || (ax(x) >= 10 && y >= 17 && y <= 30))
  else hair = (x, y) => head(x, y) && (y <= 17 || (ax(x) >= 11 && y <= 26))
  paint(b, hair, (x, y) => shade(x, y, x - 32 + (y - 28) * 0.25, H))
  outer(b, hair)
  if (who === 'doyle') for (let x = 24; x <= 30; x++) if (x % 2 === 0) set(b, x, 13, '#2C3350')

  drawEyes(b, mood, blink, who === 'doyle' && mood !== 'angry' ? -1 : 0)
  drawBrows(b, mood)
  if (who === 'pike') drawGlasses(b)
  drawMouth(b, mood, who === 'lorraine' ? '#C8323C' : '#5A2E26')
  if (who === 'lorraine') for (let x = 30; x <= 34; x++) if (mood === 'calm' || mood === 'nervous') set(b, x, 39, '#C8323C')
  if (who === 'lorraine') set(b, 18, 33, '#F2B33D')

  drawSweat(b, sweatY)
  return flatten(b, bare)
}

// ---- the parts of a face that every portrait shares ----

/** `away` shifts the pupils sideways: Doyle will not look at you. */
function drawEyes(b: Px, mood: Mood, blink: boolean, away: number) {
  for (const ex of [24, 37]) {
    if (blink) {
      for (let x = ex; x < ex + 4; x++) set(b, x, 29, K)
    } else {
      const heavy = mood === 'broken'
      for (let x = ex; x < ex + 4; x++) {
        set(b, x, 27, K)
        if (!heavy) set(b, x, 28, '#F4ECD8')
        else set(b, x, 28, K)
        set(b, x, 29, '#F4ECD8')
      }
      const px = ex + 1 + away
      set(b, px, 29, K)
      set(b, px + 1, 29, K)
      if (!heavy) {
        set(b, px, 28, K)
        set(b, px + 1, 28, K)
      }
    }
  }
}

function drawBrows(b: Px, mood: Mood) {
  for (let i = 0; i <= 6; i++) {
    const dy = mood === 'angry' ? Math.round(i / 3) - 1 : mood === 'nervous' || mood === 'broken' ? 1 - Math.round(i / 3) : 0
    set(b, 22 + i, 24 + dy, K)
    set(b, 42 - i, 24 + dy, K)
  }
}

function drawGlasses(b: Px) {
  for (let y = 22; y <= 34; y++)
    for (let x = 18; x <= 46; x++) {
      const dl = Math.hypot(x - 25.5, y - 28.5)
      const dr = Math.hypot(x - 38.5, y - 28.5)
      if (Math.abs(dl - 4.4) < 0.6 || Math.abs(dr - 4.4) < 0.6) set(b, x, y, K)
    }
  for (let x = 30; x <= 33; x++) set(b, x, 27, K)
  set(b, 22, 26, '#F4ECD8')
}

function drawMouth(b: Px, mood: Mood, lip: string) {
  if (mood === 'calm') for (let x = 29; x <= 35; x++) set(b, x, 38, lip)
  else if (mood === 'angry') {
    for (let x = 31; x <= 33; x++) set(b, x, 38, lip)
    for (const x of [29, 30, 34, 35]) set(b, x, 39, lip)
  } else if (mood === 'nervous') for (let x = 29; x <= 35; x++) set(b, x, x % 2 ? 39 : 38, lip)
  else {
    for (let x = 30; x <= 34; x++) for (let y = 37; y <= 39; y++) set(b, x, y, y === 38 ? '#7A1E2A' : K)
  }
}

function drawSweat(b: Px, sweatY: number | null) {
  if (sweatY === null) return
  const pts = [[0, 0], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [0, 3]]
  const has = new Set(pts.map(([dx, dy]) => `${42 + dx},${sweatY + dy}`))
  const d: Fn = (x, y) => has.has(`${x},${y}`)
  outer(b, d)
  for (const [dx, dy] of pts) set(b, 42 + dx, sweatY + dy, dx < 0 ? '#F4ECD8' : '#8FD6D2')
}

/** Lay the figure over the lamp-lit backdrop (or leave the backdrop out). */
function flatten(b: Px, bare: boolean): Px {
  const out: Px = Array(W * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) out[y * W + x] = b[y * W + x] ?? (bare ? null : bgPixel(x, y))
  return out
}

// ---- generated suspects: drawn from a look ----
// The case file gives every suspect a `look` (backend/src/caseFile/schema.ts, LOOK) chosen from this fixed list of
// choices, so any case a model writes can be drawn. Adding a value there means drawing it here.

export type Appearance = {
  skin: 'fair' | 'light' | 'tan' | 'brown' | 'dark'
  hairStyle: 'short' | 'slick' | 'long' | 'bun' | 'curly' | 'bob' | 'bald'
  hairColor: 'black' | 'brown' | 'auburn' | 'blond' | 'gray' | 'white'
  facialHair: 'none' | 'mustache' | 'beard' | 'stubble'
  glasses: boolean
  hat: boolean
  outfit: 'suit' | 'vest' | 'dress' | 'uniform' | 'apron' | 'coat'
  outfitColor: 'navy' | 'charcoal' | 'brown' | 'green' | 'crimson' | 'teal' | 'plum' | 'cream'
}

// [lit, mid, shadow], the three tones `shade` dithers between
const SKIN_TONES: Record<Appearance['skin'], string[]> = {
  fair: ['#F0C8A8', '#C99A7A', '#9A6E56'],
  light: ['#E0A98A', '#B87A5E', '#8A5240'],
  tan: ['#C68B66', '#9A6248', '#6E4232'],
  brown: ['#8A5A40', '#6A4230', '#4A2E22'],
  dark: ['#6A4430', '#4E3022', '#34201A'],
}
const HAIR_TONES: Record<Appearance['hairColor'], string[]> = {
  black: ['#2C3350', K, K],
  brown: ['#6B4A2E', '#4A3220', '#2E1E14'],
  auburn: ['#A04A2C', '#7A3420', '#4A2012'],
  blond: ['#D9B866', '#B08F44', '#7A6230'],
  gray: ['#8A8A9A', '#8A8A9A', '#5A5A6A'],
  white: ['#E6E6EE', '#C4C4CE', '#9A9AA6'],
}
const OUTFIT_TONES: Record<Appearance['outfitColor'], string[]> = {
  navy: ['#35495A', '#2C3350', '#1B2033'],
  charcoal: ['#4A4A55', '#33333C', '#1B1B22'],
  brown: ['#6B5A3C', '#473B27', '#1B2033'],
  green: ['#4B6B4A', '#31492F', '#1B2033'],
  crimson: ['#C8323C', '#7A1E2A', '#1B2033'],
  teal: ['#3E8A87', '#2D6466', '#1B2033'],
  plum: ['#7A5A6E', '#553E4C', '#1B2033'],
  cream: ['#E6D5AE', '#C4A97A', '#8A6E4B'],
}
const SHIRT = ['#F4ECD8', '#E6D5AE', '#C4A97A']

export function renderAppearance(look: Appearance, mood: Mood, blink: boolean, sweatY: number | null, bare = false): Px {
  const b: Px = Array(W * W).fill(null)
  const S = SKIN_TONES[look.skin] ?? SKIN_TONES.light
  const H = HAIR_TONES[look.hairColor] ?? HAIR_TONES.brown
  const C = OUTFIT_TONES[look.outfitColor] ?? OUTFIT_TONES.navy
  // a tie, or a necklace: crimson, unless the outfit already is
  const accent = look.outfitColor === 'crimson' ? ['#F2B33D', '#C27C1E'] : ['#C8323C', '#7A1E2A']
  const head: Fn = (x, y) => ((x - 32) / 12) ** 2 + ((y - 28) / 15) ** 2 <= 1
  const torso: Fn = (x, y) => y >= 46 && Math.abs(x - 32) <= Math.min(31, 12 + (y - 46) * 1.4)
  const ax = (x: number) => Math.abs(x - 32)
  const lit = (x: number, y: number) => x - 32 + (y - 28) * 0.25 // hair and skin: lit from the upper left

  // ---- body and outfit ----
  paint(b, torso, (x, y) => shade(x, y, (x - 28) * 0.55, C))
  switch (look.outfit) {
    case 'suit': {
      const shirt: Fn = (x, y) => y >= 46 && ax(x) <= 4 + (y - 46) * 0.2
      paint(b, shirt, (x, y) => shade(x, y, (x - 30) * 0.8, SHIRT))
      outer(b, shirt)
      paint(b, (x, y) => y >= 49 && (x === 32 || x === 33) && y < 63, (x) => (x === 32 ? accent[0] : accent[1]))
      for (let y = 46; y < 49; y++) for (let x = 31; x <= 34; x++) set(b, x, y, accent[1])
      for (let t = 0; t < 15; t++) {
        set(b, 26 - Math.round(t * 0.3), 47 + t, K) // lapels
        set(b, 38 + Math.round(t * 0.3), 47 + t, K)
      }
      break
    }
    case 'vest': {
      paint(b, torso, (x, y) => shade(x, y, (x - 28) * 0.55, SHIRT)) // shirt sleeves
      const vest: Fn = (x, y) => y >= 47 && ax(x) >= 2 && ax(x) <= 11 + (y - 47) * 0.35
      paint(b, vest, (x, y) => shade(x, y, (x - 30) * 0.7, C))
      outer(b, vest)
      for (const y of [52, 57, 62]) set(b, 32, y, K)
      paint(b, (x, y) => y >= 47 && y <= 60 && x === 32, () => accent[0])
      break
    }
    case 'dress': {
      const v: Fn = (x, y) => y >= 46 && y <= 54 && ax(x) <= (55 - y) * 0.8
      paint(b, v, (x, y) => shade(x, y, (x - 30) * 0.6, S))
      outer(b, (x, y) => v(x, y) || (y >= 38 && y < 46 && ax(x) <= 4))
      for (const [x, y] of [[32, 55], [31, 54], [33, 54]]) set(b, x, y, '#F2B33D') // necklace
      break
    }
    case 'uniform': {
      const collar: Fn = (x, y) => y >= 46 && y <= 50 && ax(x) <= (51 - y) * 0.9
      paint(b, collar, (x, y) => shade(x, y, (x - 30) * 0.8, SHIRT))
      outer(b, collar)
      for (let y = 51; y < 64; y++) set(b, 32, y, K) // seam
      for (const y of [53, 57, 61])
        for (const x of [28, 36]) set(b, x, y, '#F2B33D') // brass buttons
      for (const [x0, x1] of [[20, 26], [38, 44]])
        for (let x = x0; x <= x1; x++) {
          set(b, x, 47, '#F2B33D')
          set(b, x, 48, '#C27C1E')
        } // shoulder boards
      break
    }
    case 'apron': {
      const bib: Fn = (x, y) => y >= 51 && ax(x) <= 9 + (y - 51) * 0.1
      paint(b, bib, (x, y) => shade(x, y, (x - 30) * 0.7, SHIRT))
      outer(b, bib)
      for (let t = 0; t < 5; t++) {
        set(b, 25 + t, 47 + t, SHIRT[1]) // straps
        set(b, 39 - t, 47 + t, SHIRT[1])
      }
      break
    }
    case 'coat': {
      const lapel: Fn = (x, y) => y >= 46 && y <= 62 && ax(x) >= 3 && ax(x) <= 4 + (y - 46) * 0.45
      paint(b, lapel, (x, y) => shade(x, y, (x - 30) * 0.5 - 4, C))
      outer(b, lapel)
      const inner: Fn = (x, y) => y >= 46 && ax(x) <= 2 + (y - 46) * 0.1
      paint(b, inner, (x, y) => shade(x, y, (x - 30) * 0.8, SHIRT))
      for (const y of [58, 61]) set(b, 32, y, K)
      break
    }
  }
  outer(b, torso)

  // ---- hair that sits behind the face ----
  const back: Fn | null =
    look.hairStyle === 'long'
      ? (x, y) => ((x - 32) / 17) ** 2 + ((y - 32) / 21) ** 2 <= 1 && !(y >= 42 && ax(x) < 11)
      : look.hairStyle === 'bob'
        ? (x, y) => ((x - 32) / 16.5) ** 2 + ((y - 30) / 17) ** 2 <= 1 && y <= 41 && !(y >= 34 && ax(x) < 10)
        : null
  if (back) {
    paint(b, back, (x, y) => shade(x, y, lit(x, y), H))
    outer(b, back)
  }
  if (look.hairStyle === 'curly') {
    const blobs = [[20, 21], [44, 21], [24, 14], [40, 14], [32, 11]].filter(([, y]) => !look.hat || y > 14)
    const puff: Fn = (x, y) => blobs.some(([cx, cy]) => Math.hypot(x - cx, y - cy) <= 4.6)
    paint(b, puff, (x, y) => shade(x, y, lit(x, y), H))
    outer(b, puff)
  }

  // ---- neck, ears, head, nose ----
  paint(b, (x, y) => x >= 28 && x <= 36 && y >= 38 && y <= 45, (x) => (x >= 33 ? S[2] : S[1]))
  for (let y = 41; y <= 45; y++) {
    set(b, 27, y, K)
    set(b, 37, y, K)
  }
  const earL: Fn = (x, y) => ((x - 19) / 2.6) ** 2 + ((y - 29) / 3.4) ** 2 <= 1
  const earR: Fn = (x, y) => ((x - 45) / 2.6) ** 2 + ((y - 29) / 3.4) ** 2 <= 1
  paint(b, earL, () => S[0])
  paint(b, earR, () => S[2])
  outer(b, (x, y) => earL(x, y) || earR(x, y))
  paint(b, head, (x, y) => shade(x, y, lit(x, y), S))
  outer(b, head)
  for (let y = 30; y <= 33; y++) set(b, 32, y, S[2])
  set(b, 31, 34, S[2])
  set(b, 32, 34, S[2])

  // ---- facial hair ----
  if (look.facialHair === 'stubble') paint(b, (x, y) => head(x, y) && y >= 34 && y <= 42 && (x + y * 2) % 3 === 0, () => S[2])
  if (look.facialHair === 'mustache') paint(b, (x, y) => x >= 27 && x <= 37 && (y === 34 || (y === 35 && (x < 30 || x > 34))), (x) => (x > 33 ? H[2] : H[1]))
  if (look.facialHair === 'beard') {
    const beard: Fn = (x, y) => head(x, y) && (y >= 41 || (y >= 33 && ax(x) >= 8))
    paint(b, beard, (x, y) => shade(x, y, lit(x, y), H))
    outer(b, (x, y) => beard(x, y) && y >= 41)
  }

  // ---- hair in front ----
  const front: Fn | null = {
    short: (x: number, y: number) => head(x, y) && (y <= 17 || (ax(x) >= 11 && y <= 26)),
    slick: (x: number, y: number) => head(x, y) && (y <= 16 || (ax(x) >= 11 && y <= 23)),
    long: (x: number, y: number) => head(x, y) && (y <= 19 || (ax(x) >= 10 && y <= 38) || (y <= 23 && x <= 27)),
    bob: (x: number, y: number) => head(x, y) && (y <= 19 || (ax(x) >= 10 && y <= 34) || (y <= 22 && x <= 27)),
    bun: (x: number, y: number) => head(x, y) && (y <= 18 || (ax(x) >= 11 && y <= 26)),
    curly: (x: number, y: number) => head(x, y) && (y <= 19 || (ax(x) >= 10 && y <= 28)),
    bald: (x: number, y: number) => head(x, y) && ax(x) >= 12 && y >= 23 && y <= 31,
  }[look.hairStyle] ?? null
  if (front) {
    paint(b, front, (x, y) => shade(x, y, lit(x, y), H))
    outer(b, front)
  }
  if (look.hairStyle === 'slick') for (let x = 24; x <= 40; x += 3) set(b, x, 14, H[0]) // a sheen of pomade
  if (look.hairStyle === 'bun' && !look.hat) {
    const bun: Fn = (x, y) => Math.hypot(x - 32, y - 10) <= 5.5
    paint(b, bun, (x, y) => shade(x, y, lit(x, y), H))
    outer(b, bun)
  }

  // ---- hat: a fedora, in the outfit's colour ----
  if (look.hat) {
    const crown: Fn = (x, y) => y >= 7 && y <= 19 && ax(x) <= (y < 9 ? 7 + (y - 7) * 1.5 : 10)
    const brim: Fn = (x, y) => ((x - 32) / 21) ** 2 + ((y - 20) / 3.4) ** 2 <= 1
    paint(b, crown, (x, y) => shade(x, y, lit(x, y), C))
    paint(b, (x, y) => crown(x, y) && y >= 15 && y <= 17, () => (look.outfitColor === 'crimson' ? C[2] : accent[1])) // band
    paint(b, (x, y) => crown(x, y) && y <= 9 && ax(x) <= 1, () => C[2]) // the pinch
    outer(b, crown)
    paint(b, brim, (x, y) => shade(x, y, lit(x, y) + 2, C))
    outer(b, brim)
  }

  // ---- the face ----
  drawEyes(b, mood, blink, 0)
  drawBrows(b, mood)
  if (look.glasses) drawGlasses(b)
  const lipstick = look.outfit === 'dress'
  drawMouth(b, mood, lipstick ? '#C8323C' : '#5A2E26')
  if (lipstick) {
    for (let x = 30; x <= 34; x++) if (mood === 'calm' || mood === 'nervous') set(b, x, 39, '#C8323C')
    set(b, 18, 33, '#F2B33D') // earrings
    set(b, 46, 33, '#F2B33D')
  }

  drawSweat(b, sweatY)
  return flatten(b, bare)
}

/** Dim, lamp-lit desk backdrop for the case-file screens. (w, h) is the canvas size in logical pixels. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w = 360, h = 225) {
  const s = Math.max(0.75, h / 225) // keep the pool of light in proportion on bigger screens
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - w / 2) / 1.6, y - h * 0.4) / s
      let c = '#0F1220'
      if (d < 60) c = '#2C3350'
      else if (d < 70) c = chk(x, y) ? '#2C3350' : '#1B2033'
      else if (d < 95) c = '#1B2033'
      else if (d < 105) c = chk(x, y) ? '#1B2033' : '#0F1220'
      const [r, g, b] = rgb(c)
      const o = (y * w + x) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  let seed = 7
  for (let i = 0, n = Math.round((16 * w * h) / (360 * 225)); i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const x = seed % w
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const y = seed % h
    ctx.fillStyle = '#C27C1E'
    ctx.fillRect(x, y, 1, 1)
  }
}

// Menu night skyline. Pixels only (no smoothing): gradients are faked with ordered dithering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
// 0..1 threshold from a 4x4 Bayer matrix; "t > bayer(x, y)" turns a smooth ramp into a dither pattern
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16

// Deterministic 0..1 noise from an integer, so the skyline keeps its shape when the window is resized
function noise(n: number) {
  let x = Math.imul(n | 0, 374761393) + 668265263
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

/** Full-screen noir city for the menu screens. (w, h) is the canvas size in logical pixels. */
export function drawSkyline(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const horizon = Math.round(h * 0.72)
  const nearBase = horizon + Math.round(h * 0.05)
  const sky = ['#0F1220', '#1B2033', '#2C3350'].map(rgb)
  const rect = (c: string, x: number, y: number, rw: number, rh: number) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, rw, rh)
  }

  // sky: darkest at the top, glowing toward the horizon
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, y / horizon) * 2
      const i = Math.min(1, Math.floor(t))
      const c = t - i > bayer(x, y) ? sky[i + 1] : sky[i]
      const o = (y * w + x) * 4
      img.data[o] = c[0]
      img.data[o + 1] = c[1]
      img.data[o + 2] = c[2]
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)

  // moon with a dithered halo
  const mr = Math.max(6, Math.round(Math.min(w, h) * 0.07))
  const mx = Math.round(w * 0.78)
  const my = Math.round(h * 0.2)
  for (let y = my - mr - 10; y <= my + mr + 10; y++)
    for (let x = mx - mr - 10; x <= mx + mr + 10; x++) {
      const d = Math.hypot(x - mx, y - my)
      if (d <= mr) {
        const u = ((x - mx) + (y - my)) / (2 * mr)
        rect(u > 0.35 || (u > 0.2 && bayer(x, y) < 0.5) ? '#C4A97A' : '#E6D5AE', x, y, 1, 1)
      } else if (d <= mr + 9 && (1 - (d - mr) / 9) * 0.6 > bayer(x, y)) rect('#2C3350', x, y, 1, 1)
    }
  for (const [cx, cy] of [[-0.35, -0.25], [0.15, 0.3], [-0.1, 0.55]])
    rect('#C4A97A', Math.round(mx + cx * mr), Math.round(my + cy * mr), 2, 1)

  // two rows of buildings: far (lighter, dim windows) behind near (darkest, bright windows)
  const span = Math.min(h, w * 0.8) // keep towers from getting absurdly tall on portrait screens
  const layer = (seed: number, color: string, base: number, lo: number, hi: number, wLo: number, wHi: number, step: [number, number], size: [number, number], density: number, lit: [string, string]) => {
    let x = -Math.floor(noise(seed) * 8)
    for (let i = 0; x < w; i++) {
      const bw = wLo + Math.floor(noise(seed * 977 + i * 3 + 1) * (wHi - wLo + 1))
      const bh = Math.round(span * (lo + noise(seed * 977 + i * 3 + 2) * (hi - lo)))
      const top = base - bh
      rect(color, x, top, bw, bh)
      const roof = noise(seed * 977 + i * 3 + 3)
      if (roof < 0.25) {
        rect(color, x + (bw >> 1), top - 4, 1, 4)
        if (roof < 0.1) rect('#C8323C', x + (bw >> 1), top - 5, 1, 1) // aircraft warning light
      } else if (roof < 0.45) rect(color, x + 1, top - 2, bw - 2, 2)
      for (let wy = top + 3; wy < base - 4; wy += step[1])
        for (let wx = x + 2; wx < x + bw - 2; wx += step[0]) {
          const n = noise(wx * 131 + wy * 17 + seed)
          if (n < density) rect(n < density * 0.35 ? lit[1] : lit[0], wx, wy, size[0], size[1])
        }
      x += bw
    }
  }
  layer(1, '#1B2033', horizon, 0.16, 0.36, 8, 18, [3, 4], [1, 2], 0.2, ['#8A6E4B', '#C27C1E'])
  layer(2, '#0F1220', nearBase, 0.1, 0.24, 12, 26, [4, 5], [2, 2], 0.45, ['#F2B33D', '#C27C1E'])

  // street
  rect('#1B2033', 0, nearBase, w, h - nearBase)
  rect('#2C3350', 0, nearBase, w, 1)
  const lane = nearBase + Math.round((h - nearBase) * 0.6)
  for (let x = 2; x < w; x += 14) rect('#2C3350', x, lane, 7, 1)

  // street lamp: dithered glow first, then the pole and bulb on top
  const lx = Math.round(w * 0.14)
  const ly = Math.round(h * 0.4)
  const gr = Math.min(90, Math.round(h * 0.3))
  for (let y = ly - gr; y <= ly + gr; y++)
    for (let x = lx - gr + 4; x <= lx + gr + 4; x++) {
      const d = Math.hypot(x - lx - 4, y - ly - 3)
      const p = Math.max(0, 1 - d / gr) ** 2 * 0.7
      if (p > bayer(x, y)) rect(d < gr * 0.45 ? '#C27C1E' : '#8A6E4B', x, y, 1, 1)
    }
  rect('#2C3350', lx, ly, 2, h - ly)
  rect('#2C3350', lx, ly, 5, 2)
  rect('#F2B33D', lx + 3, ly + 2, 3, 2)
  rect('#FFD97A', lx + 4, ly + 2, 1, 1)

  vignette(ctx, w, h)
}

// Dithered darkening toward the corners; always the last pass so it sits over everything
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const [r, g, b] = rgb('#0F1220')
  const out = ctx.getImageData(0, 0, w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.hypot((x / w - 0.5) * 2, (y / h - 0.5) * 2)
      if (v > 0.85 && (v - 0.85) / 0.55 > bayer(x + 2, y + 1)) {
        const o = (y * w + x) * 4
        out.data[o] = r
        out.data[o + 1] = g
        out.data[o + 2] = b
      }
    }
  ctx.putImageData(out, 0, 0)
}

/**
 * Interrogation room wall: blinds window, one-way mirror and a hanging lamp with a dithered
 * cone of light. The table and the suspects are DOM layered on top of this canvas.
 */
export function drawRoom(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const wall = ['#0F1220', '#1B2033', '#2C3350'].map(rgb)
  const rect = (c: string, x: number, y: number, rw: number, rh: number) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, rw, rh)
  }

  // ceiling dark, wall lighter toward the floor
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, y / (h * 0.9)) * 2
      const i = Math.min(1, Math.floor(t))
      const c = t - i > bayer(x, y) ? wall[i + 1] : wall[i]
      const o = (y * w + x) * 4
      img.data[o] = c[0]
      img.data[o + 1] = c[1]
      img.data[o + 2] = c[2]
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)

  const ww = Math.max(24, Math.min(56, Math.round(w * 0.1)))
  const wh = Math.round(ww * 1.4)
  const wy = Math.round(h * 0.16)
  const frame = (x: number, y: number, fw: number, fh: number) => {
    rect(K, x - 2, y - 2, fw + 4, fh + 4)
    rect('#8A6E4B', x - 1, y - 1, fw + 2, fh + 2)
  }

  // window with venetian blinds, and the slanted light it throws across the wall
  const wx = Math.round(w * 0.1)
  frame(wx, wy, ww, wh)
  for (let ry = 0; ry < wh; ry++) rect(ry % 4 < 2 ? '#2C3350' : '#0F1220', wx, wy + ry, ww, 1)
  const fall = Math.round(h * 0.45)
  for (let dy = 0; dy < fall; dy++) {
    const y = wy + wh + dy
    if ((y - wy) % 8 >= 4) continue
    const shift = Math.round(dy * 0.6)
    for (let x = wx + shift; x < wx + ww + shift; x++) if (0.8 * (1 - dy / fall) > bayer(x, y)) rect('#2C3350', x, y, 1, 1)
  }

  // one-way mirror: dark glass with a few glints
  const mw = Math.round(ww * 1.7)
  const mx = w - Math.round(w * 0.1) - mw
  frame(mx, wy, mw, wh)
  rect('#0F1220', mx, wy, mw, wh)
  for (let y = wy; y < wy + wh; y++)
    for (let x = mx; x < mx + mw; x++) {
      const d = (x - mx + (y - wy)) % 14
      if (d < 2) rect('#2C3350', x, y, 1, 1)
      else if (d === 7) rect('#1B2033', x, y, 1, 1)
    }

  // hanging lamp, then the cone of light straight down onto the table
  const cx = Math.round(w / 2)
  const ly = Math.round(h * 0.06)
  const y0 = ly + 10
  for (let y = y0; y < h; y++) {
    const half = 8 + (y - y0) * 0.75
    const fade = Math.max(0, 1 - (y - y0) / (h * 0.95))
    for (let x = Math.round(cx - half); x <= cx + half; x++) {
      const u = Math.abs(x - cx) / half
      if ((1 - u) ** 1.2 * 0.55 * fade > bayer(x, y)) rect(u < 0.5 ? '#C27C1E' : '#8A6E4B', x, y, 1, 1)
    }
  }
  rect(K, cx, 0, 1, ly)
  for (let i = 0; i < 8; i++) {
    const half = 3 + Math.round(i * 1.4)
    rect('#8A6E4B', cx - half, ly + i, half * 2 + 1, 1)
    rect('#C4A97A', cx - half, ly + i, 1, 1)
    rect('#C27C1E', cx + half, ly + i, 1, 1)
  }
  rect(K, cx - 14, ly + 8, 29, 1)
  rect('#FFD97A', cx - 6, ly + 9, 13, 1)

  vignette(ctx, w, h)
}

export const SPRITE_PAL: Record<string, string> = {
  K, W: '#F4ECD8', P: '#E6D5AE', p: '#C4A97A', b: '#8A6E4B', A: '#F2B33D', a: '#C27C1E', Y: '#FFD97A',
  R: '#C8323C', r: '#7A1E2A', T: '#4FA3A0', t: '#2D6466', N: '#2C3350', n: '#1B2033', S: '#8FD6D2',
  s: '#E0A98A', h: '#B87A5E',
  // steel, for the gun and the knife
  G: '#8A8A9A', g: '#5A5A6A', L: '#C8CCD8',
}

// 16x16 cog: ring body plus 8 teeth around a hole, outlined and shaded from the upper-left lamp
function gearSprite(): string[] {
  const inGear = (x: number, y: number) => {
    const dx = x - 7.5
    const dy = y - 7.5
    const d = Math.hypot(dx, dy)
    return d > 2.4 && (d <= 5.6 || (d <= 7.4 && Math.cos(Math.atan2(dy, dx) * 8) > 0.15))
  }
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      if (inGear(x, y)) {
        const u = x - 7.5 + (y - 7.5)
        return u < -4 ? 'Y' : u > 3 ? 'a' : 'A'
      }
      return inGear(x + 1, y) || inGear(x - 1, y) || inGear(x, y + 1) || inGear(x, y - 1) ? 'K' : '.'
    }).join(''),
  )
}

// One 7px-wide fedora-and-coat figure. C = coat, c = coat shade; duoSprite() puts two side by side.
const PERSON = [
  '.......',
  '..KKK..',
  '.KNNNK.',
  '.KRRRK.',
  'KKKKKKK',
  '.KhhhK.',
  '.KsssK.',
  '..KsK..',
  '.KPWPK.',
  'KCCWCCK',
  'KCCRCCK',
  'KCCCCCK',
  'KCCCCCK',
  'KCCCCCK',
  'KcCCCcK',
  'KKKKKKK',
]
function duoSprite(): string[] {
  const dress = (coat: string, shade: string) => PERSON.map((r) => r.replace(/C/g, coat).replace(/c/g, shade))
  const left = dress('p', 'b')
  const right = dress('T', 't')
  return left.map((r, i) => r + '..' + right[i])
}

// Round things are easier to get right from a formula than by hand: a 16x16 grid where `pick` says what each pixel is.
const grid = (pick: (x: number, y: number) => string): string[] =>
  Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => pick(x, y)).join(''))
/** Outline a shape: pixels outside it that touch it become ink. */
const inked = (inside: (x: number, y: number) => string | null) => (x: number, y: number) => {
  const c = inside(x, y)
  if (c) return c
  return inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1) ? 'K' : '.'
}

// a gold ring seen face-on, with a pale stone on top
function ringSprite(): string[] {
  return grid(
    inked((x, y) => {
      const d = Math.hypot(x - 7.5, y - 10)
      if (d > 3.1 && d <= 5.4) return x - 7.5 + (y - 10) < -3 ? 'Y' : x - 7.5 + (y - 10) > 3 ? 'a' : 'A'
      const gem = Math.abs(x - 7.5) + Math.abs(y - 3.8)
      if (gem <= 2.7) return gem < 1.2 ? 'W' : 'S'
      return null
    }),
  )
}

// a pocket watch: gold case, cream face, hands at ten past ten, and the crown on top
function watchSprite(): string[] {
  return grid(
    inked((x, y) => {
      const d = Math.hypot(x - 7.5, y - 9)
      if (d <= 4.3) {
        if ((x === 7 || x === 8) && y >= 6 && y <= 9) return 'K' // hour hand
        if (y === 9 && x >= 8 && x <= 11) return 'K' // minute hand
        if ((y === 5 && (x === 7 || x === 8)) || (y === 13 && (x === 7 || x === 8)) || ((x === 3 || x === 12) && (y === 9 || y === 8))) return 'r' // 12, 6, 9, 3
        return 'W'
      }
      if (d <= 6.1) return x - 7.5 + (y - 9) < -3 ? 'Y' : x - 7.5 + (y - 9) > 3 ? 'a' : 'A'
      if (x >= 6 && x <= 9 && y >= 1 && y <= 2) return 'A' // crown
      return null
    }),
  )
}

// a handkerchief folded corner-up, with a dark red stain
function clothSprite(): string[] {
  return grid(
    inked((x, y) => {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5)
      if (d > 6.6) return null
      if (Math.hypot(x - 8.5, y - 8.5) < 2.6) return Math.hypot(x - 8.5, y - 8.5) < 1.5 ? 'r' : 'R'
      return x - 7.5 + (y - 7.5) > 3 ? 'p' : x - 7.5 + (y - 7.5) > 0 ? 'P' : 'W'
    }),
  )
}

export const SPRITES: Record<string, string[]> = {
  gun: [
    '................',
    '................',
    '................',
    '.KKKKKKKKKKKKK..',
    'KLLLLLLLLLLLLGK.',
    'KGGGGGGGGGGGGGK.',
    'KKKKKKKKKGGKKKK.',
    '.....KAAKGGK....',
    '.....KAKKbbK....',
    '.....KKKbpbK....',
    '.......KbpbK....',
    '.......KbbbK....',
    '.......KbbbK....',
    '.......KKKKK....',
    '................',
    '................',
  ],
  knife: [
    '................',
    '..........KKK...',
    '.........KLLWK..',
    '........KLLWWK..',
    '.......KLLWWK...',
    '......KLLWWK....',
    '.....KLLWWK.....',
    '....KLLWGK......',
    '...KLLWGK.......',
    '..KKKGGKK.......',
    '.KaAKKKK........',
    '.KAbbK..........',
    'KAbpbK..........',
    'KbpbK...........',
    'KbbK............',
    '.KK.............',
  ],
  photo: [
    '................',
    '.KKKKKKKKKKKKK..',
    '.KWWWWWWWWWWWK..',
    '.KWNNNNNNNNNWK..',
    '.KWNNNsssNNNWK..',
    '.KWNNssssssNWK..',
    '.KWNNsKssKsNWK..',
    '.KWNNssssssNWK..',
    '.KWNNNsRRsNNWK..',
    '.KWNNNNssNNNWK..',
    '.KWNTTTTTTTTWK..',
    '.KWNTTTTTTTTWK..',
    '.KWWWWWWWWWWWK..',
    '.KKKKKKKKKKKKK..',
    '................',
    '................',
  ],
  bottle: [
    '................',
    '......KKKK......',
    '......KbbK......',
    '......KKKK......',
    '.....KTTTTK.....',
    '.....KTSTTK.....',
    '.....KTSTTK.....',
    '....KTTSTTTK....',
    '...KTTTSTTTTK...',
    '...KTWWWWWTTK...',
    '...KTWKKKWTTK...',
    '...KTWWWWWTTK...',
    '...KTTTTTTTtK...',
    '...KTTTTTTttK...',
    '....KtttttttK...',
    '....KKKKKKKK....',
  ],
  ledger: [
    '................',
    '.KKKKKKKKKKKKK..',
    '.KrrrrrrrrrrrrK.',
    '.KrRRRRRRRRRRrK.',
    '.KrRAAAAAAAARrK.',
    '.KrRKKKKKKKKRrK.',
    '.KrRAAAAAAAARrK.',
    '.KrRRRRRRRRRRrK.',
    '.KrRRRRRRRRRRrK.',
    '.KrRRRRRARRRRrK.',
    '.KrRRRRRRRRRRrK.',
    '.KrrrrrrrrrrrrK.',
    '.KPPPPPPPPPPPPK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
  ],
  ring: ringSprite(),
  cloth: clothSprite(),
  hat: [
    '................',
    '................',
    '.....KKKKKK.....',
    '....KppppppK....',
    '...KppbbbbppK...',
    '...KppppppppK...',
    '...KRRRRRRRRK...',
    '...KbbbbbbbbK...',
    '.KKKKKKKKKKKKKK.',
    'KppppppppppppppK',
    'KbbbbbbbbbbbbbbK',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
    '................',
  ],
  watch: watchSprite(),
  matchbook: [
    '................',
    '.....KKKKKKK....',
    '....KRRRRRRRK...',
    '....KWWWWWWWK...',
    '..KKKKKKKKKKKKK.',
    '.KaaaaaaaaaaaaK.',
    '.KaAAAAAAAAAAaK.',
    '.KaAAAKAAKAAAaK.',
    '.KaAAKAAAAKAAaK.',
    '.KaAAAAAAAAAAaK.',
    '.KaaaaaaaaaaaaK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
    '................',
  ],
  key: [
    '................',
    '.....KKKKKK.....',
    '....KAAAAAAK....',
    '...KAAKKKKAAK...',
    '...KAK....KAK...',
    '...KAK....KAK...',
    '...KAAKKKKAAK...',
    '....KAAaaAAK....',
    '.....KKAAKK.....',
    '......KAAK......',
    '......KAaKKKK...',
    '......KAAAAAK...',
    '......KAaKKKK...',
    '......KAAK......',
    '......KaaK......',
    '.......KK.......',
  ],
  letter: [
    '................',
    '................',
    '.KKKKKKKKKKKKKK.',
    '.KPPPPPPPPPPPPK.',
    '.KKPPPPPPPPPPKK.',
    '.KpKKPPPPPPKKpK.',
    '.KpPPKKPPKKPPpK.',
    '.KpPPPPKKPPPPpK.',
    '.KpPPPPPPPPPPpK.',
    '.KpPPPPPPPrrNNK.',
    '.KppppppppNNNNK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
    '................',
  ],
  ticket: [
    '................',
    '................',
    '................',
    '................',
    '..KKKKKKKKKKKK..',
    '.KAAAAAKPPPPPPK.',
    '.KAKKKAKPKKKPPK.',
    'KAAAAAAKPPPPPPPK',
    'KAARRRAKPPPPPPPK',
    'KAAAAAAKPKPKPKPK',
    '.KAAAAAKPPPPPPK.',
    '..KKKKKKKKKKKK..',
    '................',
    '................',
    '................',
    '................',
  ],
  glass: [
    '................',
    '................',
    '..KKKKKKKKKKKK..',
    '..KWSSSSSSSSWK..',
    '..KSRRSSSSSSSK..',
    '..KSAAAAAAAASK..',
    '..KSAWAAAAAASK..',
    '..KSAWAAAAAAaSK.',
    '..KSAAAAAAAAaSK.',
    '..KSAAAAAAAAaSK.',
    '...KSaaaaaaaSK..',
    '...KSSSSSSSSK...',
    '....KKKKKKKK....',
    '................',
    '................',
    '................',
  ],
  magnifier: [
    '................',
    '....KKKKKK......',
    '...KSSSSSSK.....',
    '..KSWWSSSSSK....',
    '..KSWSSSSSSK....',
    '..KSSSSSSSSK....',
    '..KSSSSSSSSK....',
    '...KSSSSSSK.....',
    '....KKKKKKK.....',
    '........KAAK....',
    '.........KAAK...',
    '..........KAAK..',
    '...........KAAK.',
    '............KKK.',
    '................',
    '................',
  ],
  gear: gearSprite(),
  duo: duoSprite(),
  // the player: fedora, trench coat, crimson tie
  detective: [
    '................',
    '.....KKKKKK.....',
    '....KNNNNNNK....',
    '....KNRRRRNK....',
    '..KKKKKKKKKKKK..',
    '.KNNNNNNNNNNNNK.',
    '..KKKKKKKKKKKK..',
    '....KssssssK....',
    '....KsKssKsK....',
    '....KssssssK....',
    '....KsshhssK....',
    '.....KKssKK.....',
    '..KKKPWWWWPKKK..',
    '.KpppPWRRWPpppK.',
    '.KpbpPWRRWPpbpK.',
    '.KKKKKKKKKKKKKK.',
  ],
}

// The exhibit sprites the case schema allows (backend/src/caseFile/schema.ts, SPRITES). A case file written by hand or
// by an older version may name something else, so `exhibitSprite` maps an unknown sprite to the nearest one by keyword
// (else the paper sprite) instead of crashing.
const EXHIBIT_SPRITES = ['key', 'letter', 'ticket', 'glass', 'gun', 'knife', 'photo', 'bottle', 'ledger', 'ring', 'cloth', 'hat', 'watch', 'matchbook']
const NEAREST: [RegExp, string][] = [
  [/\b(gun|pistol|revolver|handgun|rifle|firearm|shotgun)/, 'gun'],
  [/\b(knife|blade|dagger|razor|scissors|letter opener|stiletto)/, 'knife'],
  [/\b(key|lock|latch|padlock)/, 'key'],
  [/\b(ticket|stub|receipt|coupon|token|pass)\b/, 'ticket'],
  [/\b(bottle|flask|vial|decanter)/, 'bottle'],
  [/\b(glass|cup|drink|mug|lipstick|wine)/, 'glass'],
  [/\b(photo|picture|portrait|snapshot|negative)/, 'photo'],
  [/\b(ledger|book|diary|journal|notebook|log)/, 'ledger'],
  [/\b(ring|necklace|brooch|jewel|bracelet|pendant|locket|earring)/, 'ring'],
  [/\b(cloth|handkerchief|scarf|rag|glove|tie|napkin|ribbon)/, 'cloth'],
  [/\b(hat|cap|fedora|bonnet)/, 'hat'],
  [/\b(watch|clock|timepiece)/, 'watch'],
  [/\b(match|matchbook|lighter|cigarette|cigar|ashtray)/, 'matchbook'],
  [/\b(letter|note|paper|page|card|telegram|memo|document|envelope|map)/, 'letter'],
]
export function exhibitSprite(sprite: string, name = ''): string {
  if (EXHIBIT_SPRITES.includes(sprite)) return sprite
  const text = `${sprite} ${name}`.toLowerCase()
  return NEAREST.find(([re]) => re.test(text))?.[1] ?? 'letter'
}

export function nine(fill: string, hi: string, sh: string, s: number) {
  const N = 2 * s + 1
  const r = (x: number, y: number, w: number, h: number, c: string) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${c}'/>`
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${N}' height='${N}' viewBox='0 0 ${N} ${N}' shape-rendering='crispEdges'>` +
    r(1, 1, N - 2, N - 2, fill) + r(1, 1, N - 2, 1, hi) + r(1, 1, 1, N - 2, hi) +
    r(1, N - 2, N - 2, 1, sh) + r(N - 2, 1, 1, N - 2, sh) +
    r(1, 0, N - 2, 1, K) + r(1, N - 1, N - 2, 1, K) + r(0, 1, 1, N - 2, K) + r(N - 1, 1, 1, N - 2, K) +
    r(1, 1, 1, 1, K) + r(N - 2, 1, 1, 1, K) + r(1, N - 2, 1, 1, K) + r(N - 2, N - 2, 1, 1, K) +
    '</svg>'
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}
