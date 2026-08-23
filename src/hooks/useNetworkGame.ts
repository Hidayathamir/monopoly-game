import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState } from '../logic/gameReducer'
import { GameClient } from '../net/client'
import { GameActionType } from '../types/game'
import type { GameApi, GameAction, GameState, PlayerAvatar, TradeOffer } from '../types/game'
import { ClientMessageType, ConnectionStatus, ServerMessageType } from '../types/net'
import { Emoticon, EMOTICON_LIFETIME_MS } from '../types/emotion'
import type { ActiveEmotion } from '../types/emotion'
import type { LobbyPlayer } from '../types/net'
import type { PlayerIdentity } from '../net/identity'

export type NetworkGameApi = GameApi & {
  playerId: number | null
  hostPlayerId: number | null
  code: string | null
  lobby: LobbyPlayer[]
  status: ConnectionStatus
  error: string | null
  create: (name: string, identity?: PlayerIdentity) => void
  join: (code: string, name: string, identity?: PlayerIdentity) => void
  setIdentity: (patch: { color?: string; avatar?: PlayerAvatar }) => void
  leave: () => void
  start: () => void
  addBot: () => void
  removeBot: (playerId: number) => void
  manualBotToggle: () => void
}

export function useNetworkGame(onLeft: () => void): NetworkGameApi {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [hostPlayerId, setHostPlayerId] = useState<number | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [lobby, setLobby] = useState<LobbyPlayer[]>([])
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.Connecting)
  const [error, setError] = useState<string | null>(null)
  const [activeEmotions, setActiveEmotions] = useState<ActiveEmotion[]>([])
  const emotionIdRef = useRef(0)
  const emotionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const clientRef = useRef<GameClient | null>(null)
  const onLeftRef = useRef(onLeft)

  useEffect(() => {
    onLeftRef.current = onLeft
  }, [onLeft])

  useEffect(() => {
    const client = new GameClient({
      onOpen: () => setStatus(ConnectionStatus.Connected),
      onClose: () => setStatus(ConnectionStatus.Disconnected),
      onMessage: (message) => {
        if (message.type === ServerMessageType.Welcome) {
          setPlayerId(message.playerId)
          setHostPlayerId(message.hostPlayerId)
          setCode(message.code)
          setLobby(message.players)
          setState(message.state)
          setStatus(ConnectionStatus.Connected)
          setError(null)
        } else if (message.type === ServerMessageType.Lobby) {
          setLobby(message.players)
          setHostPlayerId(message.hostPlayerId)
        } else if (message.type === ServerMessageType.State) {
          setState(message.state)
        } else if (message.type === ServerMessageType.Emoticon) {
          const id = emotionIdRef.current++
          const timer = setTimeout(() => {
            setActiveEmotions((prev) => prev.filter((e) => e.id !== id))
          }, EMOTICON_LIFETIME_MS)
          emotionTimersRef.current.push(timer)
          setActiveEmotions((prev) => [...prev, { id, playerId: message.playerId, emoticon: message.emoticon }])
        } else if (message.type === ServerMessageType.Left) {
          onLeftRef.current()
        } else if (message.type === ServerMessageType.Error) {
          setError(message.message)
        }
      },
    })
    client.connect()
    clientRef.current = client
    return () => {
      client.close()
      for (const timer of emotionTimersRef.current) clearTimeout(timer)
      emotionTimersRef.current = []
    }
  }, [])

  const send = useCallback((message: Parameters<GameClient['send']>[0]) => {
    clientRef.current?.send(message)
  }, [])

  const sendAction = useCallback(
    (action: GameAction) => send({ type: ClientMessageType.Action, action }),
    [send],
  )

  const create = useCallback(
    (name: string, identity?: PlayerIdentity) =>
      send({ type: ClientMessageType.Create, name, color: identity?.color, avatar: identity?.avatar }),
    [send],
  )
  const join = useCallback(
    (code: string, name: string, identity?: PlayerIdentity) =>
      send({ type: ClientMessageType.Join, code, name, color: identity?.color, avatar: identity?.avatar }),
    [send],
  )
  const setIdentity = useCallback(
    (patch: { color?: string; avatar?: PlayerAvatar }) => send({ type: ClientMessageType.SetIdentity, ...patch }),
    [send],
  )
  const leave = useCallback(() => {
    send({ type: ClientMessageType.Leave })
    onLeftRef.current()
  }, [send])
  const start = useCallback(() => send({ type: ClientMessageType.Start }), [send])
  const addBot = useCallback(() => send({ type: ClientMessageType.AddBot }), [send])
  const removeBot = useCallback((playerId: number) => send({ type: ClientMessageType.RemoveBot, playerId }), [send])
  const manualBotToggle = useCallback(() => send({ type: ClientMessageType.ManualBotToggle }), [send])
  const emitEmoticon = useCallback((emoticon: Emoticon) => send({ type: ClientMessageType.Emoticon, emoticon }), [send])

  const roll = useCallback(
    (target?: number) => sendAction({ type: GameActionType.RollDice, ...(target != null ? { target } : {}) }),
    [sendAction],
  )
  const buyProperty = useCallback(() => sendAction({ type: GameActionType.BuyProperty }), [sendAction])
  const declineBuy = useCallback(() => sendAction({ type: GameActionType.DeclineBuy }), [sendAction])
  const payRent = useCallback(() => sendAction({ type: GameActionType.PayRent }), [sendAction])
  const buildHouse = useCallback((spaceId: number) => sendAction({ type: GameActionType.BuildHouse, spaceId }), [sendAction])
  const sellHouse = useCallback((spaceId: number) => sendAction({ type: GameActionType.SellHouse, spaceId }), [sendAction])
  const mortgage = useCallback((spaceId: number) => sendAction({ type: GameActionType.Mortgage, spaceId }), [sendAction])
  const unmortgage = useCallback((spaceId: number) => sendAction({ type: GameActionType.Unmortgage, spaceId }), [sendAction])
  const sellProperty = useCallback((spaceId: number) => sendAction({ type: GameActionType.SellProperty, spaceId }), [sendAction])
  const proposeTrade = useCallback((offer: TradeOffer) => sendAction({ type: GameActionType.ProposeTrade, offer }), [sendAction])
  const acceptTrade = useCallback((tradeId: number) => sendAction({ type: GameActionType.AcceptTrade, tradeId }), [sendAction])
  const rejectTrade = useCallback((tradeId: number) => sendAction({ type: GameActionType.RejectTrade, tradeId }), [sendAction])
  const cancelTrade = useCallback((tradeId: number) => sendAction({ type: GameActionType.CancelTrade, tradeId }), [sendAction])
  const drawCard = useCallback(() => sendAction({ type: GameActionType.DrawCard }), [sendAction])
  const resolveCard = useCallback(() => sendAction({ type: GameActionType.ResolveCard }), [sendAction])
  const endTurn = useCallback(() => sendAction({ type: GameActionType.EndTurn }), [sendAction])
  const declareBankruptcy = useCallback(() => sendAction({ type: GameActionType.DeclareBankruptcy }), [sendAction])
  const skipAction = useCallback(() => sendAction({ type: GameActionType.SkipAction }), [sendAction])
  const payJailFine = useCallback(() => sendAction({ type: GameActionType.PayJailFine }), [sendAction])
  const useGetOutOfJailFree = useCallback(() => sendAction({ type: GameActionType.UseGetOutOfJailFree }), [sendAction])
  const resetGame = useCallback(() => window.location.reload(), [])

  return {
    state,
    myPlayerId: playerId,
    playerId,
    hostPlayerId,
    code,
    lobby,
    status,
    error,
    create,
    join,
    setIdentity,
    leave,
    start,
    addBot,
    removeBot,
    manualBotToggle,
    activeEmotions,
    emitEmoticon,
    roll,
    buyProperty,
    declineBuy,
    payRent,
    buildHouse,
    sellHouse,
    mortgage,
    unmortgage,
    sellProperty,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    drawCard,
    resolveCard,
    endTurn,
    declareBankruptcy,
    skipAction,
    payJailFine,
    useGetOutOfJailFree,
    resetGame,
  }
}
