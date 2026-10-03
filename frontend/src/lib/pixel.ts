export type Who = 'lorraine' | 'pike' | 'doyle'
export type Mood = 'calm' | 'nervous' | 'angry' | 'broken'
export type Px = (string | null)[]
type Fn = (x: number, y: number) => boolean

export const W = 64
export const K = '#1A1414'
const chk = (x: number, y: number) => (x + y) % 2 === 0

const SKIN: Record<Who, string[]> = {
  lorraine: ['#E0A98A', '#B87A5E', '#8A5240'],
  pike: ['#E0A98A', '#B87A5E', '#8A5240'],
  doyle: ['#C68B66', '#9A6248', '#6E4232'],
}
const CLOTH: Record<Who, string[]> = {
  lorraine: ['#C8323C', '#7A1E2A', '#1B2033'],
  pike: ['#35495A', '#2C3350', '#1B2033'],
  doyle: ['#6B5A3C', '#473B27', '#1B2033'],
}
const HAIR: Record<Who, string[]> = {
  lorraine: ['#3A2330', '#3A2330', '#241219'],
  pike: ['#8A8A9A', '#8A8A9A', '#5A5A6A'],
  doyle: ['#2C3350', K, K],
}

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

export function renderPortrait(who: Who, mood: Mood, blink: boolean, sweatY: number | null): Px {
  const b: Px = Array(W * W).fill(null)
  const S = SKIN[who]
  const C = CLOTH[who]
  const H = HAIR[who]
  const head: Fn = (x, y) => ((x - 32) / 12) ** 2 + ((y - 28) / 15) ** 2 <= 1
  const torso: Fn = (x, y) => y >= 46 && Math.abs(x - 32) <= Math.min(31, 12 + (y - 46) * 1.4)
  const ax = (x: number) => Math.abs(x - 32)

  // torso + outfit
  paint(b, torso, (x, y) => shade(x, y, (x - 28) * 0.55, C))
  if (who === 'lorraine') {
    const v: Fn = (x, y) => y >= 46 && y <= 54 && ax(x) <= (55 - y) * 0.8
    paint(b, v, (x, y) => shade(x, y, (x - 30) * 0.6, S))
    outer(b, (x, y) => v(x, y) || (y < 46 && ax(x) <= 4))
    set(b, 32, 55, '#F2B33D')
    set(b, 31, 54, '#F2B33D')
    set(b, 33, 54, '#F2B33D')
  }
  if (who === 'pike' || who === 'doyle') {
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

  // eyes
  const away = who === 'doyle' && mood !== 'angry' ? -1 : 0
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
  // brows
  for (let i = 0; i <= 6; i++) {
    const dy = mood === 'angry' ? Math.round(i / 3) - 1 : mood === 'nervous' || mood === 'broken' ? 1 - Math.round(i / 3) : 0
    set(b, 22 + i, 24 + dy, K)
    set(b, 42 - i, 24 + dy, K)
  }
  // glasses
  if (who === 'pike') {
    for (let y = 22; y <= 34; y++)
      for (let x = 18; x <= 46; x++) {
        const dl = Math.hypot(x - 25.5, y - 28.5)
        const dr = Math.hypot(x - 38.5, y - 28.5)
        if (Math.abs(dl - 4.4) < 0.6 || Math.abs(dr - 4.4) < 0.6) set(b, x, y, K)
      }
    for (let x = 30; x <= 33; x++) set(b, x, 27, K)
    set(b, 22, 26, '#F4ECD8')
  }
  // mouth
  const lip = who === 'lorraine' ? '#C8323C' : '#5A2E26'
  if (mood === 'calm') for (let x = 29; x <= 35; x++) set(b, x, 38, lip)
  else if (mood === 'angry') {
    for (let x = 31; x <= 33; x++) set(b, x, 38, lip)
    for (const x of [29, 30, 34, 35]) set(b, x, 39, lip)
  } else if (mood === 'nervous') for (let x = 29; x <= 35; x++) set(b, x, x % 2 ? 39 : 38, lip)
  else {
    for (let x = 30; x <= 34; x++) for (let y = 37; y <= 39; y++) set(b, x, y, y === 38 ? '#7A1E2A' : K)
  }
  if (who === 'lorraine') for (let x = 30; x <= 34; x++) if (mood === 'calm' || mood === 'nervous') set(b, x, 39, '#C8323C')
  if (who === 'lorraine') set(b, 18, 33, '#F2B33D')

  // sweat drop
  if (sweatY !== null) {
    const pts = [[0, 0], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [0, 3]]
    const has = new Set(pts.map(([dx, dy]) => `${42 + dx},${sweatY + dy}`))
    const d: Fn = (x, y) => has.has(`${x},${y}`)
    outer(b, d)
    for (const [dx, dy] of pts) set(b, 42 + dx, sweatY + dy, dx < 0 ? '#F4ECD8' : '#8FD6D2')
  }

  const out: Px = Array(W * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) out[y * W + x] = b[y * W + x] ?? bgPixel(x, y)
  return out
}

export function drawBackdrop(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < 225; y++)
    for (let x = 0; x < 360; x++) {
      const d = Math.hypot((x - 180) / 1.6, y - 90)
      let c = '#0F1220'
      if (d < 60) c = '#2C3350'
      else if (d < 70) c = chk(x, y) ? '#2C3350' : '#1B2033'
      else if (d < 95) c = '#1B2033'
      else if (d < 105) c = chk(x, y) ? '#1B2033' : '#0F1220'
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }
  let s = 7
  for (let i = 0; i < 16; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const x = s % 360
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const y = s % 225
    ctx.fillStyle = '#C27C1E'
    ctx.fillRect(x, y, 1, 1)
  }
}

export const SPRITE_PAL: Record<string, string> = {
  K, W: '#F4ECD8', P: '#E6D5AE', p: '#C4A97A', b: '#8A6E4B', A: '#F2B33D', a: '#C27C1E',
  R: '#C8323C', r: '#7A1E2A', T: '#4FA3A0', t: '#2D6466', N: '#2C3350', n: '#1B2033', S: '#8FD6D2',
}

export const SPRITES: Record<string, string[]> = {
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
