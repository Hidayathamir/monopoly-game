import type { GameState, GameAction, GamePhase } from './game'

export type LobbyPlayer = { id: number; name: string | null; connected: boolean; isBot: boolean }

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

export type ClientMessage =
  | { type: typeof ClientMessageType.Create; name: string }
  | { type: typeof ClientMessageType.Join; code: string; name: string }
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
