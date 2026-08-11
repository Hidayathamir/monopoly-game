import { useState } from 'react'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'

interface Props {
  state: GameState
  onRoll: () => void
}

export default function DiceRoller({ state, onRoll }: Props) {
  const [rolling, setRolling] = useState(false)
  const player = state.players[state.currentPlayer]

  function handleRoll() {
    setRolling(true)
    onRoll()
    setTimeout(() => setRolling(false), 500)
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail

  return (
    <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
      <div className="flex gap-3 justify-center mb-1.5">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {(canRoll || canRollJail) && (
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? '🎲 Lempar Dadu (Penjara)' : '🎲 Lempar Dadu'}
        </Button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-[11px] text-muted text-center mt-1">
          Ganda? {state.dice[0] === state.dice[1] ? 'Ya! 🎉' : 'Tidak 😔'} — {3 - player.jailTurns}x lagi
        </p>
      )}
      {state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice !== null && (
        <p className="text-[11px] text-muted text-center mt-1">
          {state.dice[0]} + {state.dice[1]} = {state.dice[0] + state.dice[1]}
        </p>
      )}
    </div>
  )
}
