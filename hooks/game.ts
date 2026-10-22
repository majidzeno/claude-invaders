import type { Blast, Game, Invader, Shield, Shot } from '../types'

/** The playfield, in character cells. Fixed, so a pane resize never warps it. */
export const W = 30
export const H = 14

const TOP = 1
const SHIP_ROW = H - 1
const SHIELD_ROW = H - 3
const POINTS = [10, 20, 30]
const SHOTS_IN_FLIGHT = 2

/** xorshift32, so a game replays the same way from the same seed. */
function roll(seed: number): { value: number; seed: number } {
  let x = seed | 0
  if (x === 0) x = 0x2545f491
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  const next = x | 0
  return { value: ((next >>> 0) % 100000) / 100000, seed: next }
}

function formation(): Invader[] {
  const invaders: Invader[] = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      invaders.push({
        x: 2 + col * 3,
        y: TOP + row,
        kind: row === 0 ? 2 : row < 3 ? 1 : 0,
      })
    }
  }

  return invaders
}

function bunkers(): Shield[] {
  const shields: Shield[] = []
  for (const left of [5, 14, 23]) {
    for (let dx = 0; dx < 3; dx += 1) {
      shields.push({ x: left + dx, y: SHIELD_ROW, hp: 3 })
    }
  }

  return shields
}

export function newGame(wave = 1, seed = 0x2545f491, score = 0, lives = 3): Game {
  return {
    seed,
    tick: 0,
    dir: 1,
    ship: Math.floor(W / 2),
    shots: [],
    bombs: [],
    invaders: formation(),
    shields: bunkers(),
    blasts: [],
    score,
    lives,
    wave,
    isOver: false,
    isPaused: false,
  }
}

/** How many ticks the formation takes between steps: fewer left, faster. */
export function cadence(alive: number, wave: number): number {
  return Math.max(1, Math.min(7, Math.ceil(alive / 5)) - (wave - 1))
}

/** One frame. Pure: same game in, same game out. */
export function step(game: Game): Game {
  if (game.isOver || game.isPaused) return game

  let seed = game.seed
  let score = game.score
  let lives = game.lives
  let dir = game.dir
  let isHit = false

  const blasts: Blast[] = game.blasts
    .map(blast => ({ x: blast.x, y: blast.y, t: blast.t - 1 }))
    .filter(blast => blast.t > 0)
  const shields = game.shields.map(shield => ({ ...shield }))
  const invaders = game.invaders.map(invader => ({ ...invader }))
  const killed = new Set<Invader>()

  // A player shot crosses two rows a frame, so it sweeps both of them.
  const shots: Shot[] = []
  for (const shot of game.shots) {
    let isSpent = false
    for (const y of [shot.y - 1, shot.y - 2]) {
      if (y < 0) {
        isSpent = true
        break
      }
      const struck = invaders.find(
        invader => !killed.has(invader) && invader.x === shot.x && invader.y === y,
      )
      if (struck !== undefined) {
        killed.add(struck)
        score += POINTS[struck.kind] ?? 10
        blasts.push({ x: shot.x, y, t: 2 })
        isSpent = true
        break
      }
      const wall = shields.find(
        shield => shield.hp > 0 && shield.x === shot.x && shield.y === y,
      )
      if (wall !== undefined) {
        wall.hp -= 1
        blasts.push({ x: shot.x, y, t: 1 })
        isSpent = true
        break
      }
    }
    if (!isSpent) shots.push({ x: shot.x, y: shot.y - 2 })
  }

  const alive = invaders.filter(invader => !killed.has(invader))

  let marching = alive
  if (alive.length > 0 && game.tick % cadence(alive.length, game.wave) === 0) {
    const left = Math.min(...alive.map(invader => invader.x))
    const right = Math.max(...alive.map(invader => invader.x))
    const isWalled = dir > 0 ? right + 1 > W - 2 : left - 1 < 1
    if (isWalled) {
      dir = -dir
      marching = alive.map(invader => ({ ...invader, y: invader.y + 1 }))
    } else {
      marching = alive.map(invader => ({ ...invader, x: invader.x + dir }))
    }
  }

  const bombs: Shot[] = []
  for (const bomb of game.bombs) {
    const y = bomb.y + 1
    if (y > SHIP_ROW) continue
    const wall = shields.find(
      shield => shield.hp > 0 && shield.x === bomb.x && shield.y === y,
    )
    if (wall !== undefined) {
      wall.hp -= 1
      blasts.push({ x: bomb.x, y, t: 1 })
      continue
    }
    if (y === SHIP_ROW && bomb.x === game.ship) {
      lives -= 1
      isHit = true
      blasts.push({ x: game.ship, y, t: 3 })
      continue
    }
    bombs.push({ x: bomb.x, y })
  }

  // A hit clears the sky, the way the arcade gives the next ship a breath.
  const standing = isHit ? [] : bombs

  const dropped = roll(seed)
  seed = dropped.seed
  const chance = 0.08 + 0.03 * (game.wave - 1)
  if (marching.length > 0 && dropped.value < chance && standing.length < 2 + game.wave) {
    const pick = roll(seed)
    seed = pick.seed
    const shooter = marching[Math.floor(pick.value * marching.length)]
    if (shooter !== undefined) standing.push({ x: shooter.x, y: shooter.y + 1 })
  }

  const lowest = marching.reduce((low, invader) => Math.max(low, invader.y), 0)
  if (lowest >= SHIP_ROW - 1) lives = 0

  if (marching.length === 0) {
    return { ...newGame(game.wave + 1, seed, score + 100, lives), blasts }
  }

  return {
    ...game,
    seed,
    tick: game.tick + 1,
    dir,
    shots,
    bombs: standing,
    invaders: marching,
    shields,
    blasts,
    score,
    lives,
    isOver: lives <= 0,
  }
}

export function moveShip(game: Game, dx: number): Game {
  if (game.isOver || game.isPaused) return game

  return { ...game, ship: Math.max(1, Math.min(W - 2, game.ship + dx)) }
}

export function fire(game: Game): Game {
  if (game.isOver || game.isPaused || game.shots.length >= SHOTS_IN_FLIGHT) return game

  return { ...game, shots: [...game.shots, { x: game.ship, y: SHIP_ROW - 1 }] }
}

export function paused(game: Game, isPaused: boolean): Game {
  return game.isOver ? game : { ...game, isPaused }
}

export const rows = { ship: SHIP_ROW, shield: SHIELD_ROW, top: TOP }
