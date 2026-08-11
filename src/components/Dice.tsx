interface DiceProps {
  value?: number | null
  rolling: boolean
}

export default function Dice({ value, rolling }: DiceProps) {
  return (
    <div
      className={[
        'w-11 h-11 bg-white text-bg-main rounded-lg flex items-center justify-center text-xl font-bold',
        rolling ? 'animate-dice-shake' : '',
      ].join(' ')}
    >
      {value ?? '?'}
    </div>
  )
}
