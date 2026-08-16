import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'

interface Props {
  state: GameState
  onRoll: (target: number) => void
  isMyTurn?: boolean
}

const TICK_MS = 80
const MIN_TOTAL = 2
const MAX_TOTAL = 12

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [holding, setHolding] = useState(false)
  const [tickerValue, setTickerValue] = useState(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  useEffect(() => {
    if (!holding) return
    const id = setInterval(() => {
      setTickerValue((v) => {
        const next = v + directionRef.current
        if (next > MAX_TOTAL) {
          directionRef.current = -1
          return MAX_TOTAL
        }
        if (next < MIN_TOTAL) {
          directionRef.current = 1
          return MIN_TOTAL
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [holding])

  function startHold() {
    if (rolling) return
    directionRef.current = 1
    setTickerValue(MIN_TOTAL)
    setHolding(true)
  }

  function lockTarget() {
    if (!holding) return
    setHolding(false)
    setRolling(true)
    onRoll(tickerValue)
    setTimeout(() => setRolling(false), 500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) startHold()
    }
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      lockTarget()
    }
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {holding && (
        <p data-testid="dice-aim" className="text-lg font-bold text-gold">
          {t('dice.aiming', { target: tickerValue })}
        </p>
      )}
      {(canRoll || canRollJail) && isMyTurn && (
        <Button
          variant="primary"
          size="lg"
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // ignore (e.g. jsdom / synthetic events)
            }
            startHold()
          }}
          onPointerUp={lockTarget}
          onPointerCancel={() => setHolding(false)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => setHolding(false)}
        >
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
      )}
      {(canRoll || canRollJail) && isMyTurn && !holding && (
        <p className="text-sm text-muted text-center">{t('dice.holdHint')}</p>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          {t('dice.doubles', { result: state.dice[0] === state.dice[1] ? t('common.yes') : t('action.no'), n: 3 - player.jailTurns })}
        </p>
      )}
    </div>
  )
}
