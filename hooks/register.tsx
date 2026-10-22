import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Game } from '../types'

import { field, scoreboard, spans } from './draw'
import { W, fire, moveShip, newGame, paused, step } from './game'
import { fit, svgAlt, svgField } from './sprites'

const PANE = 'invaders'
const TICK_MS = 200
const PANE_ROWS = 22
const HINT = '← → steer · space fires · keep the cursor in the prompt box'

// A key probe: the composer is the one site that reports a key to a hook, so
// if the arrows never arrive these lines say what did.
const PROBE = 12
let probed = 0

const game = atom({ plugin: 'idle-invaders', key: 'game' } as const, null)
const hi = atom({ plugin: 'idle-invaders', key: 'hi' } as const, 0)
const isBusy = atom({ plugin: 'idle-invaders', key: 'isBusy' } as const, false)
const isAuto = atom({ plugin: 'idle-invaders', key: 'isAuto' } as const, true)

// A reload starts these over, which is what they are for: the live timer, the
// high score read back from the store, and whether a game is up for the keys.
let timer: Timer | null = null
let best = 0
let isListed = false
let isLive = false

// Every function a hook hands `$` to is declared here, at the top of the file:
// the engine refuses a module that passes `$` into a closure made inside
// `register`, and says so by naming the call it stopped at.

function say($: EngineInterface, line: string): void {
  $.ui.log(`invaders: ${line}`)
}

/**
 * The slash command, asked for by whichever hook runs first. A mod loaded into
 * a session already under way may never see `session.start`.
 */
async function ensureCommand($: EngineInterface): Promise<void> {
  if (isListed) return
  isListed = true
  const listed = await $.command.register({
    name: 'invaders',
    description: 'Play Invaders in a pane while Claude works',
    argumentHint: 'on | off | new',
  })
  say($, `/${listed.command} is listed`)
}

function stopLoop(): void {
  timer?.cancel()
  timer = null
}

async function advance($: EngineInterface): Promise<void> {
  const now = await update($, game, held => (held === null ? held : step(held)))
  if (now === null) return

  isLive = !now.isOver && !now.isPaused
  $.ui.status(`invaders ${now.score}`)

  if (now.score > best) {
    best = now.score
    await update($, hi, () => best)
    await $.store.set('hi', best)
  }
  if (now.isOver || now.isPaused) stopLoop()
}

function startLoop($: EngineInterface): void {
  if (timer !== null) return
  timer = $.clock.every(TICK_MS, () => void advance($))
}

/** Puts a playable game in state: a fresh one, or the held one unpaused. */
async function arm($: EngineInterface, isFresh: boolean): Promise<void> {
  const seed = await $.clock.now()
  const now = await update($, game, held =>
    isFresh || held === null || held.isOver ? newGame(1, seed) : paused(held, false),
  )
  isLive = now !== null && !now.isOver && !now.isPaused
}

async function toggle($: EngineInterface): Promise<void> {
  const now = await update($, game, held => (held === null ? held : paused(held, !held.isPaused)))
  isLive = now !== null && !now.isOver && !now.isPaused
}

/** Steers from a key or a press; `dx` of 0 fires. */
async function act($: EngineInterface, dx: number): Promise<void> {
  await update($, game, held =>
    held === null ? held : dx === 0 ? fire(held) : moveShip(held, dx),
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await ensureCommand($)

    const kept = Number((await $.store.get('hi')) ?? 0)
    best = Number.isFinite(kept) ? kept : 0
    await update($, hi, () => best)

    const auto = await $.store.get('isAuto')
    await update($, isAuto, () => auto !== false)

    return next(e)
  })

  // Claude starts thinking: the pane opens and the wave marches.
  on('turn.start', async ($, e, next) => {
    const started = await next(e)
    if (e.agentId !== undefined) return started

    await ensureCommand($)
    if (!(await read($, isAuto))) return started

    await update($, isBusy, () => true)
    await arm($, false)

    const seat = await $.ui.open({ id: PANE, title: 'Invaders', rows: PANE_ROWS })
    if (seat.isPlaced) {
      startLoop($)
    } else {
      say($, `the pane was not placed: ${seat.reason}`)
    }

    return started
  })

  // Claude is back: the wave holds where it stands.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done

    stopLoop()
    isLive = false
    $.ui.status(undefined)
    await update($, isBusy, () => false)
    await update($, game, held => (held === null ? held : paused(held, true)))

    return done
  })

  on('session.end', ($, e, next) => {
    stopLoop()

    return next(e)
  })

  /**
   * The arrow keys, which no pane can hear: the composer does. While a game is
   * up and the box is empty, a cursor key or a space steers the ship instead of
   * the caret and is consumed; everything else, and every key over a draft the
   * person is writing, goes through untouched.
   */
  on('prompt.edit', async ($, e, next) => {
    const key = e.key
    if (!isLive || e.text !== '' || key === undefined) return next(e)
    if (key.ctrl === true || key.meta === true) return next(e)

    if (probed < PROBE) {
      probed += 1
      say($, `the composer reported the key "${key.key}"`)
    }

    const dx = key.key === 'left' ? -1 : key.key === 'right' ? 1 : 0
    const isFire = key.key === 'up' || key.key === 'space' || key.key === ' '
    if (dx === 0 && !isFire) return next(e)

    await act($, dx)

    return { text: e.text, cursor: e.cursor }
  })

  on('command.run', { command: 'invaders' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'off') {
      stopLoop()
      isLive = false
      await update($, isAuto, () => false)
      await $.store.set('isAuto', false)
      await $.ui.close({ id: PANE })

      return { text: 'Invaders stays shut while Claude works. `/invaders on` brings it back.' }
    }

    if (arg === 'on') {
      await update($, isAuto, () => true)
      await $.store.set('isAuto', true)

      return { text: 'Invaders will open on its own the next time Claude goes to work.' }
    }

    await arm($, arg === 'new')
    // No `focus`: a focused pane swallows the arrows (they scroll it), and the
    // composer is the only site that reports a key to a hook.
    const seat = await $.ui.open({ id: PANE, title: 'Invaders', rows: PANE_ROWS })
    if (seat.isPlaced) startLoop($)

    return {
      text: seat.isPlaced
        ? `Invaders is up. ${HINT}`
        : `Invaders could not be placed here: ${seat.reason}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const held = await read($, game)
    const top = await read($, hi)
    const busy = await read($, isBusy)

    const note =
      held === null
        ? `High score ${top}. Press n for a wave.`
        : held.isOver
          ? `GAME OVER at ${held.score}. Press n.`
          : held.isPaused
            ? busy
              ? 'Paused while Claude works. Press p.'
              : 'Claude is back. Press p to play on.'
            : busy
              ? HINT
              : `In play. ${HINT}`

    // The terminal draws no SVG, so there it stays a field of characters.
    if (e.surface === 'terminal') {
      const { Box, Button, Text } = $.ui.resolve(e)

      if (e.props.bodyColumns < W) {
        return (
          <Box flexDirection="column">
            <Text>Invaders wants {W} columns; this pane has {e.props.bodyColumns}.</Text>
            <Text dimColor>Drag it wider, or run /invaders in a wider window.</Text>
          </Box>
        )
      }

      return (
        <Box flexDirection="column">
          <Text bold>{held === null ? 'INVADERS' : scoreboard(held, top)}</Text>
          {held !== null &&
            field(held).map(row => (
              <Text>
                {spans(row).map(span => (
                  <Text color={span.color} bold={span.isBold} dimColor={span.isDim}>
                    {span.text}
                  </Text>
                ))}
              </Text>
            ))}
          <Text color={held?.isOver === true ? 'red' : busy ? 'yellow' : 'cyan'}>{note}</Text>
          <Box gap={1}>
            <Button key="left" hotkey="a" plain onPress={() => void act($, -1)}>
              {'<'}
            </Button>
            <Button key="right" hotkey="d" plain onPress={() => void act($, 1)}>
              {'>'}
            </Button>
            <Button key="fire" hotkey="f" plain onPress={() => void act($, 0)}>
              fire
            </Button>
            <Button key="pause" hotkey="p" plain onPress={() => void toggle($)}>
              {held?.isPaused === true ? 'play' : 'pause'}
            </Button>
            <Button
              key="new"
              hotkey="n"
              plain
              onPress={() => {
                void arm($, true)
                startLoop($)
              }}
            >
              new
            </Button>
          </Box>
        </Box>
      )
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)

    // The pane says its room in cells; the SVG takes a box of about that many
    // pixels, less the rows the note and the buttons need, and fits itself in.
    // A surface that stretches the box would squash the sprites, so the box is
    // cut to the field's own shape before it is handed over.
    const roomRows = Math.max(6, (e.props.scroll.bodyRows ?? 20) - 4)
    const box = fit({
      width: Math.min(900, Math.max(260, e.props.bodyColumns * 7)),
      height: Math.max(130, roomRows * 16),
    })

    return (
      <Box flexDirection="column">
        {held !== null && (
          <Svg
            source={svgField(held, top)}
            alt={svgAlt(held)}
            width={box.width}
            height={box.height}
            isInteractive
          />
        )}
        <Text dimColor>{note}</Text>
        <Box gap={1}>
          <Button key="left" hotkey="a" onPress={() => void act($, -1)}>
            {'◀'}
          </Button>
          <Button key="right" hotkey="d" onPress={() => void act($, 1)}>
            {'▶'}
          </Button>
          <Button key="fire" hotkey="f" variant="primary" onPress={() => void act($, 0)}>
            fire
          </Button>
          <Button key="pause" hotkey="p" onPress={() => void toggle($)}>
            {held?.isPaused === true ? 'play' : 'pause'}
          </Button>
          <Button
            key="new"
            hotkey="n"
            onPress={() => {
              void arm($, true)
              startLoop($)
            }}
          >
            new
          </Button>
        </Box>
      </Box>
    )
  })
}
