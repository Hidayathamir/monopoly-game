import { useReducer, useCallback, useEffect, useRef } from 'react'
import { GamePhase, PendingActionType, type GameAction, type TradeOffer } from '../types/game'
import { gameReducer, createInitialState } from '../logic/gameReducer'

const STORAGE_KEY = 'monopoly-game-state'
const STATE_VERSION = 4

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (parsed._version !== STATE_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadState() || createInitialState())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _version: STATE_VERSION }))
  }, [state])

  const startGame = useCallback((playerCount: number, names: string[]) => {
    dispatch({ type: 'START_GAME', playerCount, names })
  }, [])

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }, [])

  const roll = useCallback(() => {
    dispatch({ type: 'ROLL_DICE' })
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const total = d1 + d2
    const animDuration = 500 + total * 150
    setTimeout(() => {
      dispatch({ type: 'DICE_ANIMATED', dice: [d1, d2] })
      setTimeout(() => dispatch({ type: 'RESOLVE_SPACE' }), animDuration)
    }, 500)
  }, [])

  const send = useCallback((action: GameAction) => dispatch(action), [])

  const buyProperty = useCallback(() => send({ type: 'BUY_PROPERTY' }), [send])
  const declineBuy = useCallback(() => send({ type: 'DECLINE_BUY' }), [send])
  const payRent = useCallback(() => send({ type: 'PAY_RENT' }), [send])
  const buildHouse = useCallback((spaceId: number) => send({ type: 'BUILD_HOUSE', spaceId }), [send])
  const sellHouse = useCallback((spaceId: number) => send({ type: 'SELL_HOUSE', spaceId }), [send])
  const mortgage = useCallback((spaceId: number) => send({ type: 'MORTGAGE', spaceId }), [send])
  const unmortgage = useCallback((spaceId: number) => send({ type: 'UNMORTGAGE', spaceId }), [send])
  const sellProperty = useCallback((spaceId: number) => send({ type: 'SELL_PROPERTY', spaceId }), [send])
  const proposeTrade = useCallback((offer: TradeOffer) => send({ type: 'PROPOSE_TRADE', offer }), [send])
  const drawCard = useCallback(() => send({ type: 'DRAW_CARD' }), [send])
  const resolveCard = useCallback(() => send({ type: 'RESOLVE_CARD' }), [send])
  const endTurn = useCallback(() => send({ type: 'END_TURN' }), [send])
  const declareBankruptcy = useCallback(() => send({ type: 'DECLARE_BANKRUPTCY' }), [send])
  const skipAction = useCallback(() => send({ type: 'SKIP_ACTION' }), [send])
  const payJailFine = useCallback(() => send({ type: 'PAY_JAIL_FINE' }), [send])
  const useGetOutOfJailFree = useCallback(() => send({ type: 'USE_GET_OUT_OF_JAIL_FREE' }), [send])

  useEffect(() => {
    if (state.phase === GamePhase.Resolving && !state.pendingAction) {
      dispatch({ type: 'RESOLVE_SPACE' })
    }
  }, [state.phase, state.pendingAction])

  useEffect(() => {
    if (state.pendingAction?.type === PendingActionType.DrawCard) {
      const t = setTimeout(() => dispatch({ type: 'DRAW_CARD' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.pendingAction])

  const wasInJailRef = useRef<Record<number, boolean>>({})
  useEffect(() => {
    const player = state.players[state.currentPlayer]
    if (!player) return
    const wasInJail = wasInJailRef.current[player.id] ?? false
    wasInJailRef.current[player.id] = player.inJail
    if (player.inJail && !wasInJail && state.phase === GamePhase.Waiting && !state.pendingAction) {
      const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.players, state.phase, state.pendingAction, state.currentPlayer])

  return {
    state,
    dispatch,
    startGame,
    resetGame,
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
  }
}
