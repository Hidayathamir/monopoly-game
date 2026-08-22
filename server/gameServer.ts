import { gameReducer, createInitialState } from '../src/logic/gameReducer'
import { GameActionType, GamePhase, PendingActionType, BotControlReason, AvatarKind, type GameState, type GameAction, type PlayerAvatar } from '../src/types/game'
import { ServerMessageType } from '../src/types/net'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'
import { decideBotAction } from '../src/logic/bot'
import { BOT_NAMES } from '../src/data/bots'
import { MAX_PLAYERS, PLAYER_COLORS, isValidColor, normalizeColor } from '../src/data/players'
import { DEFAULT_AVATAR, isValidAvatar, isSameAvatar, PRESET_AVATARS, type PresetAvatarId } from '../src/data/avatars'
import { rollControlledDice } from '../src/logic/controlledDice'
import { validateStateStructure, validateStateForRoom, ValidationKind } from '../src/logic/seed'
import { canBuildOnCurrentSpace } from '../src/logic/build'

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
  gracePending: boolean
  color: string | null
  avatar: PlayerAvatar | null
}

const BOT_STEP_MS = 700
const BOT_GRACE_MS = 3_000
const AFK_TIMEOUT_MS = 30_000
const AUTO_END_TURN_MS = 300

export class GameServer {
  private state: GameState
  private slots: Slot[] = Array.from({ length: MAX_PLAYERS }, () => ({
    clientId: null,
    name: null,
    connected: false,
    isBot: false,
    gracePending: false,
    color: null,
    avatar: null,
  }))
  private events: GameServerEvents
  private rng: () => number
  private code: string
  private hostSlotIndex = 0
  private botSteps = 0
  private botTimer: ReturnType<typeof setTimeout> | null = null
  private afkTimer: ReturnType<typeof setTimeout> | null = null
  private seedEnabled: boolean
  private afkTimeoutMs: number

  constructor(events: GameServerEvents, opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean; seedEnabled?: boolean; afkTimeoutMs?: number }) {
    this.state = createInitialState({ tradesEnabled: opts?.tradesEnabled ?? false })
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.code = opts?.code ?? ''
    this.seedEnabled = opts?.seedEnabled ?? false
    this.afkTimeoutMs = opts?.afkTimeoutMs ?? AFK_TIMEOUT_MS
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
    return this.slots.map((s, i) => ({
      id: i,
      name: s.name,
      connected: s.connected,
      isBot: s.isBot,
      color: s.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
      avatar: s.avatar ?? DEFAULT_AVATAR,
    }))
  }

  join(clientId: ClientId, name: string, opts?: { color?: string; avatar?: PlayerAvatar }): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Nama tidak boleh kosong' })
      return false
    }

    const disconnected = this.slots.find((s) => s.name === trimmed && !s.connected)
    if (disconnected) {
      disconnected.clientId = clientId
      disconnected.connected = true
      disconnected.gracePending = false
      if (this.state.phase !== GamePhase.Setup) {
        this.dispatch({ type: GameActionType.SetBotControl, playerId: this.slots.indexOf(disconnected), controlled: false })
      }
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

    this.slots[index] = {
      clientId,
      name: trimmed,
      connected: true,
      isBot: false,
      gracePending: false,
      color: opts?.color !== undefined && isValidColor(opts.color) && !this.isColorTaken(opts.color, index) ? opts.color : this.nextFreeColor(),
      avatar: opts?.avatar !== undefined && isValidAvatar(opts.avatar) && !this.isAvatarTaken(opts.avatar, index) ? opts.avatar : this.nextFreePresetAvatar(),
    }
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

  setIdentity(clientId: ClientId, opts: { color?: string; avatar?: PlayerAvatar }): void {
    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Identitas hanya bisa diubah sebelum permainan dimulai' })
      return
    }
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) return
    const slot = this.slots[index]
    if (opts.color !== undefined) {
      if (!isValidColor(opts.color)) {
        this.events.send(clientId, { type: ServerMessageType.Error, message: 'Warna tidak valid' })
        return
      }
      if (this.isColorTaken(opts.color, index)) {
        this.events.send(clientId, { type: ServerMessageType.Error, message: 'Warna sudah dipakai' })
        return
      }
    }
    if (opts.avatar !== undefined) {
      if (!isValidAvatar(opts.avatar)) {
        this.events.send(clientId, { type: ServerMessageType.Error, message: 'Avatar tidak valid' })
        return
      }
      if (this.isAvatarTaken(opts.avatar, index)) {
        this.events.send(clientId, { type: ServerMessageType.Error, message: 'Avatar sudah dipakai' })
        return
      }
    }
    if (opts.color !== undefined) slot.color = opts.color
    if (opts.avatar !== undefined) slot.avatar = opts.avatar
    this.broadcast()
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
    this.slots[index] = { clientId: null, name, connected: true, isBot: true, gracePending: false, color: this.nextFreeColor(), avatar: this.nextFreePresetAvatar() }
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
    this.slots[playerId] = { clientId: null, name: null, connected: false, isBot: false, gracePending: false, color: null, avatar: null }
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
      colors: joined.map((s) => s.color ?? PLAYER_COLORS[this.slots.indexOf(s) % PLAYER_COLORS.length]),
      avatars: joined.map((s) => s.avatar ?? DEFAULT_AVATAR),
    })
  }

  seedState(state: GameState): void {
    if (!this.seedEnabled) {
      throw new Error('seeding disabled')
    }
    const structural = validateStateStructure(state)
    if (structural.kind !== ValidationKind.Ok) {
      throw new Error(`Invalid seed state: ${structural.message}`)
    }
    const roomCheck = validateStateForRoom(state, this.slots)
    if (roomCheck.kind !== ValidationKind.Ok) {
      throw new Error(`Invalid seed state: ${roomCheck.message}`)
    }
    this.clearBotTimer()
    this.clearAfkTimer()
    this.botSteps = 0
    this.state = { ...state, tradesEnabled: this.state.tradesEnabled }
    this.broadcast()
    this.driveBots()
    this.scheduleAutoSteps()
  }

  leave(clientId: ClientId): void {
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) {
      this.events.send(clientId, { type: ServerMessageType.Left })
      return
    }

    if (this.state.phase === GamePhase.Setup) {
      this.slots[index] = { clientId: null, name: null, connected: false, isBot: false, gracePending: false, color: null, avatar: null }
      if (index === this.hostSlotIndex) {
        this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
      }
      const hasHuman = this.slots.some((s) => s.clientId !== null || (s.name !== null && !s.isBot))
      if (!hasHuman) {
        this.slots.forEach((s, i) => {
          if (s.isBot) this.slots[i] = { clientId: null, name: null, connected: false, isBot: false, gracePending: false, color: null, avatar: null }
        })
      }
    } else {
      this.slots[index].connected = false
      this.slots[index].clientId = null
      this.slots[index].gracePending = true
    }

    this.events.send(clientId, { type: ServerMessageType.Left })
    if (this.state.phase === GamePhase.Setup) {
      this.broadcast()
    } else {
      this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: true })
    }
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
    this.clearAfkIfHuman(clientId)
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
    if (action.type === GameActionType.SetBotControl) return
    if (action.type === GameActionType.SetReconnectGrace) return
    if (
      !this.state.tradesEnabled &&
      (action.type === GameActionType.ProposeTrade ||
        action.type === GameActionType.AcceptTrade ||
        action.type === GameActionType.RejectTrade ||
        action.type === GameActionType.CancelTrade)
    ) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Fitur pertukaran tidak tersedia' })
      return
    }
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
    this.clearAfkIfHuman(clientId)
    this.dispatch(action)
  }

  disconnect(clientId: ClientId): void {
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) return
    const slot = this.slots[index]
    slot.connected = false
    slot.clientId = null
    slot.gracePending = true
    if (this.state.phase === GamePhase.Setup && index === this.hostSlotIndex) {
      this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
    }
    if (this.state.phase === GamePhase.Setup) {
      this.broadcast()
    } else {
      this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: true })
    }
  }

  private isTurn(clientId: ClientId): boolean {
    if (this.state.phase === GamePhase.Setup) return false
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    return index !== -1 && index === this.state.currentPlayer
  }

  private isColorTaken(color: string, exceptIndex: number): boolean {
    const norm = normalizeColor(color);
    return this.slots.some((s, i) => i !== exceptIndex && s.name !== null && s.color !== null && normalizeColor(s.color) === norm);
  }

  private isAvatarTaken(avatar: PlayerAvatar, exceptIndex: number): boolean {
    return this.slots.some((s, i) => i !== exceptIndex && s.name !== null && s.avatar !== null && isSameAvatar(s.avatar, avatar));
  }

  private nextFreePresetAvatar(): PlayerAvatar {
    const taken = new Set(
      this.slots.filter((s) => s.name !== null && s.avatar !== null && s.avatar.kind === AvatarKind.Preset).map((s) => (s.avatar as { kind: typeof AvatarKind.Preset; id: PresetAvatarId }).id),
    )
    const free = (Object.values(PRESET_AVATARS) as PresetAvatarId[]).find((id) => !taken.has(id))
    return free ? { kind: AvatarKind.Preset, id: free } : DEFAULT_AVATAR
  }

  private nextFreeColor(): string {
    const used = new Set(this.slots.map((s) => s.color).filter((c): c is string => c !== null))
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0]
  }

  private isHost(clientId: ClientId): boolean {
    const slot = this.slots.find((s) => s.clientId === clientId)
    return slot !== undefined && this.slots.indexOf(slot) === this.hostSlotIndex
  }

  private dispatch(action: GameAction): void {
    this.applyAction(action)
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
    } else if (this.canAutoAdvanceTurn()) {
      setTimeout(() => {
        if (this.canAutoAdvanceTurn()) {
          this.dispatch({ type: GameActionType.EndTurn })
        }
      }, AUTO_END_TURN_MS)
    }
  }

  private canAutoAdvanceTurn(): boolean {
    const s = this.state
    if (s.phase !== GamePhase.Waiting || s.pendingAction) return false
    const player = s.players[s.currentPlayer]
    const slot = this.slots[s.currentPlayer]
    if (!player || !slot) return false
    if (slot.isBot || !slot.connected || player.botControlled === true) return false
    if (player.inJail || s.dice === null || player.money < 0) return false
    return !canBuildOnCurrentSpace(s)
  }

  private driveBots(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) {
      this.clearBotTimer()
      this.clearAfkTimer()
      return
    }
    const currentPlayer = this.state.currentPlayer
    const slot = this.slots[currentPlayer]
    const player = this.state.players[currentPlayer]
    if (!slot || !player) {
      this.clearBotTimer()
      this.clearAfkTimer()
      this.botSteps = 0
      return
    }
    const isHumanDeciding = !slot.isBot && slot.connected && player.botControlled !== true
    if (isHumanDeciding) {
      this.clearBotTimer()
      this.botSteps = 0
      this.scheduleAfkTimer(currentPlayer)
      return
    }
    this.clearAfkTimer()
    const botControlled = player.botControlled === true
    const isDriveable = slot.isBot || botControlled
    if (!isDriveable) {
      this.clearBotTimer()
      this.botSteps = 0
      return
    }
    const action = decideBotAction(this.state)
    if (!action) {
      this.clearBotTimer()
      this.botSteps = 0
      return
    }
    if (this.botSteps >= 100) return
    if (this.botTimer !== null) return
    this.botSteps++
    const isRealBot = slot.isBot
    const isGraceTurn = !isRealBot && slot.gracePending
    if (isGraceTurn) slot.gracePending = false
    const delay = isGraceTurn ? BOT_GRACE_MS : BOT_STEP_MS

    this.botTimer = setTimeout(() => {
      this.botTimer = null
      if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
      const current = this.slots[currentPlayer]
      const stillBotControlled = this.state.players[currentPlayer]?.botControlled === true
      const stillDriveable = current?.isBot === true || stillBotControlled
      if (!current || !stillDriveable) return
      const actionNow = decideBotAction(this.state)
      if (!actionNow) {
        this.clearReconnectGrace(currentPlayer)
        return
      }
      if (actionNow.type === GameActionType.RollDice) this.startRoll()
      else this.dispatch(actionNow)
      this.clearReconnectGrace(currentPlayer)
    }, delay)

    if (isGraceTurn) {
      this.dispatch({
        type: GameActionType.SetReconnectGrace,
        playerId: currentPlayer,
        until: Date.now() + BOT_GRACE_MS,
      })
    }
  }

  private scheduleAfkTimer(playerId: number): void {
    this.clearAfkTimer()
    this.afkTimer = setTimeout(() => {
      this.afkTimer = null
      if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
      if (this.state.currentPlayer !== playerId) return
      const cur = this.slots[playerId]
      const p = this.state.players[playerId]
      if (!cur || cur.isBot || !cur.connected) return
      if (!p || p.botControlled) return
      this.dispatch({ type: GameActionType.SetBotControl, playerId, controlled: true, reason: BotControlReason.Afk })
    }, this.afkTimeoutMs)
  }

  private clearAfkTimer(): void {
    if (this.afkTimer !== null) {
      clearTimeout(this.afkTimer)
      this.afkTimer = null
    }
  }

  private clearAfkIfHuman(clientId: ClientId): void {
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) return
    const slot = this.slots[index]
    if (slot.connected && this.state.players[index]?.botControlled === true) {
      this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: false })
    }
  }

  stop(): void {
    this.clearBotTimer()
    this.clearAfkTimer()
  }

  private clearReconnectGrace(playerId: number): void {
    if (this.state.reconnectGrace?.playerId === playerId) {
      this.dispatch({ type: GameActionType.SetReconnectGrace, playerId, until: null })
    }
  }

  private clearBotTimer(): void {
    if (this.botTimer !== null) {
      clearTimeout(this.botTimer)
      this.botTimer = null
    }
  }

  private broadcast(): void {
    this.events.broadcastState(this.state)
    this.events.broadcastLobby(this.getPlayers(), this.hostSlotIndex)
  }
}
