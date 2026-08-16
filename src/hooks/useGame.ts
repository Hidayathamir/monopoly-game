import { useReducer, useCallback, useEffect, useRef } from 'react'
import { GameActionType, GamePhase, PendingActionType, type GameAction, type TradeOffer } from '../types/game'
import { gameReducer, createInitialState } from '../logic/gameReducer'
import { decideBotAction } from '../logic/bot'

const STORAGE_KEY = 'monopoly-game-state'
const STATE_VERSION = 8

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
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _version: STATE_VERSION }))
  }, [state])

  const startGame = useCallback((players: { name: string; isBot: boolean }[]) => {
    dispatch({
      type: GameActionType.StartGame,
      playerCount: players.length,
      names: players.map((p) => p.name),
      isBot: players.map((p) => p.isBot),
    })
  }, [])

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }, [])

  const roll = useCallback(() => {
    dispatch({ type: GameActionType.RollDice })
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const total = d1 + d2
    const animDuration = 500 + total * 150
    setTimeout(() => {
      dispatch({ type: GameActionType.DiceAnimated, dice: [d1, d2] })
      setTimeout(() => dispatch({ type: GameActionType.ResolveSpace }), animDuration)
    }, 500)
  }, [])

  const send = useCallback((action: GameAction) => dispatch(action), [])

  useEffect(() => {
    const player = state.players[state.currentPlayer]
    if (!player?.isBot) return
    if (state.phase === GamePhase.GameOver) return
    const timer = setTimeout(() => {
      const current = stateRef.current.players[stateRef.current.currentPlayer]
      if (!current?.isBot || stateRef.current.phase === GamePhase.GameOver) return
      const action = decideBotAction(stateRef.current)
      if (!action) return
      if (action.type === GameActionType.RollDice) roll()
      else send(action)
    }, 600)
    return () => clearTimeout(timer)
  }, [state, roll, send])

  const buyProperty = useCallback(() => send({ type: GameActionType.BuyProperty }), [send])
  const declineBuy = useCallback(() => send({ type: GameActionType.DeclineBuy }), [send])
  const payRent = useCallback(() => send({ type: GameActionType.PayRent }), [send])
  const buildHouse = useCallback((spaceId: number) => send({ type: GameActionType.BuildHouse, spaceId }), [send])
  const sellHouse = useCallback((spaceId: number) => send({ type: GameActionType.SellHouse, spaceId }), [send])
  const mortgage = useCallback((spaceId: number) => send({ type: GameActionType.Mortgage, spaceId }), [send])
  const unmortgage = useCallback((spaceId: number) => send({ type: GameActionType.Unmortgage, spaceId }), [send])
  const sellProperty = useCallback((spaceId: number) => send({ type: GameActionType.SellProperty, spaceId }), [send])
  const proposeTrade = useCallback((offer: TradeOffer) => send({ type: GameActionType.ProposeTrade, offer }), [send])
  const acceptTrade = useCallback((tradeId: number) => send({ type: GameActionType.AcceptTrade, tradeId }), [send])
  const rejectTrade = useCallback((tradeId: number) => send({ type: GameActionType.RejectTrade, tradeId }), [send])
  const cancelTrade = useCallback((tradeId: number) => send({ type: GameActionType.CancelTrade, tradeId }), [send])
  const drawCard = useCallback(() => send({ type: GameActionType.DrawCard }), [send])
  const resolveCard = useCallback(() => send({ type: GameActionType.ResolveCard }), [send])
  const endTurn = useCallback(() => send({ type: GameActionType.EndTurn }), [send])
  const declareBankruptcy = useCallback(() => send({ type: GameActionType.DeclareBankruptcy }), [send])
  const skipAction = useCallback(() => send({ type: GameActionType.SkipAction }), [send])
  const payJailFine = useCallback(() => send({ type: GameActionType.PayJailFine }), [send])
  const useGetOutOfJailFree = useCallback(() => send({ type: GameActionType.UseGetOutOfJailFree }), [send])

  useEffect(() => {
    if (state.phase === GamePhase.Resolving && !state.pendingAction) {
      dispatch({ type: GameActionType.ResolveSpace })
    }
  }, [state.phase, state.pendingAction])

  useEffect(() => {
    if (state.pendingAction?.type === PendingActionType.DrawCard) {
      const t = setTimeout(() => dispatch({ type: GameActionType.DrawCard }), 300)
      return () => clearTimeout(t)
    }
  }, [state.pendingAction])

  return {
    state,
    myPlayerId: null,
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
  }
}
