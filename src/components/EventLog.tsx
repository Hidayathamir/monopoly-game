import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LogEntry } from '../types/game'
import { useCurrency } from '../i18n/CurrencyContext'
import { resolveLogEntry } from '../i18n/log'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'

interface Props {
  log: LogEntry[]
}

export default function EventLog({ log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const play = useSound()

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log, expanded])

  const visible = expanded ? log : log.slice(-2)

  return (
    <div className="shrink w-full border-t border-border pt-2">
      <div
        data-testid="event-log"
        ref={ref}
        className={expanded ? 'max-h-32 overflow-y-auto' : ''}
      >
        {visible.map((entry, i) => (
          <div
            key={expanded ? i : log.length - visible.length + i}
            data-testid="event-entry"
            className="text-xs text-muted leading-snug py-0.5"
          >
            {resolveLogEntry(entry, t, formatMoney)}
          </div>
        ))}
        {log.length === 0 && <div className="text-xs text-muted">{t('eventlog.empty')}</div>}
      </div>
      {log.length > 2 && (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
            play(SoundId.Click)
          }}
          className="text-xs text-gold mt-1 hover:opacity-80"
        >
          {expanded ? t('eventlog.collapse') : t('eventlog.expand')}
        </button>
      )}
    </div>
  )
}
