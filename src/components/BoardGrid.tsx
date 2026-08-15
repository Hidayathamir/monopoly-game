import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../types/game'
import PropertyTooltip from './PropertyTooltip'

interface Props {
  state: GameState
  playerColors: string[]
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
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

const TOOLTIP_MARGIN = 8

interface TooltipPos {
  top: number
  left: number
}

function computeTooltipPosition(
  rect: DOMRect,
  pos: { gridColumn: number; gridRow: number } | null,
  tipW: number,
  tipH: number,
): TooltipPos {
  const gap = TOOLTIP_MARGIN
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top: number
  let left: number

  if (pos?.gridColumn === 11) {
    top = rect.top + rect.height / 2 - tipH / 2
    left = rect.left - gap - tipW
  } else if (pos?.gridColumn === 1) {
    top = rect.top + rect.height / 2 - tipH / 2
    left = rect.right + gap
  } else if (pos?.gridRow === 1) {
    top = rect.bottom + gap
    left = rect.left + rect.width / 2 - tipW / 2
  } else {
    top = rect.top - gap - tipH
    left = rect.left + rect.width / 2 - tipW / 2
  }

  top = Math.max(0, Math.min(top, vh - tipH))
  left = Math.max(0, Math.min(left, vw - tipW))

  return { top, left }
}

export default function BoardGrid({ state, playerColors, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
  const { t } = useTranslation()
  const { board } = state
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const cellRectRef = useRef<DOMRect | null>(null)

  function handleEnter(id: number, e: React.MouseEvent<HTMLDivElement>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHoveredId(id)
    const rect = e.currentTarget.getBoundingClientRect()
    cellRectRef.current = rect
    setTooltipPos(computeTooltipPosition(rect, getCellPosition(id), 260, 300))
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

  useLayoutEffect(() => {
    if (hoveredId == null || !tooltipRef.current || !cellRectRef.current) return
    const tipW = tooltipRef.current.offsetWidth
    const tipH = tooltipRef.current.offsetHeight
    setTooltipPos(computeTooltipPosition(cellRectRef.current, getCellPosition(hoveredId), tipW, tipH))
  }, [hoveredId])

  return (
    <div
      className="grid grid-cols-11 grid-rows-11 w-full h-full overflow-hidden relative z-[1]"
    >
      {board.map((space) => {
        const owner = space.owner !== null ? state.players[space.owner] : null
        const pos = getCellPosition(space.id)

        return (
          <div
            key={space.id}
            className={[
              'border border-border text-sm flex flex-col items-center justify-center relative overflow-hidden p-0.5',
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
            <div className="text-xs text-center font-semibold leading-tight text-text-dim">{t('board.space.' + space.id)}</div>
            {space.houses > 0 && space.houses < 5 && (
              <div className="text-xs tracking-[-1px]">{'🏠'.repeat(space.houses)}</div>
            )}
            {space.houses === 5 && <div className="text-base">🏨</div>}
            {space.mortgaged && (
              <div className="absolute top-px right-0.5 text-xs bg-red-danger text-white rounded-sm px-0.5 font-bold">M</div>
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

      {hoveredId != null && tooltipPos &&
        createPortal(
          <div
            ref={tooltipRef}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              zIndex: 999,
            }}
          >
            <PropertyTooltip
              space={board[hoveredId]}
              state={state}
              onSell={onSell}
              onMortgage={onMortgage}
              onUnmortgage={onUnmortgage}
              onSellProperty={onSellProperty}
            />
          </div>,
          document.body,
        )
      }
    </div>
  )
}
