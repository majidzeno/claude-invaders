import { expect, test } from 'claude-code/testing'

import { W, cadence, fire, moveShip, newGame, step } from '../hooks/game'

test('a shot takes the invader above it and scores', () => {
  const start = newGame()
  const target = start.invaders[0]
  expect(target).toBeDefined()
  if (target === undefined) return

  const aimed = { ...start, ship: target.x, shots: [{ x: target.x, y: target.y + 2 }] }
  const after = step(aimed)

  expect(after.invaders.length).toBe(start.invaders.length - 1)
  expect(after.score).toBeGreaterThan(0)
  expect(after.shots.length).toBe(0)
})

test('the formation reverses and drops at the wall', () => {
  const start = { ...newGame(), invaders: [{ x: W - 2, y: 1, kind: 0 }], dir: 1, tick: 0 }
  const after = step(start)
  const moved = after.invaders[0]

  expect(after.dir).toBe(-1)
  expect(moved?.y).toBe(2)
  expect(moved?.x).toBe(W - 2)
})

test('clearing the wave keeps the score and raises the wave', () => {
  const start = { ...newGame(), invaders: [], score: 250, lives: 2 }
  const after = step(start)

  expect(after.wave).toBe(2)
  expect(after.score).toBe(350)
  expect(after.lives).toBe(2)
  expect(after.invaders.length).toBeGreaterThan(0)
})

test('a bomb on the ship costs a life and clears the sky', () => {
  const start = newGame()
  const aimed = { ...start, bombs: [{ x: start.ship, y: 12 }] }
  const after = step(aimed)

  expect(after.lives).toBe(2)
  expect(after.bombs.length).toBeLessThan(2)
})

test('the ship stays on the field and fires at most twice', () => {
  const start = newGame()

  expect(moveShip({ ...start, ship: 1 }, -1).ship).toBe(1)
  expect(moveShip({ ...start, ship: W - 2 }, 1).ship).toBe(W - 2)
  expect(fire(fire(fire(start))).shots.length).toBe(2)
})

test('the wave speeds up as it thins out', () => {
  expect(cadence(32, 1)).toBeGreaterThan(cadence(4, 1))
  expect(cadence(32, 3)).toBeLessThan(cadence(32, 1))
})

test('a paused or finished game does not move', () => {
  const held = { ...newGame(), isPaused: true }
  expect(step(held)).toBe(held)

  const over = { ...newGame(), isOver: true }
  expect(step(over)).toBe(over)
})
