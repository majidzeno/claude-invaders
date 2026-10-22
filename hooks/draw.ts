import type { Game } from '../types'

import { H, W, rows } from './game'

export type Cell = { ch: string; color?: string; isBold?: boolean; isDim?: boolean }

export type Span = { text: string; color?: string; isBold?: boolean; isDim?: boolean }

const INVADER = ['*', '#', '%']
const INVADER_COLOR = ['green', 'cyan', 'magenta']

/** A fixed starfield, so the backdrop never flickers between frames. */
function isStar(x: number, y: number): boolean {
  return (x * 7 + y * 13) % 31 === 0
}

/** The playfield as H rows of W cells. Pure, and the only place glyphs live. */
export function field(game: Game): Cell[][] {
  const grid: Cell[][] = []
  for (let y = 0; y < H; y += 1) {
    const row: Cell[] = []
    for (let x = 0; x < W; x += 1) {
      row.push(isStar(x, y) ? { ch: '.', isDim: true } : { ch: ' ' })
    }
    grid.push(row)
  }

  const put = (x: number, y: number, cell: Cell): void => {
    const row = grid[y]
    if (row === undefined || x < 0 || x >= W) return
    row[x] = cell
  }

  for (const shield of game.shields) {
    if (shield.hp <= 0) continue
    put(shield.x, shield.y, {
      ch: shield.hp >= 3 ? '=' : shield.hp === 2 ? '-' : '.',
      color: 'blue',
      isBold: shield.hp >= 3,
    })
  }

  for (const invader of game.invaders) {
    put(invader.x, invader.y, {
      ch: INVADER[invader.kind] ?? '*',
      color: INVADER_COLOR[invader.kind] ?? 'green',
      isBold: true,
    })
  }

  for (const bomb of game.bombs) put(bomb.x, bomb.y, { ch: '!', color: 'red' })
  for (const shot of game.shots) put(shot.x, shot.y, { ch: '|', color: 'yellow', isBold: true })

  put(game.ship, rows.ship, {
    ch: game.isOver ? 'x' : '^',
    color: game.isOver ? 'red' : 'cyan',
    isBold: true,
  })

  for (const blast of game.blasts) {
    put(blast.x, blast.y, { ch: blast.t > 1 ? '*' : '+', color: 'yellow', isBold: true })
  }

  return grid
}

/** Runs of like-styled cells, so a row is a handful of spans, not W of them. */
export function spans(row: Cell[]): Span[] {
  const out: Span[] = []
  for (const cell of row) {
    const last = out[out.length - 1]
    const isSame =
      last !== undefined &&
      last.color === cell.color &&
      last.isBold === cell.isBold &&
      last.isDim === cell.isDim
    if (isSame && last !== undefined) {
      last.text += cell.ch
    } else {
      out.push({ text: cell.ch, color: cell.color, isBold: cell.isBold, isDim: cell.isDim })
    }
  }

  return out
}

export function scoreboard(game: Game, hi: number): string {
  const lives = game.lives > 0 ? '^'.repeat(game.lives) : '-'

  return `SCORE ${game.score}   HI ${Math.max(hi, game.score)}   WAVE ${game.wave}   ${lives}`
}
