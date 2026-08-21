import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SpaceType, type GameState } from '../types/game'
import { BOARD_CORNER_SPACES, MAX_HOUSES, type BoardCornerSpace } from '../data/board'
import PropertyTooltip from './PropertyTooltip'

interface Props {
  state: GameState
  isMyTurn: boolean
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}

const CORNER_CELL: Record<BoardCornerSpace, { gridColumn: number; gridRow: number }> = {
  [BOARD_CORNER_SPACES[0]]: { gridColumn: 11, gridRow: 11 },
  [BOARD_CORNER_SPACES[1]]: { gridColumn: 1, gridRow: 11 },
  [BOARD_CORNER_SPACES[2]]: { gridColumn: 1, gridRow: 1 },
  [BOARD_CORNER_SPACES[3]]: { gridColumn: 11, gridRow: 1 },
}

function getCellPosition(id: number): { gridColumn: number; gridRow: number } | null {
  const corner = CORNER_CELL[id as BoardCornerSpace]
  if (corner) return corner
  if (id >= 1 && id <= 9) return { gridColumn: 10 - (id - 1), gridRow: 11 }
  if (id >= 11 && id <= 19) return { gridColumn: 1, gridRow: 10 - (id - 11) }
  if (id >= 21 && id <= 29) return { gridColumn: 2 + (id - 21), gridRow: 1 }
  return { gridColumn: 11, gridRow: 2 + (id - 31) }
}

const TYPE_BG: Partial<Record<SpaceType, string>> = {
  [SpaceType.Go]: 'bg-cell-go',
  [SpaceType.Jail]: 'bg-cell-jail',
  [SpaceType.GoToJail]: 'bg-cell-jail',
  [SpaceType.FreeParking]: 'bg-cell-free-parking',
  [SpaceType.Tax]: 'bg-cell-tax',
  [SpaceType.Chance]: 'bg-cell-chance',
  [SpaceType.Community]: 'bg-cell-community',
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

export default function BoardGrid({ state, isMyTurn, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
  const { t } = useTranslation()
  const { board } = state
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)
  const [isTouch] = useState(() => {
    const mq = window.matchMedia
    return mq ? mq('(hover: none)').matches : false
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const cellRectRef = useRef<DOMRect | null>(null)

  const activeId = hoveredId ?? pinnedId

  function openTooltip(id: number, rect: DOMRect) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHoveredId(id)
    cellRectRef.current = rect
    setTooltipPos(computeTooltipPosition(rect, getCellPosition(id), 260, 300))
  }

  function closeTooltip() {
    setPinnedId(null)
    setHoveredId(null)
  }

  function handleEnter(id: number, e: React.MouseEvent<HTMLDivElement>) {
    openTooltip(id, e.currentTarget.getBoundingClientRect())
  }

  function handleLeave() {
    if (pinnedId != null) return
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY)
  }

  function handleTooltipEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handleTooltipLeave() {
    if (pinnedId != null) return
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY)
  }

  function handleClick(id: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!isTouch) return
    setPinnedId(id)
    openTooltip(id, e.currentTarget.getBoundingClientRect())
  }

  useEffect(() => {
    if (pinnedId == null) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (tooltipRef.current?.contains(target)) return
      if ((target as HTMLElement).closest?.('[data-testid^="board-cell-"]')) return
      closeTooltip()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [pinnedId])

  useLayoutEffect(() => {
    if (activeId == null || !tooltipRef.current || !cellRectRef.current) return
    const tipW = tooltipRef.current.offsetWidth
    const tipH = tooltipRef.current.offsetHeight
    setTooltipPos(computeTooltipPosition(cellRectRef.current, getCellPosition(activeId), tipW, tipH))
  }, [activeId])

  return (
    <div
      className="grid grid-cols-11 grid-rows-11 w-full h-full overflow-hidden relative z-[1] select-none"
    >
      {board.map((space) => {
        const owner = space.owner !== null ? state.players[space.owner] : null
        const pos = getCellPosition(space.id)

        return (
          <div
            key={space.id}
            data-testid={'board-cell-' + space.id}
            className={[
              'border border-border text-sm flex flex-col items-center justify-center relative overflow-hidden p-0.5 select-none',
              'hover:bg-bg-cell-hover hover:z-[2]',
              TYPE_BG[space.type] ?? 'bg-bg-cell',
              space.type === SpaceType.Chance ? '[&_.cell-name]:text-gold' : '',
              space.type === SpaceType.Community ? '[&_.cell-name]:text-[#40c0f0]' : '',
            ].join(' ')}
            style={{
              ...(pos ? { gridColumn: pos.gridColumn, gridRow: pos.gridRow } : {}),
              ...(space.color ? { background: `${space.color}30` } : {}),
              WebkitTouchCallout: 'none',
            }}
            onMouseEnter={(e) => handleEnter(space.id, e)}
            onMouseLeave={handleLeave}
            onClick={(e) => handleClick(space.id, e)}
          >
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => e.preventDefault()}
              className="cell-name m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-xs text-center font-semibold leading-tight text-text-dim"
            >
              {t('board.space.' + space.id)}
            </button>
            {space.houses > 0 && space.houses < MAX_HOUSES && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-xs tracking-[-1px]"
              >
                {'🏠'.repeat(space.houses)}
              </button>
            )}
            {space.houses === MAX_HOUSES && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-base"
              >
                🏨
              </button>
            )}
            {space.mortgaged && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
                className="m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none absolute top-px right-0.5 text-xs bg-red-danger text-white rounded-sm px-0.5 font-bold"
              >
                M
              </button>
            )}
            {owner && (
              <div
                className="absolute bottom-0 left-0 w-full h-1 z-[1]"
                style={{ backgroundColor: state.players[owner.id]?.color ?? '#000' }}
              />
            )}
          </div>
        )
      })}

      {activeId != null && tooltipPos &&
        createPortal(
          <div
            ref={tooltipRef}
            data-testid="property-tooltip"
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              zIndex: 999,
            }}
          >
            {pinnedId != null && (
              <button
                type="button"
                data-testid="tooltip-close"
                aria-label={t('tooltip.close')}
                onClick={closeTooltip}
                className="absolute -top-2 -right-2 z-[1000] w-6 h-6 rounded-full bg-bg-dark border border-border-light text-text-dim text-xs font-bold leading-none flex items-center justify-center shadow-md cursor-pointer"
              >
                ✕
              </button>
            )}
            <PropertyTooltip
              space={board[activeId]}
              state={state}
              isMyTurn={isMyTurn}
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
