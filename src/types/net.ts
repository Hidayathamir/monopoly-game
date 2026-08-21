import type { GameState, GameAction, GamePhase, PlayerAvatar } from './game'

export type LobbyPlayer = { id: number; name: string | null; connected: boolean; isBot: boolean; color: string; avatar: PlayerAvatar }

export type RoomInfo = { code: string; hostName: string | null; playerCount: number; phase: GamePhase }

export const ConnectionStatus = {
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
} as const
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus]

export const ClientMessageType = {
  Create: 'create',
  Join: 'join',
  Start: 'start',
  Leave: 'leave',
  AddBot: 'addBot',
  RemoveBot: 'removeBot',
  Action: 'action',
  SetIdentity: 'setIdentity',
} as const
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType]

export const ServerMessageType = {
  Welcome: 'welcome',
  Lobby: 'lobby',
  State: 'state',
  Left: 'left',
  Error: 'error',
} as const
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType]

export const HttpPath = {
  Config: '/config',
  Seed: '/seed',
  Rooms: '/rooms',
  Ws: '/ws',
} as const
export type HttpPath = (typeof HttpPath)[keyof typeof HttpPath]

export type ClientMessage =
  | { type: typeof ClientMessageType.Create; name: string; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.Join; code: string; name: string; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.SetIdentity; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.Start }
  | { type: typeof ClientMessageType.Leave }
  | { type: typeof ClientMessageType.AddBot }
  | { type: typeof ClientMessageType.RemoveBot; playerId: number }
  | { type: typeof ClientMessageType.Action; action: GameAction }

export type ServerMessage =
  | { type: typeof ServerMessageType.Welcome; playerId: number; hostPlayerId: number; players: LobbyPlayer[]; state: GameState; code: string }
  | { type: typeof ServerMessageType.Lobby; players: LobbyPlayer[]; hostPlayerId: number }
  | { type: typeof ServerMessageType.State; state: GameState }
  | { type: typeof ServerMessageType.Left }
  | { type: typeof ServerMessageType.Error; message: string }
