import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'
import Speedometer from './Speedometer'

interface Props {
  state: GameState
  onRoll: (target: number) => void
  isMyTurn?: boolean
}

const SWEEP_MS = 800
const FRAME_MS = 16
const MIN_TOTAL = 2
const MAX_TOTAL = 12
const STEPPED_TICK_MS = 80

function triangleFraction(elapsedMs: number): number {
  const phase = (elapsedMs / SWEEP_MS) % 2
  return phase <= 1 ? phase : 2 - phase
}

function sweepValue(elapsedMs: number): number {
  return MIN_TOTAL + (MAX_TOTAL - MIN_TOTAL) * triangleFraction(elapsedMs)
}

function msForValue(value: number): number {
  return ((value - MIN_TOTAL) / (MAX_TOTAL - MIN_TOTAL)) * SWEEP_MS
}

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [aimValue, setAimValue] = useState(MIN_TOTAL)
  const [reducedMotion] = useState(() => {
    const mq = window.matchMedia
    return mq ? mq('(prefers-reduced-motion: reduce)').matches : false
  })
  const aimValueRef = useRef(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null
  const canAim = (canRoll || canRollJail) && isMyTurn

  useEffect(() => {
    if (!canAim) return
    if (reducedMotion) {
      directionRef.current = 1
      const id = setInterval(() => {
        setAimValue((v) => {
          const next = v + directionRef.current
          if (next > MAX_TOTAL) {
            directionRef.current = -1
            aimValueRef.current = MAX_TOTAL
            return MAX_TOTAL
          }
          if (next < MIN_TOTAL) {
            directionRef.current = 1
            aimValueRef.current = MIN_TOTAL
            return MIN_TOTAL
          }
          aimValueRef.current = next
          return next
        })
      }, STEPPED_TICK_MS)
      return () => clearInterval(id)
    }
    const start = Date.now() - msForValue(aimValueRef.current)
    const id = setInterval(() => {
      const value = sweepValue(Date.now() - start)
      aimValueRef.current = value
      setAimValue(value)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [canAim, reducedMotion])

  function stopAndRoll() {
    if (rolling) return
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
    setTimeout(() => setRolling(false), 500)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        {canAim ? (
          <Speedometer value={aimValue} label={t('dice.gauge')} />
        ) : (
          <>
            <Dice value={state.dice?.[0]} rolling={rolling} />
            <Dice value={state.dice?.[1]} rolling={rolling} />
          </>
        )}
      </div>
      {canAim && (
        <Button variant="primary" size="lg" onClick={stopAndRoll}>
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
      )}
      {canAim && <p className="text-sm text-muted text-center">{t('dice.stopHint')}</p>}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          {t('dice.doubles', { result: state.dice[0] === state.dice[1] ? t('common.yes') : t('action.no'), n: 3 - player.jailTurns })}
        </p>
      )}
    </div>
  )
}
