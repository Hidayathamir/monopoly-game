import { gameReducer, createInitialState } from '../src/logic/gameReducer'
import { GamePhase, type GameState, type GameAction } from '../src/types/game'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'

export type ClientId = string

export interface GameServerEvents {
  broadcastState(state: GameState): void
  broadcastLobby(players: LobbyPlayer[]): void
  send(clientId: ClientId, message: ServerMessage): void
}

interface Slot {
  clientId: ClientId | null
  name: string | null
  connected: boolean
}

const MAX_PLAYERS = 6

export class GameServer {
  private state: GameState = createInitialState()
  private slots: Slot[] = Array.from({ length: MAX_PLAYERS }, () => ({
    clientId: null,
    name: null,
    connected: false,
  }))
  private events: GameServerEvents
  private rng: () => number

  constructor(events: GameServerEvents, opts?: { rng?: () => number }) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
  }

  getState(): GameState {
    return this.state
  }

  getPlayers(): LobbyPlayer[] {
    return this.slots.map((s, i) => ({ id: i, name: s.name, connected: s.connected }))
  }

  join(clientId: ClientId, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      this.events.send(clientId, { type: 'error', message: 'Nama tidak boleh kosong' })
      return
    }

    const disconnected = this.slots.find((s) => s.name === trimmed && !s.connected)
    if (disconnected) {
      disconnected.clientId = clientId
      disconnected.connected = true
      this.events.send(clientId, {
        type: 'welcome',
        playerId: this.slots.indexOf(disconnected),
        players: this.getPlayers(),
        state: this.state,
      })
      this.broadcast()
      return
    }

    if (this.slots.some((s) => s.name === trimmed && s.connected)) {
      this.events.send(clientId, { type: 'error', message: 'Nama sudah dipakai' })
      return
    }

    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: 'error', message: 'Permainan sudah dimulai' })
      return
    }

    const index = this.slots.findIndex((s) => s.clientId === null)
    if (index === -1) {
      this.events.send(clientId, { type: 'error', message: 'Kamar penuh (maks 6 pemain)' })
      return
    }

    this.slots[index] = { clientId, name: trimmed, connected: true }
    this.events.send(clientId, {
      type: 'welcome',
      playerId: index,
      players: this.getPlayers(),
      state: this.state,
    })
    this.broadcast()
  }

  start(clientId: ClientId): void {
    const slot = this.slots.find((s) => s.clientId === clientId)
    if (!slot || this.slots.indexOf(slot) !== 0) {
      this.events.send(clientId, { type: 'error', message: 'Hanya host yang bisa memulai' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) return

    const joined = this.slots.filter((s) => s.clientId !== null)
    if (joined.length < 2) {
      this.events.send(clientId, { type: 'error', message: 'Butuh minimal 2 pemain' })
      return
    }

    this.dispatch({
      type: 'START_GAME',
      playerCount: joined.length,
      names: joined.map((s) => s.name ?? `Pemain`),
    })
  }

  roll(clientId: ClientId): void {
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    if (this.state.phase !== GamePhase.Waiting || this.state.pendingAction || this.state.dice !== null) {
      this.events.send(clientId, { type: 'error', message: 'Belum bisa melempar dadu' })
      return
    }

    this.dispatch({ type: 'ROLL_DICE' })
    const d1 = 1 + Math.floor(this.rng() * 6)
    const d2 = 1 + Math.floor(this.rng() * 6)
    const animDuration = 500 + (d1 + d2) * 150

    setTimeout(() => {
      if (this.state.phase === GamePhase.Rolling) {
        this.dispatch({ type: 'DICE_ANIMATED', dice: [d1, d2] })
        setTimeout(() => {
          if (this.state.phase === GamePhase.Moving) {
            this.dispatch({ type: 'RESOLVE_SPACE' })
          }
        }, animDuration)
      }
    }, 500)
  }

  handleAction(clientId: ClientId, action: GameAction): void {
    if (action.type === 'ROLL_DICE') {
      this.roll(clientId)
      return
    }
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    this.dispatch(action)
  }

  disconnect(clientId: ClientId): void {
    const slot = this.slots.find((s) => s.clientId === clientId)
    if (slot) {
      slot.connected = false
      slot.clientId = null
    }
    this.broadcast()
  }

  private isTurn(clientId: ClientId): boolean {
    if (this.state.phase === GamePhase.Setup) return false
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    return index !== -1 && index === this.state.currentPlayer
  }

  private dispatch(action: GameAction): void {
    this.state = gameReducer(this.state, action)
    this.broadcast()
    this.scheduleAutoSteps()
  }

  private scheduleAutoSteps(): void {
    const s = this.state
    if (s.phase === GamePhase.Resolving && !s.pendingAction) {
      setTimeout(() => {
        if (this.state.phase === GamePhase.Resolving && !this.state.pendingAction) {
          this.dispatch({ type: 'RESOLVE_SPACE' })
        }
      }, 200)
    } else if (s.pendingAction?.type === 'drawCard') {
      setTimeout(() => {
        if (this.state.pendingAction?.type === 'drawCard') {
          this.dispatch({ type: 'DRAW_CARD' })
        }
      }, 300)
    }
  }

  private broadcast(): void {
    this.events.broadcastState(this.state)
    this.events.broadcastLobby(this.getPlayers())
  }
}
