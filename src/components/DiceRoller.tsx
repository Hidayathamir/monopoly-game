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
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {(canRoll || canRollJail) && (
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? 'Lempar Dadu (Penjara)' : 'Lempar Dadu'}
        </Button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          Ganda? {state.dice[0] === state.dice[1] ? 'Ya!' : 'Tidak'} — {3 - player.jailTurns}x lagi
        </p>
      )}
    </div>
  )
}
