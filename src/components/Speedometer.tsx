const CX = 70
const CY = 70
const RADIUS = 52
const NEEDLE_LENGTH = 44

const TICKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const LABELED = new Set([2, 7, 12])

// eslint-disable-next-line react-refresh/only-export-components
export function valueToAngle(value: number): number {
  return 165 - 150 * ((value - 2) / 10)
}

function pointOnArc(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)]
}

export default function Speedometer({ value, label }: { value: number; label: string }) {
  const [arcStartX, arcStartY] = pointOnArc(165, RADIUS)
  const [arcEndX, arcEndY] = pointOnArc(15, RADIUS)
  const needleAngle = valueToAngle(value)
  const [needleTipX, needleTipY] = pointOnArc(needleAngle, NEEDLE_LENGTH)

  return (
    <svg
      data-testid="speedometer"
      viewBox="0 0 140 78"
      className="w-52 h-auto bg-bg-card rounded-xl text-white"
      role="img"
      aria-label={label}
    >
      <path
        d={`M ${arcStartX} ${arcStartY} A ${RADIUS} ${RADIUS} 0 0 1 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      {TICKS.map((v) => {
        const a = valueToAngle(v)
        const labeled = LABELED.has(v)
        const [innerX, innerY] = pointOnArc(a, RADIUS - (labeled ? 8 : 5))
        const [outerX, outerY] = pointOnArc(a, RADIUS + (labeled ? 6 : 3))
        return (
          <line
            key={v}
            data-testid="speedometer-tick"
            x1={innerX}
            y1={innerY}
            x2={outerX}
            y2={outerY}
            stroke="currentColor"
            strokeWidth={labeled ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {[...LABELED].map((v) => {
        const [x, y] = pointOnArc(valueToAngle(v), RADIUS + 10)
        return (
          <text key={v} x={x} y={y} fill="currentColor" fontSize="10" textAnchor="middle" dominantBaseline="middle">
            {v}
          </text>
        )
      })}
      <line
        data-testid="speedometer-needle"
        x1={CX}
        y1={CY}
        x2={needleTipX}
        y2={needleTipY}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-gold"
      />
      <circle cx={CX} cy={CY} r="3.5" fill="currentColor" className="text-gold" />
    </svg>
  )
}
