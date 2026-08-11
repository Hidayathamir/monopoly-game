import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from '../types/game'
import { formatMoney } from '../utils/format'
import PropertyTooltip, { type CellSide } from './PropertyTooltip'

interface Props {
  state: GameState
  playerColors: string[]
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onBuild: (spaceId: number) => void
}

function getSide(id: number): CellSide {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner'
  if (id <= 9) return 'bottom'
  if (id <= 19) return 'right'
  if (id <= 29) return 'left'
  return 'top'
}

function getCellPosition(id: number): { gridColumn: number; gridRow: number } | null {
  if (id === 0) return { gridColumn: 11, gridRow: 11 }
  if (id >= 1 && id <= 9) return { gridColumn: 10 - (id - 1), gridRow: 11 }
  if (id === 10) return { gridColumn: 1, gridRow: 11 }
  if (id >= 11 && id <= 19) return { gridColumn: 1, gridRow: 10 - (id - 11) }
  if (id === 20) return { gridColumn: 1, gridRow: 1 }
  if (id >= 21 && id <= 29) return { gridColumn: 2 + (id - 21), gridRow: 1 }
  if (id === 30) return { gridColumn: 11, gridRow: 1 }
  return { gridColumn: 11, gridRow: 2 + (id - 31) }
}

const TYPE_BG: Record<string, string> = {
  go: 'bg-cell-go',
  jail: 'bg-cell-jail',
  goToJail: 'bg-cell-jail',
  freeParking: 'bg-cell-free-parking',
  tax: 'bg-cell-tax',
  chance: 'bg-cell-chance',
  community: 'bg-cell-community',
}

const HIDE_DELAY = 400

export default function BoardGrid({ state, playerColors, onSell, onMortgage, onUnmortgage, onBuild }: Props) {
  const { board } = state
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [tooltipCellRect, setTooltipCellRect] = useState<DOMRect | null>(null)
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardGridRef = useRef<HTMLDivElement | null>(null)

  function handleEnter(id: number, e: React.MouseEvent) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const board = boardGridRef.current?.closest('[data-game-board]')
    if (board) setBoardRect(board.getBoundingClientRect())
    setTooltipCellRect((e.currentTarget as HTMLElement).getBoundingClientRect())
    setHoveredId(id)
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY)
  }

  function handleTooltipEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handleTooltipLeave() {
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY)
  }

  const portalTarget = boardGridRef.current?.closest('[data-game-board]') as HTMLElement | null

  return (
    <div
      className="grid grid-cols-11 grid-rows-11 w-full h-full overflow-visible relative z-[1]"
      ref={boardGridRef}
    >
      {board.map((space) => {
        const owner = space.owner !== null ? state.players[space.owner] : null
        const pos = getCellPosition(space.id)

        return (
          <div
            key={space.id}
            className={[
              'border border-border text-[9px] flex flex-col items-center justify-center relative overflow-visible p-0.5',
              'hover:bg-bg-cell-hover hover:z-[2]',
              TYPE_BG[space.type] ?? 'bg-bg-cell',
              space.type === 'chance' ? '[&_.cell-name]:text-gold' : '',
              space.type === 'community' ? '[&_.cell-name]:text-[#40c0f0]' : '',
            ].join(' ')}
            style={{
              ...(pos ? { gridColumn: pos.gridColumn, gridRow: pos.gridRow } : {}),
              ...(space.color ? { background: `${space.color}30` } : {}),
            }}
            onMouseEnter={(e) => handleEnter(space.id, e)}
            onMouseLeave={handleLeave}
          >
            <div className="text-[7px] text-center font-semibold leading-tight text-text-dim">{space.name}</div>
            {space.price && <div className="text-[7px] text-[#80c080]">{formatMoney(space.price)}</div>}
            {space.houses > 0 && space.houses < 5 && (
              <div className="text-[7px] tracking-[-1px]">{'🏠'.repeat(space.houses)}</div>
            )}
            {space.houses === 5 && <div className="text-[10px]">🏨</div>}
            {space.mortgaged && (
              <div className="absolute top-px right-0.5 text-[7px] bg-red-danger text-white rounded-sm px-0.5 font-bold">M</div>
            )}
            {owner && (
              <div
                className="absolute bottom-0 left-0 w-full h-1 z-[1]"
                style={{ backgroundColor: playerColors[owner.id] }}
              />
            )}
          </div>
        )
      })}

      {hoveredId != null && tooltipCellRect && boardRect && portalTarget &&
        createPortal(
          <div onMouseEnter={handleTooltipEnter} onMouseLeave={handleTooltipLeave}>
            <PropertyTooltip
              space={board[hoveredId]}
              state={state}
              rect={tooltipCellRect}
              boardRect={boardRect}
              side={getSide(hoveredId)}
              onSell={onSell}
              onMortgage={onMortgage}
              onUnmortgage={onUnmortgage}
              onBuild={onBuild}
            />
          </div>,
          portalTarget,
        )
      }
    </div>
  )
}
