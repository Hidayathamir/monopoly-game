import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState } from '../logic/gameReducer'
import { GameClient } from '../net/client'
import type { GameApi, GameAction, GameState, TradeOffer } from '../types/game'
import type { ConnectionStatus, LobbyPlayer } from '../types/net'

export type NetworkGameApi = GameApi & {
  playerId: number | null
  lobby: LobbyPlayer[]
  status: ConnectionStatus
  error: string | null
  join: (name: string) => void
  start: () => void
}

export function useNetworkGame(): NetworkGameApi {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [lobby, setLobby] = useState<LobbyPlayer[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<GameClient | null>(null)

  useEffect(() => {
    const client = new GameClient({
      onOpen: () => setStatus('connected'),
      onClose: () => setStatus('disconnected'),
      onMessage: (message) => {
        if (message.type === 'welcome') {
          setPlayerId(message.playerId)
          setLobby(message.players)
          setState(message.state)
          setStatus('connected')
          setError(null)
        } else if (message.type === 'lobby') {
          setLobby(message.players)
        } else if (message.type === 'state') {
          setState(message.state)
        } else if (message.type === 'error') {
          setError(message.message)
        }
      },
    })
    client.connect()
    clientRef.current = client
    return () => client.close()
  }, [])

  const send = useCallback((message: Parameters<GameClient['send']>[0]) => {
    clientRef.current?.send(message)
  }, [])

  const sendAction = useCallback(
    (action: GameAction) => send({ type: 'action', action }),
    [send],
  )

  const join = useCallback((name: string) => send({ type: 'join', name }), [send])
  const start = useCallback(() => send({ type: 'start' }), [send])

  const roll = useCallback(() => sendAction({ type: 'ROLL_DICE' }), [sendAction])
  const buyProperty = useCallback(() => sendAction({ type: 'BUY_PROPERTY' }), [sendAction])
  const declineBuy = useCallback(() => sendAction({ type: 'DECLINE_BUY' }), [sendAction])
  const payRent = useCallback(() => sendAction({ type: 'PAY_RENT' }), [sendAction])
  const buildHouse = useCallback((spaceId: number) => sendAction({ type: 'BUILD_HOUSE', spaceId }), [sendAction])
  const sellHouse = useCallback((spaceId: number) => sendAction({ type: 'SELL_HOUSE', spaceId }), [sendAction])
  const mortgage = useCallback((spaceId: number) => sendAction({ type: 'MORTGAGE', spaceId }), [sendAction])
  const unmortgage = useCallback((spaceId: number) => sendAction({ type: 'UNMORTGAGE', spaceId }), [sendAction])
  const sellProperty = useCallback((spaceId: number) => sendAction({ type: 'SELL_PROPERTY', spaceId }), [sendAction])
  const proposeTrade = useCallback((offer: TradeOffer) => sendAction({ type: 'PROPOSE_TRADE', offer }), [sendAction])
  const drawCard = useCallback(() => sendAction({ type: 'DRAW_CARD' }), [sendAction])
  const resolveCard = useCallback(() => sendAction({ type: 'RESOLVE_CARD' }), [sendAction])
  const endTurn = useCallback(() => sendAction({ type: 'END_TURN' }), [sendAction])
  const declareBankruptcy = useCallback(() => sendAction({ type: 'DECLARE_BANKRUPTCY' }), [sendAction])
  const skipAction = useCallback(() => sendAction({ type: 'SKIP_ACTION' }), [sendAction])
  const payJailFine = useCallback(() => sendAction({ type: 'PAY_JAIL_FINE' }), [sendAction])
  const useGetOutOfJailFree = useCallback(() => sendAction({ type: 'USE_GET_OUT_OF_JAIL_FREE' }), [sendAction])
  const resetGame = useCallback(() => window.location.reload(), [])

  return {
    state,
    myPlayerId: playerId,
    playerId,
    lobby,
    status,
    error,
    join,
    start,
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
