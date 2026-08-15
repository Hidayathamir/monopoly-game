import { useRef, useEffect, useState } from 'react'
import type { LogEntry } from '../types/game'

interface Props {
  log: LogEntry[]
}

export default function EventLog({ log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
            {entry.key}
          </div>
        ))}
        {log.length === 0 && <div className="text-xs text-muted">Belum ada kejadian</div>}
      </div>
      {log.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gold mt-1 hover:opacity-80"
        >
          {expanded ? 'Tutup ▴' : 'Riwayat penuh ▾'}
        </button>
      )}
    </div>
  )
}
