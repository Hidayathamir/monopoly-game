import { gameReducer, createInitialState } from '../src/logic/gameReducer'
import { GamePhase, type GameState, type GameAction } from '../src/types/game'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'

export type ClientId = string

export interface GameServerEvents {
  broadcastState(state: GameState): void
  broadcastLobby(players: LobbyPlayer[], hostPlayerId: number): void
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
  private code: string
  private hostSlotIndex = 0

  constructor(events: GameServerEvents, opts?: { rng?: () => number; code?: string }) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.code = opts?.code ?? ''
  }

  getState(): GameState {
    return this.state
  }

  getCode(): string {
    return this.code
  }

  getHostPlayerId(): number {
    return this.hostSlotIndex
  }

  getPlayers(): LobbyPlayer[] {
    return this.slots.map((s, i) => ({ id: i, name: s.name, connected: s.connected }))
  }

  join(clientId: ClientId, name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      this.events.send(clientId, { type: 'error', message: 'Nama tidak boleh kosong' })
      return false
    }

    const disconnected = this.slots.find((s) => s.name === trimmed && !s.connected)
    if (disconnected) {
      disconnected.clientId = clientId
      disconnected.connected = true
      this.events.send(clientId, {
        type: 'welcome',
        playerId: this.slots.indexOf(disconnected),
        hostPlayerId: this.hostSlotIndex,
        players: this.getPlayers(),
        state: this.state,
        code: this.code,
      })
      this.broadcast()
      return true
    }

    if (this.slots.some((s) => s.name === trimmed && s.connected)) {
      this.events.send(clientId, { type: 'error', message: 'Nama sudah dipakai' })
      return false
    }

    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: 'error', message: 'Permainan sudah dimulai' })
      return false
    }

    const index = this.slots.findIndex((s) => s.clientId === null)
    if (index === -1) {
      this.events.send(clientId, { type: 'error', message: 'Kamar penuh (maks 6 pemain)' })
      return false
    }

    this.slots[index] = { clientId, name: trimmed, connected: true }
    this.events.send(clientId, {
      type: 'welcome',
      playerId: index,
      hostPlayerId: this.hostSlotIndex,
      players: this.getPlayers(),
      state: this.state,
      code: this.code,
    })
    this.broadcast()
    return true
  }

  start(clientId: ClientId): void {
    const slot = this.slots.find((s) => s.clientId === clientId)
    if (!slot || this.slots.indexOf(slot) !== this.hostSlotIndex) {
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

  leave(clientId: ClientId): void {
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) {
      this.events.send(clientId, { type: 'left' })
      return
    }

    if (this.state.phase === GamePhase.Setup) {
      this.slots[index] = { clientId: null, name: null, connected: false }
      if (index === this.hostSlotIndex) {
        this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
      }
    } else {
      this.slots[index].connected = false
      this.slots[index].clientId = null
    }

    this.events.send(clientId, { type: 'left' })
    this.broadcast()
    this.skipLeftPlayers()
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
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) return
    const slot = this.slots[index]
    slot.connected = false
    slot.clientId = null
    if (this.state.phase === GamePhase.Setup && index === this.hostSlotIndex) {
      this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
    }
    this.broadcast()
    this.skipLeftPlayers()
  }

  private isTurn(clientId: ClientId): boolean {
    if (this.state.phase === GamePhase.Setup) return false
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    return index !== -1 && index === this.state.currentPlayer
  }

  private dispatch(action: GameAction): void {
    this.applyAction(action)
    this.skipLeftPlayers()
  }

  private applyAction(action: GameAction): void {
    this.state = gameReducer(this.state, action)
    this.broadcast()
    this.scheduleAutoSteps()
  }

  private nextConnectedSlot(from: number): number {
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      const idx = (from + i) % MAX_PLAYERS
      if (this.slots[idx].connected) return idx
    }
    return from
  }

  private skipLeftPlayers(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
    let guard = 0
    while (guard++ < MAX_PLAYERS * 2) {
      const slot = this.slots[this.state.currentPlayer]
      if (!slot || slot.connected) return
      const pending = this.state.pendingAction
      if (pending) {
        if (pending.type === 'buyProperty') this.applyAction({ type: 'DECLINE_BUY' })
        else if (pending.type === 'payRent') this.applyAction({ type: 'PAY_RENT' })
        else if (pending.type === 'bankruptcy') this.applyAction({ type: 'DECLARE_BANKRUPTCY' })
        else if (pending.type === 'drawCard') this.applyAction({ type: 'DRAW_CARD' })
        else if (pending.type === 'cardEffect') this.applyAction({ type: 'RESOLVE_CARD' })
        else return
      } else if (this.state.phase === GamePhase.Waiting) {
        this.applyAction({ type: 'END_TURN' })
      } else {
        return
      }
    }
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
    } else if (
      s.phase === GamePhase.Waiting &&
      !s.pendingAction &&
      s.dice !== null &&
      s.dice[0] === s.dice[1] &&
      s.doublesCount > 0
    ) {
      setTimeout(() => {
        const st = this.state
        if (
          st.phase === GamePhase.Waiting &&
          !st.pendingAction &&
          st.dice !== null &&
          st.dice[0] === st.dice[1] &&
          st.doublesCount > 0
        ) {
          this.dispatch({ type: 'END_TURN' })
        }
      }, 500)
    }
  }

  private broadcast(): void {
    this.events.broadcastState(this.state)
    this.events.broadcastLobby(this.getPlayers(), this.hostSlotIndex)
  }
}
