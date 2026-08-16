import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  const rollingRef = useRef(false)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null
  const canAim = (canRoll || canRollJail) && isMyTurn

  // Sync the roll target to the last painted needle value. Written in a passive
  // effect after commit (never during render) so the press reads exactly what
  // the player saw; a render-phase ref write would violate the effect rules and
  // reintroduce the stale-ref bug this fix removes.
  useEffect(() => {
    aimValueRef.current = aimValue
  }, [aimValue])

  useEffect(() => {
    if (!canAim || rolling) return
    if (reducedMotion) {
      directionRef.current = 1
      const id = setInterval(() => {
        setAimValue((v) => {
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
      }, STEPPED_TICK_MS)
      return () => clearInterval(id)
    }
    const start = Date.now() - msForValue(aimValueRef.current)
    let rafId = 0
    const tick = () => {
      const value = sweepValue(Date.now() - start)
      setAimValue(value)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [canAim, rolling, reducedMotion])

  function stopAndRoll() {
    if (rollingRef.current) return
    rollingRef.current = true
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
    setTimeout(() => {
      rollingRef.current = false
      setRolling(false)
    }, 500)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    stopAndRoll()
  }

  function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
    if (e.detail !== 0) return
    stopAndRoll()
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
        <Button variant="primary" size="lg" onPointerDown={handlePointerDown} onClick={handleClick}>
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
