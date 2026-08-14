interface DiceProps {
  value?: number | null
  rolling: boolean
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export default function Dice({ value, rolling }: DiceProps) {
  return (
    <div
      data-testid="dice"
      className={[
        'w-14 h-14 rounded-xl flex items-center justify-center shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]',
        value == null ? 'bg-bg-card' : 'bg-white',
        rolling ? 'animate-dice-shake' : '',
      ].join(' ')}
    >
      {value == null ? (
        <span className="text-2xl font-bold text-muted">?</span>
      ) : (
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-2 gap-0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="flex items-center justify-center">
              {PIPS[value].includes(i) && (
                <span data-testid="dice-pip" className="w-2 h-2 rounded-full bg-bg-main" />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
