# Idle Invaders

A Space Invaders pane for [Claude Code](https://claude.com/claude-code). It opens
on its own when Claude starts working and holds the wave the moment the answer
lands, so the wait has something in it.

Real sprites, not characters: the wave, the bunkers, the cannon and the bombs
are drawn as one SVG, and the formation breathes between frames. In the
terminal, which draws no SVG, the same game is drawn as a field of characters.


## Install

At the prompt of a terminal session:

```
/plugin install idle-invaders --marketplace majidzeno/idle-invaders
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first;
Enter takes it). In the desktop app, where `/plugin` does not run: click **+**
next to the prompt box, then **Plugins**, **Add marketplace** with
`majidzeno/idle-invaders`, then **Add plugin**.

From a shell:

```
claude plugin install idle-invaders --marketplace majidzeno/idle-invaders
```

Requires a Claude Code build with the `session.start` and `command.run` function
hooks (2.1.304 and newer). On an older build the hooks module will not load.

## Playing

**The arrow keys steer.** No pane on any surface can hear a key — the engine
hands keys only to a `Client`, which the VS Code and mobile tables do not carry
— so the controls listen at the prompt box instead: while a game is up and the
composer is empty, left and right steer the cannon, space or up fires, and those
keys are consumed so the caret never moves. Type anything into the box and the
keys are yours again, untouched.

The buttons under the field do the same, by mouse, anywhere. Each also carries a
letter for when the pane itself holds the keyboard (click it, or `ctrl+x` then
`tab`).

| Key       | Button  | What it does               |
| --------- | ------- | -------------------------- |
| `←`       | `◀` `a` | move left                  |
| `→`       | `▶` `d` | move right                 |
| `space` `↑` | `fire` `f` | fire (two shots in flight) |
|           | `pause` `p` | pause, or play on      |
|           | `new` `n`   | new game               |

| Sprite        | Worth                           |
| ------------- | ------------------------------- |
| top row       | 30 points                       |
| middle rows   | 20 points                       |
| bottom row    | 10 points                       |
| bunker        | three hits and it is gone       |

Three lives. The wave speeds up as it thins out, and each new wave is faster and
drops more bombs. Clear one for 100 points. Let the formation reach the cannon
and the game is over. The high score is kept across sessions.

## Commands

| Command        | What it does                                        |
| -------------- | --------------------------------------------------- |
| `/invaders`    | open the pane and play now                          |
| `/invaders new` | open it and start a fresh game                     |
| `/invaders off` | stop opening it on its own                         |
| `/invaders on`  | open it on its own again                           |

The terminal's character field needs 30 columns of pane body; narrower than that
it says so instead of drawing a broken one. The SVG scales to whatever width the
pane has. Claude Code places a pane a plugin opens
unasked only in a window wide enough for a sidebar (144 terminal columns, 110
once you have opened this pane by hand) — below that, `/invaders` still opens it.

## How it works

Four files, and the game logic is pure so it can be tested without a session.

| File                 | What is in it                                                         |
| -------------------- | --------------------------------------------------------------------- |
| `types/index.d.ts`   | the game's shape, and the `$.state` contract the engine holds it in    |
| `hooks/game.ts`      | the rules: one `step(game)` a frame, seeded randomness, no I/O         |
| `hooks/sprites.ts`   | the pixel maps, and the game to one SVG document                       |
| `hooks/draw.ts`      | the terminal's fallback: the game to a grid of styled cells            |
| `hooks/register.tsx` | the hooks: open on `turn.start`, hold on `turn.complete`, draw a pane  |

Every function that takes `$` is declared at the top of `register.tsx`. The
engine refuses a module that hands `$` to a closure made inside `register`, and
`claude plugin validate` reports the flow it accepted (`$.clock.every (via
startLoop)`).

The loop is `$.clock.every(200, ...)`, which writes the next frame into
`$.state`; that write redraws the pane, so the pane is a function of the game and
nothing more. A frame is only ever computed while a game is running and the pane
is placed: when Claude answers, the timer is cancelled.

## Developing

```sh
claude --plugin-dir /path/to/idle-invaders
```

An interactive session watches the folder and reloads the module when a file is
saved. Then:

```sh
claude plugin validate .   # the manifest and the module, read as the engine will
claude plugin test .       # the tests in tests/
tsc -p .                   # once a session has laid .claude-plugin/types/
```

## License

MIT
