export type Invader = { x: number; y: number; kind: number }

export type Shot = { x: number; y: number }

export type Shield = { x: number; y: number; hp: number }

export type Blast = { x: number; y: number; t: number }

export type Game = {
  seed: number
  tick: number
  dir: number
  ship: number
  shots: Shot[]
  bombs: Shot[]
  invaders: Invader[]
  shields: Shield[]
  blasts: Blast[]
  score: number
  lives: number
  wave: number
  isOver: boolean
  isPaused: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'claude-invaders': {
      game: Game | null
      hi: number
      isBusy: boolean
      isAuto: boolean
    }
  }
}
