# Idle Invaders

A Space Invaders pane for [Claude Code](https://claude.com/claude-code). It opens
on its own when Claude starts working and holds the wave the moment the answer
lands, so the wait has something in it.

```
SCORE 320   HI 1180   WAVE 2   ^^^

 %  %  %  %  %  %  %  %
 #  #  #  #  #  #  #  #
 #  #  #  #  #  #  #  #
 *  *  *  *  *  *  *  *
         !
              |
   ===     ===     ===
                ^
Claude is working. Take your time.
< > fire pause new
```

Everything is drawn in character cells, so it plays the same in the terminal, in
the desktop app, in the VS Code panel and on mobile.

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

The pane takes the keyboard when you click it, press `ctrl+x` then `tab`, or run
`/invaders`. The buttons are pressable with the mouse either way.

| Key | Button  | What it does                 |
| --- | ------- | ---------------------------- |
| `a` | `<`     | move left                    |
| `d` | `>`     | move right                   |
| `f` | `fire`  | fire (two shots in flight)   |
| `p` | `pause` | pause, or play on            |
| `n` | `new`   | new game                     |

| Glyph | What it is                      |
| ----- | ------------------------------- |
| `%`   | top row invader, 30 points      |
| `#`   | middle invader, 20 points       |
| `*`   | bottom invader, 10 points       |
| `=`   | bunker, three hits and it's out |
| `!`   | bomb                            |
| `^`   | your ship                       |

Three lives. The wave speeds up as it thins out, and each new wave is faster than
the last and drops more bombs. Clear one for 100 points. Let the formation reach
the ship and the game is over. The high score is kept across sessions.

## Commands

| Command        | What it does                                        |
| -------------- | --------------------------------------------------- |
| `/invaders`    | open the pane and play now                          |
| `/invaders new` | open it and start a fresh game                     |
| `/invaders off` | stop opening it on its own                         |
| `/invaders on`  | open it on its own again                           |

The pane needs 30 columns of body to draw the field; narrower than that it says
so instead of drawing a broken one. Claude Code places a pane a plugin opens
unasked only in a window wide enough for a sidebar (144 terminal columns, 110
once you have opened this pane by hand) — below that, `/invaders` still opens it.

## How it works

Four files, and the game logic is pure so it can be tested without a session.

| File                 | What is in it                                                        |
| -------------------- | -------------------------------------------------------------------- |
| `types/index.d.ts`   | the game's shape, and the `$.state` contract the engine holds it in   |
| `hooks/game.ts`      | the rules: one `step(game)` a frame, seeded randomness, no I/O        |
| `hooks/draw.ts`      | the game to a grid of cells, and cells to styled runs                |
| `hooks/register.tsx` | the hooks: open on `turn.start`, hold on `turn.complete`, draw a pane |

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
