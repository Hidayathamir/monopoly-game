import { GameServer } from './gameServer'
import { ServerMessageType } from '../src/types/net'
import type { RoomInfo, ServerMessage } from '../src/types/net'

export type ClientId = string

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5
const ROOM_EMPTY_GRACE_MS = 30_000
const AFK_TIMEOUT_MS = 30_000

export class RoomManager {
  private rooms = new Map<string, GameServer>()
  private clientRoom = new Map<ClientId, string>()
  private roomClients = new Map<string, Set<ClientId>>()
  private teardownTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private rng: () => number
  private tradesEnabled: boolean
  private seedEnabled: boolean
  private roomEmptyGraceMs: number
  private afkTimeoutMs: number
  private events: { send(clientId: ClientId, message: ServerMessage): void }

  constructor(
    events: { send(clientId: ClientId, message: ServerMessage): void },
    opts?: { rng?: () => number; tradesEnabled?: boolean; seedEnabled?: boolean; roomEmptyGraceMs?: number; afkTimeoutMs?: number },
  ) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.tradesEnabled = opts?.tradesEnabled ?? false
    this.seedEnabled = opts?.seedEnabled ?? false
    this.roomEmptyGraceMs = opts?.roomEmptyGraceMs ?? ROOM_EMPTY_GRACE_MS
    this.afkTimeoutMs = opts?.afkTimeoutMs ?? AFK_TIMEOUT_MS
  }

  create(): { code: string; game: GameServer } {
    const code = this.generateCode()
    const game = new GameServer(
      {
        broadcastState: (state) =>
          this.broadcastToRoom(code, { type: ServerMessageType.State, state }),
        broadcastLobby: (players, hostPlayerId) =>
          this.broadcastToRoom(code, { type: ServerMessageType.Lobby, players, hostPlayerId }),
        broadcastEmoticon: (emotion) =>
          this.broadcastToRoom(code, {
            type: ServerMessageType.Emoticon,
            playerId: emotion.playerId,
            emoticon: emotion.emoticon,
          }),
        send: (clientId, msg) => this.events.send(clientId, msg),
      },
      { code, rng: this.rng, tradesEnabled: this.tradesEnabled, seedEnabled: this.seedEnabled, afkTimeoutMs: this.afkTimeoutMs },
    )
    this.rooms.set(code, game)
    this.roomClients.set(code, new Set())
    return { code, game }
  }

  get(code: string): GameServer | undefined {
    return this.rooms.get(code)
  }

  list(): RoomInfo[] {
    const infos: RoomInfo[] = []
    for (const [code, game] of this.rooms) {
      const players = game.getPlayers()
      const hostName = players[game.getHostPlayerId()]?.name ?? null
      const playerCount = players.filter((p) => p.name !== null).length
      if (playerCount === 0) continue
      infos.push({ code, hostName, playerCount, phase: game.getState().phase })
    }
    return infos
  }

  gameFor(clientId: ClientId): GameServer | undefined {
    const code = this.clientRoom.get(clientId)
    return code ? this.rooms.get(code) : undefined
  }

  addClient(code: string, clientId: ClientId): void {
    this.clientRoom.set(clientId, code)
    this.roomClients.get(code)?.add(clientId)
    this.clearTeardown(code)
  }

  removeClient(clientId: ClientId): string | undefined {
    const code = this.clientRoom.get(clientId)
    if (!code) return undefined
    const members = this.roomClients.get(code)
    members?.delete(clientId)
    if (members && members.size === 0) {
      const game = this.rooms.get(code)
      if (game) this.evaluateTeardown(code, game)
    }
    this.clientRoom.delete(clientId)
    return code
  }

  private evaluateTeardown(code: string, game: GameServer): void {
    const players = game.getPlayers()
    const hasNamedHuman = players.some((p) => !p.isBot && p.name !== null)
    const hasConnectedHuman = players.some((p) => !p.isBot && p.connected)
    this.clearTeardown(code)
    if (!hasNamedHuman) {
      this.deleteRoom(code)
      return
    }
    if (!hasConnectedHuman) {
      const timer = setTimeout(() => this.deleteRoom(code), this.roomEmptyGraceMs)
      this.teardownTimers.set(code, timer)
    }
  }

  private clearTeardown(code: string): void {
    const timer = this.teardownTimers.get(code)
    if (timer) {
      clearTimeout(timer)
      this.teardownTimers.delete(code)
    }
  }

  private deleteRoom(code: string): void {
    this.clearTeardown(code)
    const game = this.rooms.get(code)
    if (!game) return
    game.stop()
    this.rooms.delete(code)
    this.roomClients.delete(code)
    for (const [clientId, roomCode] of this.clientRoom) {
      if (roomCode === code) this.clientRoom.delete(clientId)
    }
  }

  private broadcastToRoom(code: string, message: ServerMessage): void {
    const members = this.roomClients.get(code)
    if (!members) return
    for (const clientId of members) this.events.send(clientId, message)
  }

  private generateCode(): string {
    let code: string
    do {
      code = ''
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(this.rng() * CODE_ALPHABET.length)]
      }
    } while (this.rooms.has(code))
    return code
  }
}
