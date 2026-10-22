import type { Game } from '../types'

import { H, W, rows } from './game'

/**
 * The sprites, as pixel maps: one character per pixel, `#` drawn. Kept here so
 * the shapes are legible and editable, and turned into `<rect>`s once, in the
 * SVG's `<defs>`, which every invader then `<use>`s.
 */
const SPRITES: Record<string, readonly string[]> = {
  // 10 points: the bottom rows.
  i0: [
    '....####....',
    '.##########.',
    '############',
    '###..##..###',
    '############',
    '...##..##...',
    '..##.##.##..',
    '.##......##.',
  ],
  // 20 points: the middle rows.
  i1: [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...',
  ],
  // 30 points: the top row.
  i2: [
    '...##...',
    '..####..',
    '.######.',
    '##.##.##',
    '########',
    '..#..#..',
    '.#.##.#.',
    '#.#..#.#',
  ],
  ship: [
    '......#......',
    '.....###.....',
    '.....###.....',
    '.###########.',
    '#############',
    '#############',
    '#############',
    '##.#######.##',
  ],
  wreck: [
    '#...#...#..#.',
    '.#.#..#...#..',
    '#...##..#...#',
    '.##.#.###.##.',
    '#.###########',
    '####.######.#',
    '###########.#',
    '#.#######.###',
  ],
}

const CELL = 16
const HEAD = 30
const FIELD_W = W * CELL
const FIELD_H = H * CELL
const TOTAL_H = HEAD + FIELD_H + 10

/** The field's shape, so a caller can hand the element a box that matches it. */
export const ASPECT = FIELD_W / TOTAL_H

/** The largest box of the field's own shape that fits in the room given. */
export function fit(room: { width: number; height: number }): { width: number; height: number } {
  const width = Math.round(Math.min(room.width, room.height * ASPECT))

  return { width, height: Math.round(width / ASPECT) }
}

const INK = {
  i0: '#5de07a',
  i1: '#62d4ff',
  i2: '#ff7ad5',
  ship: '#7cf3ff',
  shot: '#ffe066',
  bomb: '#ff6b6b',
  wall: '#49a0ff',
  wreck: '#ff9f43',
}

/** One pixel map as a run-length row of rects, at one unit per pixel. */
function pixels(map: readonly string[]): string {
  let out = ''
  for (let y = 0; y < map.length; y += 1) {
    const row = map[y] ?? ''
    let x = 0
    while (x < row.length) {
      if (row[x] !== '#') {
        x += 1
        continue
      }
      let run = 1
      while (row[x + run] === '#') run += 1
      out += `<rect x="${x}" y="${y}" width="${run}" height="1"/>`
      x += run
    }
  }

  return out
}

function defs(): string {
  let out = ''
  for (const [name, map] of Object.entries(SPRITES)) {
    const wide = Math.max(...map.map(row => row.length))
    out += `<g id="${name}" data-w="${wide}">${pixels(map)}</g>`
  }

  return out
}

/** A sprite placed on the grid, scaled to sit inside one cell and centred. */
function place(id: string, gx: number, gy: number, color: string, grow = 1): string {
  const map = SPRITES[id] ?? []
  const wide = Math.max(1, ...map.map(row => row.length))
  const tall = Math.max(1, map.length)
  const scale = ((CELL - 2) / wide) * grow
  const x = gx * CELL + 1 - ((wide * scale) - (CELL - 2)) / 2
  const y = HEAD + gy * CELL + (CELL - tall * scale) / 2

  return `<use href="#${id}" x="0" y="0" fill="${color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})"/>`
}

function stars(): string {
  let out = ''
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if ((x * 7 + y * 13) % 31 !== 0) continue
      const cx = x * CELL + CELL / 2
      const cy = HEAD + y * CELL + CELL / 2
      out += `<circle cx="${cx}" cy="${cy}" r="0.9" fill="#2a3358"/>`
    }
  }

  return out
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The whole field as one SVG document: sprites, bunkers, shots and the score.
 * Pure, so a test can read it without a surface.
 */
export function svgField(game: Game, hi: number): string {
  const best = Math.max(hi, game.score)
  const kinds = ['i0', 'i1', 'i2']

  let wave = ''
  let body = ''
  for (const shield of game.shields) {
    if (shield.hp <= 0) continue
    const tall = 4 + shield.hp * 3
    const x = shield.x * CELL + 1
    const y = HEAD + shield.y * CELL + (CELL - tall)
    body += `<rect x="${x}" y="${y}" width="${CELL - 2}" height="${tall}" rx="1.5" fill="${INK.wall}" opacity="${0.45 + shield.hp * 0.18}"/>`
  }

  for (const invader of game.invaders) {
    const id = kinds[invader.kind] ?? 'i0'
    const color = INK[id as 'i0' | 'i1' | 'i2']
    wave += place(id, invader.x, invader.y, color)
  }

  for (const shot of game.shots) {
    const x = shot.x * CELL + CELL / 2 - 1
    const y = HEAD + shot.y * CELL + 2
    body += `<rect x="${x}" y="${y}" width="2" height="${CELL - 4}" rx="1" fill="${INK.shot}"/>`
  }

  for (const bomb of game.bombs) {
    const x = bomb.x * CELL + CELL / 2
    const y = HEAD + bomb.y * CELL + 2
    body += `<path d="M${x} ${y} l-2.5 3 l2.5 3 l-2.5 3 l2.5 3" stroke="${INK.bomb}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  }

  body += place(
    game.isOver ? 'wreck' : 'ship',
    game.ship,
    rows.ship,
    game.isOver ? INK.wreck : INK.ship,
    1.35,
  )

  for (const blast of game.blasts) {
    const cx = blast.x * CELL + CELL / 2
    const cy = HEAD + blast.y * CELL + CELL / 2
    const r = blast.t > 1 ? 7 : 4
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK.shot}" stroke-width="2" opacity="0.9"/>`
  }

  const lives = Array.from({ length: Math.max(0, game.lives) }, (_, n) =>
    `<use href="#ship" fill="${INK.ship}" transform="translate(${FIELD_W - 26 - n * 22} 8) scale(0.85)"/>`,
  ).join('')

  // The wave breathes between ticks, so 200ms frames do not read as stutter.
  const bob =
    game.isOver || game.isPaused
      ? ''
      : '<animateTransform attributeName="transform" type="translate" values="0 0; 0 1.6; 0 0" dur="0.9s" repeatCount="indefinite"/>'

  // No width or height of its own: the element is given a box in pixels and
  // the viewBox fits the whole field inside it, however short the pane is.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_W} ${TOTAL_H}" preserveAspectRatio="xMidYMid meet" role="img">
<defs>${defs()}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0d1c"/><stop offset="1" stop-color="#05060d"/></linearGradient>
</defs>
<rect width="${FIELD_W}" height="${TOTAL_H}" fill="url(#sky)"/>
${stars()}
<text x="6" y="20" fill="#8ea2d8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" letter-spacing="1.5">SCORE ${game.score}</text>
<text x="${FIELD_W / 2}" y="20" fill="#5d6c99" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" letter-spacing="1.5" text-anchor="middle">HI ${best}   WAVE ${game.wave}</text>
${lives}
<g>${bob}${wave}</g>
${body}
<rect x="0" y="${HEAD + FIELD_H + 2}" width="${FIELD_W}" height="2" fill="${INK.i0}" opacity="0.5"/>
</svg>`
}

export function svgAlt(game: Game): string {
  return escape(
    `Invaders: score ${game.score}, wave ${game.wave}, ${game.lives} lives, ${game.invaders.length} invaders left.`,
  )
}
