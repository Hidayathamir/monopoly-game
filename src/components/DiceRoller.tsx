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

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [holding, setHolding] = useState(false)
  const [aimValue, setAimValue] = useState(MIN_TOTAL)
  const [reducedMotion, setReducedMotion] = useState(false)
  const aimValueRef = useRef(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  useEffect(() => {
    const mq = window.matchMedia
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(mq ? mq('(prefers-reduced-motion: reduce)').matches : false)
  }, [])

  useEffect(() => {
    if (!holding) return
    aimValueRef.current = MIN_TOTAL
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAimValue(MIN_TOTAL)
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
    const start = Date.now()
    const id = setInterval(() => {
      const value = sweepValue(Date.now() - start)
      aimValueRef.current = value
      setAimValue(value)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [holding, reducedMotion])

  function startHold() {
    if (rolling) return
    setHolding(true)
  }

  function lockTarget() {
    if (!holding) return
    setHolding(false)
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
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
        {holding ? (
          <Speedometer value={aimValue} label={t('dice.gauge')} />
        ) : (
          <>
            <Dice value={state.dice?.[0]} rolling={rolling} />
            <Dice value={state.dice?.[1]} rolling={rolling} />
          </>
        )}
      </div>
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
