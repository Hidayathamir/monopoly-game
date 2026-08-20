import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button, { ButtonVariant, ButtonSize } from './Button'

interface Props {
  onConfirm: () => void
  holdMs?: number
  hint?: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
}

const TICK_MS = 50

export default function HoldToConfirmButton({
  onConfirm,
  holdMs = 5000,
  hint,
  children,
  variant = ButtonVariant.Primary,
  size = ButtonSize.Md,
  className = '',
  disabled,
}: Props) {
  const { t } = useTranslation()
  const hintId = useId()
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const startRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const reset = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startRef.current = 0
    firedRef.current = false
    setHolding(false)
    setProgress(0)
  }, [])

  const begin = useCallback(() => {
    if (disabled || firedRef.current || intervalRef.current !== null) return
    startRef.current = Date.now()
    firedRef.current = false
    setHolding(true)
    setProgress(0)
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const next = Math.min(1, elapsed / holdMs)
      setProgress(next)
      if (next >= 1) {
        if (intervalRef.current !== null) clearInterval(intervalRef.current)
        intervalRef.current = null
        firedRef.current = true
        setHolding(false)
        setProgress(0)
        onConfirm()
      }
    }, TICK_MS)
  }, [disabled, holdMs, onConfirm])

  useEffect(() => reset, [reset])

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    begin()
  }

  function handlePointerUp() {
    reset()
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (e.repeat) return
    e.preventDefault()
    begin()
  }

  function handleKeyUp(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    reset()
  }

  const remaining = Math.max(0, Math.ceil((holdMs * (1 - progress)) / 1000))

  return (
    <div className="flex-1 flex flex-col">
      <Button
        variant={variant}
        size={size}
        className={[className, 'relative overflow-hidden select-none touch-none'].join(' ')}
        sound={null}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        onBlur={reset}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        aria-describedby={hint ? hintId : undefined}
      >
        <span
          data-testid="hold-fill"
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-white/30"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative z-10">{holding ? t('hold.countdown', { n: remaining }) : children}</span>
      </Button>
      {hint && (
        <p data-testid="hold-hint" id={hintId} className="text-sm text-muted text-center mt-1">
          {hint}
        </p>
      )}
    </div>
  )
}
