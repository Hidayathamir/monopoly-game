import { gameReducer, createInitialState } from '../src/logic/gameReducer'
import { GameActionType, GamePhase, PendingActionType, type GameState, type GameAction } from '../src/types/game'
import { ServerMessageType } from '../src/types/net'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'
import { decideBotAction } from '../src/logic/bot'
import { BOT_NAMES } from '../src/data/bots'
import { rollControlledDice } from '../src/logic/controlledDice'

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
  isBot: boolean
}

const MAX_PLAYERS = 6

export class GameServer {
  private state: GameState
  private slots: Slot[] = Array.from({ length: MAX_PLAYERS }, () => ({
    clientId: null,
    name: null,
    connected: false,
    isBot: false,
  }))
  private events: GameServerEvents
  private rng: () => number
  private code: string
  private hostSlotIndex = 0
  private botSteps = 0

  constructor(events: GameServerEvents, opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean }) {
    this.state = createInitialState({ tradesEnabled: opts?.tradesEnabled ?? false })
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
    return this.slots.map((s, i) => ({ id: i, name: s.name, connected: s.connected, isBot: s.isBot }))
  }

  join(clientId: ClientId, name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Nama tidak boleh kosong' })
      return false
    }

    const disconnected = this.slots.find((s) => s.name === trimmed && !s.connected)
    if (disconnected) {
      disconnected.clientId = clientId
      disconnected.connected = true
      this.events.send(clientId, {
        type: ServerMessageType.Welcome,
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
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Nama sudah dipakai' })
      return false
    }

    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Permainan sudah dimulai' })
      return false
    }

    let index = this.slots.findIndex((s) => s.clientId === null && !s.isBot)
    if (index === -1) {
      for (let i = this.slots.length - 1; i >= 0; i--) {
        if (this.slots[i].isBot) { index = i; break }
      }
    }
    if (index === -1) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Ruangan penuh (maks 6 pemain)' })
      return false
    }

    this.slots[index] = { clientId, name: trimmed, connected: true, isBot: false }
    this.events.send(clientId, {
      type: ServerMessageType.Welcome,
      playerId: index,
      hostPlayerId: this.hostSlotIndex,
      players: this.getPlayers(),
      state: this.state,
      code: this.code,
    })
    this.broadcast()
    return true
  }

  addBot(clientId: ClientId): void {
    if (!this.isHost(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Hanya host yang bisa menambah bot' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bot hanya bisa ditambah sebelum permainan dimulai' })
      return
    }
    const index = this.slots.findIndex((s) => s.clientId === null && !s.isBot && s.name === null)
    if (index === -1) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Ruangan penuh (maks 6 pemain)' })
      return
    }
    const used = new Set(this.slots.map((s) => s.name).filter((n): n is string => n !== null))
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${index + 1}`
    this.slots[index] = { clientId: null, name, connected: true, isBot: true }
    this.broadcast()
  }

  removeBot(clientId: ClientId, playerId: number): void {
    if (!this.isHost(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Hanya host yang bisa menghapus bot' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bot hanya bisa dihapus sebelum permainan dimulai' })
      return
    }
    const slot = this.slots[playerId]
    if (!slot || !slot.isBot) return
    this.slots[playerId] = { clientId: null, name: null, connected: false, isBot: false }
    this.broadcast()
  }

  start(clientId: ClientId): void {
    if (!this.isHost(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Hanya host yang bisa memulai' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) return

    const joined = this.slots.filter((s) => s.clientId !== null || s.isBot)
    if (joined.length < 2) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Butuh minimal 2 pemain' })
      return
    }

    this.dispatch({
      type: GameActionType.StartGame,
      playerCount: joined.length,
      names: joined.map((s, i) => s.name ?? `P${i + 1}`),
      isBot: joined.map((s) => s.isBot),
    })
  }

  leave(clientId: ClientId): void {
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) {
      this.events.send(clientId, { type: ServerMessageType.Left })
      return
    }

    if (this.state.phase === GamePhase.Setup) {
      this.slots[index] = { clientId: null, name: null, connected: false, isBot: false }
      if (index === this.hostSlotIndex) {
        this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
      }
      const hasHuman = this.slots.some((s) => s.clientId !== null || (s.name !== null && !s.isBot))
      if (!hasHuman) {
        this.slots.forEach((s, i) => {
          if (s.isBot) this.slots[i] = { clientId: null, name: null, connected: false, isBot: false }
        })
      }
    } else {
      this.slots[index].connected = false
      this.slots[index].clientId = null
    }

    this.events.send(clientId, { type: ServerMessageType.Left })
    this.broadcast()
    this.skipLeftPlayers()
  }

  roll(clientId: ClientId, target?: number): void {
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bukan giliranmu' })
      return
    }
    if (this.state.phase !== GamePhase.Waiting || this.state.pendingAction || this.state.dice !== null) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Belum bisa melempar dadu' })
      return
    }
    this.startRoll(target)
  }

  private startRoll(target?: number): void {
    this.dispatch({ type: GameActionType.RollDice })
    let dice: [number, number]
    let aimed: { target: number; luck: number } | undefined
    if (target != null) {
      const result = rollControlledDice(target, this.rng)
      dice = result.dice
      aimed = { target, luck: result.luck }
    } else {
      dice = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)]
    }
    const animDuration = 500 + (dice[0] + dice[1]) * 150

    setTimeout(() => {
      if (this.state.phase === GamePhase.Rolling) {
        this.dispatch({ type: GameActionType.DiceAnimated, dice, ...(aimed ?? {}) })
        setTimeout(() => {
          if (this.state.phase === GamePhase.Moving) {
            this.dispatch({ type: GameActionType.ResolveSpace })
          }
        }, animDuration)
      }
    }, 500)
  }

  handleAction(clientId: ClientId, action: GameAction): void {
    if (action.type === GameActionType.RollDice) {
      this.roll(clientId, action.target)
      return
    }
    const slotIndex = this.slots.findIndex((s) => s.clientId === clientId)
    if (action.type === GameActionType.ProposeTrade) {
      if (action.offer.fromId === slotIndex) {
        this.dispatch(action)
        return
      }
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bukan giliranmu' })
      return
    }
    if (action.type === GameActionType.AcceptTrade || action.type === GameActionType.RejectTrade || action.type === GameActionType.CancelTrade) {
      const trade = this.state.pendingTrades.find((t) => t.id === action.tradeId)
      const expected = action.type === GameActionType.CancelTrade ? trade?.fromId : trade?.toId
      if (trade && expected === slotIndex) {
        this.dispatch(action)
        return
      }
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bukan giliranmu' })
      return
    }
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bukan giliranmu' })
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

  private isHost(clientId: ClientId): boolean {
    const slot = this.slots.find((s) => s.clientId === clientId)
    return slot !== undefined && this.slots.indexOf(slot) === this.hostSlotIndex
  }

  private dispatch(action: GameAction): void {
    this.applyAction(action)
    this.skipLeftPlayers()
  }

  private applyAction(action: GameAction): void {
    this.state = gameReducer(this.state, action)
    this.broadcast()
    this.scheduleAutoSteps()
    this.driveBots()
  }

  private nextConnectedSlot(from: number): number {
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      const idx = (from + i) % MAX_PLAYERS
      if (this.slots[idx].connected && !this.slots[idx].isBot) return idx
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
        if (pending.type === PendingActionType.BuyProperty) this.applyAction({ type: GameActionType.DeclineBuy })
        else if (pending.type === PendingActionType.PayRent) this.applyAction({ type: GameActionType.PayRent })
        else if (pending.type === PendingActionType.Bankruptcy) this.applyAction({ type: GameActionType.DeclareBankruptcy })
        else if (pending.type === PendingActionType.DrawCard) this.applyAction({ type: GameActionType.DrawCard })
        else if (pending.type === PendingActionType.CardEffect) this.applyAction({ type: GameActionType.ResolveCard })
        else return
      } else if (this.state.phase === GamePhase.Waiting) {
        this.applyAction({ type: GameActionType.EndTurn })
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
          this.dispatch({ type: GameActionType.ResolveSpace })
        }
      }, 200)
    } else if (s.pendingAction?.type === PendingActionType.DrawCard) {
      setTimeout(() => {
        if (this.state.pendingAction?.type === PendingActionType.DrawCard) {
          this.dispatch({ type: GameActionType.DrawCard })
        }
      }, 300)
    }
  }

  private driveBots(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
    const slot = this.slots[this.state.currentPlayer]
    if (!slot?.isBot) {
      this.botSteps = 0
      return
    }
    const action = decideBotAction(this.state)
    if (!action) {
      this.botSteps = 0
      return
    }
    if (this.botSteps >= 100) return
    this.botSteps++
    setTimeout(() => {
      const current = this.slots[this.state.currentPlayer]
      if (!current?.isBot) return
      const actionNow = decideBotAction(this.state)
      if (!actionNow) return
      if (actionNow.type === GameActionType.RollDice) this.startRoll()
      else this.dispatch(actionNow)
    }, 700)
  }

  private broadcast(): void {
    this.events.broadcastState(this.state)
    this.events.broadcastLobby(this.getPlayers(), this.hostSlotIndex)
  }
}
