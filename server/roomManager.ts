import { GameServer } from './gameServer'
import { ServerMessageType } from '../src/types/net'
import type { ServerMessage } from '../src/types/net'

export type ClientId = string

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5

export class RoomManager {
  private rooms = new Map<string, GameServer>()
  private clientRoom = new Map<ClientId, string>()
  private roomClients = new Map<string, Set<ClientId>>()
  private rng: () => number
  private tradesEnabled: boolean
  private events: { send(clientId: ClientId, message: ServerMessage): void }

  constructor(
    events: { send(clientId: ClientId, message: ServerMessage): void },
    opts?: { rng?: () => number; tradesEnabled?: boolean },
  ) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.tradesEnabled = opts?.tradesEnabled ?? false
  }

  create(): { code: string; game: GameServer } {
    const code = this.generateCode()
    const game = new GameServer(
      {
        broadcastState: (state) =>
          this.broadcastToRoom(code, { type: ServerMessageType.State, state }),
        broadcastLobby: (players, hostPlayerId) =>
          this.broadcastToRoom(code, { type: ServerMessageType.Lobby, players, hostPlayerId }),
        send: (clientId, msg) => this.events.send(clientId, msg),
      },
      { code, rng: this.rng, tradesEnabled: this.tradesEnabled },
    )
    this.rooms.set(code, game)
    this.roomClients.set(code, new Set())
    return { code, game }
  }

  get(code: string): GameServer | undefined {
    return this.rooms.get(code)
  }

  gameFor(clientId: ClientId): GameServer | undefined {
    const code = this.clientRoom.get(clientId)
    return code ? this.rooms.get(code) : undefined
  }

  addClient(code: string, clientId: ClientId): void {
    this.clientRoom.set(clientId, code)
    this.roomClients.get(code)?.add(clientId)
  }

  removeClient(clientId: ClientId): string | undefined {
    const code = this.clientRoom.get(clientId)
    if (!code) return undefined
    const members = this.roomClients.get(code)
    members?.delete(clientId)
    if (members && members.size === 0) {
      this.roomClients.delete(code)
      const game = this.rooms.get(code)
      if (game && game.getPlayers().every((p) => !p.connected && !p.name)) {
        this.rooms.delete(code)
      }
    }
    this.clientRoom.delete(clientId)
    return code
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
