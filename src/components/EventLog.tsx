import { useRef, useEffect } from 'react';

interface Props {
  log: string[];
}

export default function EventLog({ log }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="event-log" ref={ref}>
      {log.map((entry, i) => (
        <div key={i} className="event-entry">{entry}</div>
      ))}
    </div>
  );
}
