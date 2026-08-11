import { useRef, useEffect } from 'react'

interface Props {
  log: string[]
}

export default function EventLog({ log }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [log])

  return (
    <div
      data-testid="event-log"
      className="max-h-32 overflow-y-auto text-[9px] flex flex-col gap-px w-full p-1 bg-bg-dark rounded [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      ref={ref}
    >
      {log.map((entry, i) => (
        <div
          key={i}
          data-testid="event-entry"
          className="py-0.5 px-1 border-b border-[#1a2a4a] text-muted"
        >
          {entry}
        </div>
      ))}
    </div>
  )
}
