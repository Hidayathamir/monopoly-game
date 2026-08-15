import { useReducer, useCallback, useEffect } from 'react';
import type { TradeOffer } from '../types/game';
import { gameReducer, createInitialState } from '../logic/gameReducer';

const STORAGE_KEY = 'monopoly-game-state';
const STATE_VERSION = 4;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed._version !== STATE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadState() || createInitialState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _version: STATE_VERSION }));
  }, [state]);

  const startGame = useCallback((playerCount: number, names: string[]) => {
    dispatch({ type: 'START_GAME', playerCount, names });
  }, []);

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const rollDice = useCallback(() => {
    dispatch({ type: 'ROLL_DICE' });
  }, []);

  const diceAnimated = useCallback((dice: [number, number]) => {
    dispatch({ type: 'DICE_ANIMATED', dice });
  }, []);

  const resolveSpace = useCallback(() => {
    dispatch({ type: 'RESOLVE_SPACE' });
  }, []);

  const buyProperty = useCallback(() => {
    dispatch({ type: 'BUY_PROPERTY' });
  }, []);

  const declineBuy = useCallback(() => {
    dispatch({ type: 'DECLINE_BUY' });
  }, []);

  const payRent = useCallback(() => {
    dispatch({ type: 'PAY_RENT' });
  }, []);

  const buildHouse = useCallback((spaceId: number) => {
    dispatch({ type: 'BUILD_HOUSE', spaceId });
  }, []);

  const sellHouse = useCallback((spaceId: number) => {
    dispatch({ type: 'SELL_HOUSE', spaceId });
  }, []);

  const mortgage = useCallback((spaceId: number) => {
    dispatch({ type: 'MORTGAGE', spaceId });
  }, []);

  const unmortgage = useCallback((spaceId: number) => {
    dispatch({ type: 'UNMORTGAGE', spaceId });
  }, []);

  const sellProperty = useCallback((spaceId: number) => {
    dispatch({ type: 'SELL_PROPERTY', spaceId });
  }, []);

  const proposeTrade = useCallback((offer: TradeOffer) => {
    dispatch({ type: 'PROPOSE_TRADE', offer });
  }, []);

  const drawCard = useCallback(() => {
    dispatch({ type: 'DRAW_CARD' });
  }, []);

  const resolveCard = useCallback(() => {
    dispatch({ type: 'RESOLVE_CARD' });
  }, []);

  const endTurn = useCallback(() => {
    dispatch({ type: 'END_TURN' });
  }, []);

  const declareBankruptcy = useCallback(() => {
    dispatch({ type: 'DECLARE_BANKRUPTCY' });
  }, []);

  const skipAction = useCallback(() => {
    dispatch({ type: 'SKIP_ACTION' });
  }, []);

  const payJailFine = useCallback(() => {
    dispatch({ type: 'PAY_JAIL_FINE' });
  }, []);

  const useGetOutOfJailFree = useCallback(() => {
    dispatch({ type: 'USE_GET_OUT_OF_JAIL_FREE' });
  }, []);

  return {
    state,
    dispatch,
    startGame,
    resetGame,
    rollDice,
    diceAnimated,
    resolveSpace,
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
  };
}
