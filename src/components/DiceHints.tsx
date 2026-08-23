import { GamePhase, type GameState } from '../types/game'
import { BOARD_SIZE } from '../data/board'

const RATIO = 100 / 11

function c(col: number, row: number) {
  return {
    x: Math.round((col - 0.5) * RATIO * 100) / 100,
    y: Math.round((row - 0.5) * RATIO * 100) / 100,
  }
}

const POSITIONS: Record<number, { x: number; y: number }> = {
  0: c(11, 11), 1: c(10, 11), 2: c(9, 11), 3: c(8, 11),
  4: c(7, 11), 5: c(6, 11), 6: c(5, 11), 7: c(4, 11),
  8: c(3, 11), 9: c(2, 11), 10: c(1, 11), 11: c(1, 10),
  12: c(1, 9), 13: c(1, 8), 14: c(1, 7), 15: c(1, 6),
  16: c(1, 5), 17: c(1, 4), 18: c(1, 3), 19: c(1, 2),
  20: c(1, 1), 21: c(2, 1), 22: c(3, 1), 23: c(4, 1),
  24: c(5, 1), 25: c(6, 1), 26: c(7, 1), 27: c(8, 1),
  28: c(9, 1), 29: c(10, 1), 30: c(11, 1), 31: c(11, 2),
  32: c(11, 3), 33: c(11, 4), 34: c(11, 5), 35: c(11, 6),
  36: c(11, 7), 37: c(11, 8), 38: c(11, 9), 39: c(11, 10),
}

const MIN_TOTAL = 2
const MAX_TOTAL = 12

interface Props {
  state: GameState
  myPlayerId?: number | null
}

export default function DiceHints({ state, myPlayerId = null }: Props) {
  const isMyTurn = state.currentPlayer === myPlayerId
  const player = state.players[state.currentPlayer]
  if (!player) return null

  const isAiming =
    isMyTurn &&
    state.phase === GamePhase.Waiting &&
    !state.pendingAction &&
    state.dice === null

  if (!isAiming) return null

  const position = player.position

  const hints: { value: number; targetCell: number; pos: { x: number; y: number } }[] = []
  for (let v = MIN_TOTAL; v <= MAX_TOTAL; v++) {
    const targetCell = (position + v) % BOARD_SIZE
    const pos = POSITIONS[targetCell]
    if (pos) {
      hints.push({ value: v, targetCell, pos })
    }
  }

  return (
    <div
      data-testid="dice-hints"
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-[5]"
    >
      {hints.map((hint) => (
        <div
          key={hint.value}
          className="absolute flex items-center justify-center animate-[hint-fade-in_0.3s_ease-out_forwards]"
          style={{
            left: `calc(${hint.pos.x}% - 9px)`,
            top: `calc(${hint.pos.y}% - 9px)`,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: `${player.color}cc`,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            textAlign: 'center',
            border: '1.5px solid rgba(255,255,255,0.6)',
          }}
          data-testid={`dice-hint-${hint.value}`}
        >
          {hint.value}
        </div>
      ))}
    </div>
  )
}
