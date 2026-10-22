import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'idle-invaders',
  component: 'Pane',
  requestId: 'invaders',
  props: {
    title: 'Invaders',
    isFocused: true,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 24 },
    view: {},
  },
} as const

test('a turn opens the pane and it plays on every surface', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on, {})
  on('command.register', () => ({ value: { command: 'invaders' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'build me a thing', turnId: 'turn-1' })

  // The terminal draws a field of characters; every other surface draws the SVG.
  const chars = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await chars.find({ type: 'Text', text: /SCORE 0/ })).toBeDefined()
  await chars.press({ key: 'fire' })
  expect(await chars.find({ type: 'Text', text: /\|/ })).toBeDefined()
  await chars.unmount()

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /steer/ })).toBeDefined()
    await ui.press({ key: 'fire' })
    await ui.press({ key: 'right' })

    await ui.unmount()
  }
})

test('a narrow pane says so instead of drawing a broken field', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on, {})
  on('command.register', () => ({ value: { command: 'invaders' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hello', turnId: 'turn-1' })

  const ui = await $.ui.mount({
    ...PANE,
    surface: 'terminal',
    props: { ...PANE.props, bodyColumns: 18 },
  })

  expect(await ui.find({ type: 'Text', text: /columns/ })).toBeDefined()
  await ui.unmount()
})

test('the wave marches while Claude works and holds when the answer lands', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  mock.store(on, {})
  on('command.register', () => ({ value: { command: 'invaders' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hello', turnId: 'turn-1' })
  await clock.advance(2000)

  await $.turn.complete({
    answer: 'done',
    durationMs: 2000,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /Claude is back/ })).toBeDefined()
  await ui.unmount()
})
