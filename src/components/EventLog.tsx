import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LogEntry } from '../types/game'
import { useCurrency } from '../i18n/CurrencyContext'
import { resolveLogEntry } from '../i18n/log'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'

const SCROLL_BOTTOM_EPSILON = 16

interface Props {
  log: LogEntry[]
}

export default function EventLog({ log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const stickToBottomRef = useRef(true)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const play = useSound()

  useEffect(() => {
    if (ref.current && stickToBottomRef.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
    stickToBottomRef.current = true
  }, [expanded])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_EPSILON
    stickToBottomRef.current = nearBottom
    setAtBottom(nearBottom)
  }

  const jumpToLatest = () => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
    stickToBottomRef.current = true
    setAtBottom(true)
    play(SoundId.Click)
  }

  const visible = expanded ? log : log.slice(-2)

  return (
    <div className="shrink w-full border-t border-border pt-2">
      <div className={expanded ? 'relative' : ''}>
        <div
          data-testid="event-log"
          ref={ref}
          onScroll={handleScroll}
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
        {expanded && !atBottom && log.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-1 right-2 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-gold hover:opacity-80"
          >
            {t('eventlog.jumpToLatest')}
          </button>
        )}
      </div>
      {log.length > 2 && (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
            setAtBottom(true)
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
