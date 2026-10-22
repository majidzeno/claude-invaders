import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Game } from '../types'

import { field, scoreboard, spans } from './draw'
import { W, fire, moveShip, newGame, paused, step } from './game'

const PANE = 'invaders'
const TICK_MS = 200

const game = atom({ plugin: 'claude-invaders', key: 'game' } as const, null)
const hi = atom({ plugin: 'claude-invaders', key: 'hi' } as const, 0)
const isBusy = atom({ plugin: 'claude-invaders', key: 'isBusy' } as const, false)
const isAuto = atom({ plugin: 'claude-invaders', key: 'isAuto' } as const, true)

export const register: Register = on => {
  let timer: Timer | null = null
  let best = 0
  let hasWarned = false

  const stopLoop = (): void => {
    timer?.cancel()
    timer = null
  }

  const advance = async ($: EngineInterface): Promise<void> => {
    const now = await update($, game, held => (held === null ? held : step(held)))
    if (now === null) return

    if (now.score > best) {
      best = now.score
      await update($, hi, () => best)
      await $.store.set('hi', best)
    }
    if (now.isOver || now.isPaused) stopLoop()
  }

  const startLoop = ($: EngineInterface): void => {
    if (timer !== null) return
    timer = $.clock.every(TICK_MS, () => void advance($))
  }

  /** Puts a playable game in state: a fresh one, or the held one unpaused. */
  const arm = async ($: EngineInterface, isFresh: boolean): Promise<void> => {
    const seed = await $.clock.now()
    await update($, game, held =>
      isFresh || held === null || held.isOver ? newGame(1, seed) : paused(held, false),
    )
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'invaders',
      description: 'Play Invaders in a pane while Claude works',
      argumentHint: 'on | off | new',
    })

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
    if (!(await read($, isAuto))) return started

    await update($, isBusy, () => true)
    await arm($, false)

    const seat = await $.ui.open({ id: PANE, title: 'Invaders' })
    if (seat.isPlaced) {
      startLoop($)
    } else if (!hasWarned) {
      hasWarned = true
      $.ui.toast(`Invaders needs a wider window (${seat.reason}); /invaders opens it anyway.`)
    }

    return started
  })

  // Claude is back: the wave holds where it stands.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done

    stopLoop()
    await update($, isBusy, () => false)
    await update($, game, held => (held === null ? held : paused(held, true)))

    return done
  })

  on('session.end', ($, e, next) => {
    stopLoop()

    return next(e)
  })

  on('command.run', { command: 'invaders' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'off') {
      stopLoop()
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
    const seat = await $.ui.open({ id: PANE, title: 'Invaders', focus: true })
    if (seat.isPlaced) startLoop($)

    return {
      text: seat.isPlaced
        ? 'Invaders is up: a and d steer, f fires, p pauses, n starts a new wave.'
        : `Invaders could not be placed here: ${seat.reason}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const held = await read($, game)
    const top = await read($, hi)
    const busy = await read($, isBusy)

    const press = (change: (now: Game) => Game) => () =>
      void update($, game, now => (now === null ? now : change(now)))

    if (e.props.bodyColumns < W) {
      return (
        <Box flexDirection="column">
          <Text>Invaders wants {W} columns; this pane has {e.props.bodyColumns}.</Text>
          <Text dimColor>Drag it wider, or run /invaders in a wider window.</Text>
        </Box>
      )
    }

    if (held === null) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>INVADERS</Text>
          <Text dimColor>High score {top}. Press n for a wave.</Text>
          <Button
            key="new"
            hotkey="n"
            variant="primary"
            onPress={() => {
              void arm($, true)
              startLoop($)
            }}
          >
            new game
          </Button>
        </Box>
      )
    }

    const note = held.isOver
      ? `GAME OVER at ${held.score}. Press n.`
      : held.isPaused
        ? busy
          ? 'Paused while Claude works. Press p.'
          : 'Claude is back. Press p to play on.'
        : busy
          ? 'Claude is working. Take your time.'
          : 'In play.'

    return (
      <Box flexDirection="column">
        <Text bold>{scoreboard(held, top)}</Text>
        {field(held).map(row => (
          <Text>
            {spans(row).map(span => (
              <Text color={span.color} bold={span.isBold} dimColor={span.isDim}>
                {span.text}
              </Text>
            ))}
          </Text>
        ))}
        <Text color={held.isOver ? 'red' : busy ? 'yellow' : 'cyan'}>{note}</Text>
        <Box gap={1}>
          <Button key="left" hotkey="a" plain onPress={press(held => moveShip(held, -1))}>
            {'<'}
          </Button>
          <Button key="right" hotkey="d" plain onPress={press(held => moveShip(held, 1))}>
            {'>'}
          </Button>
          <Button key="fire" hotkey="f" plain onPress={press(fire)}>
            fire
          </Button>
          <Button
            key="pause"
            hotkey="p"
            plain
            onPress={() => {
              void update($, game, now => (now === null ? now : paused(now, !now.isPaused)))
              startLoop($)
            }}
          >
            {held.isPaused ? 'play' : 'pause'}
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
  })
}
