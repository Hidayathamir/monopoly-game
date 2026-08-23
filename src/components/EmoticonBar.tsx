import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOTICON_COOLDOWN_MS, EMOTICON_GLYPHS, EMOTICON_LIST, type Emoticon } from '../types/emotion'

interface Props {
  disabled?: boolean
  onEmit: (emoticon: Emoticon) => void
}

export default function EmoticonBar({ disabled = false, onEmit }: Props) {
  const { t } = useTranslation()
  const [cooldown, setCooldown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClick(emoticon: Emoticon) {
    if (disabled || cooldown) return
    onEmit(emoticon)
    setCooldown(true)
    timerRef.current = setTimeout(() => setCooldown(false), EMOTICON_COOLDOWN_MS)
  }

  return (
    <div data-testid="emoticon-bar" className="flex items-center justify-center gap-1.5">
      {EMOTICON_LIST.map((em) => (
        <button
          key={em}
          type="button"
          data-testid={`emoticon-button-${em}`}
          title={t('emoticon.' + em)}
          aria-label={t('emoticon.' + em)}
          disabled={disabled || cooldown}
          onClick={() => handleClick(em)}
          className="w-8 h-8 rounded-lg text-lg leading-none flex items-center justify-center border border-border bg-bg-dark hover:opacity-90 disabled:opacity-40"
        >
          {EMOTICON_GLYPHS[em]}
        </button>
      ))}
    </div>
  )
}
