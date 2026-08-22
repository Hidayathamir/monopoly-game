import { useEffect, useRef, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Player, Space } from '../types/game'
import { useCurrency } from '../i18n/CurrencyContext'
import Button from './Button'
import Avatar from './Avatar'

function MoneyChange({ diff }: { diff: number }) {
  const { formatMoney } = useCurrency()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(t)
  }, [diff])

  if (!visible) return null
  const isGain = diff > 0
  return (
    <span
      className={[
        'absolute inset-x-0 bottom-full text-center text-lg font-bold whitespace-nowrap pointer-events-none animate-money-float',
        isGain ? 'text-green-money' : 'text-red-danger',
      ].join(' ')}
    >
      {isGain ? '+' : ''}{formatMoney(diff)}
    </span>
  )
}

interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  diff?: { diff: number; key: number } | null
  board: Space[]
  connected?: boolean
  canTrade?: boolean
  currentPlayerId?: number
  myPlayerId?: number | null
  onProposeTrade?: (playerId: number) => void
  tradesEnabled?: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export function computePopupPosition(
  rect: Pick<DOMRect, 'left' | 'right' | 'top'>,
  width: number,
  height: number,
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  let left = rect.right + margin
  if (left + width > viewport.width - margin) left = rect.left - width - margin
  left = Math.max(margin, Math.min(left, viewport.width - width - margin))
  const top = Math.max(margin, Math.min(rect.top - 4, viewport.height - height - margin))
  return { left, top }
}

export default function PlayerCard({ player, isCurrent, diff, board, connected = true, canTrade = true, currentPlayerId, myPlayerId, onProposeTrade, tradesEnabled = true }: PlayerCardProps) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const [popupRect, setPopupRect] = useState<DOMRect | null>(null)
  const [pinnedRect, setPinnedRect] = useState<DOMRect | null>(null)
  const [isTouch] = useState(() => {
    const mq = window.matchMedia
    return mq ? mq('(hover: none)').matches : false
  })
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cardRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const activeRect = popupRect ?? pinnedRect

  const owned = player.properties
    .map((id) => board[id])
    .filter((s): s is Space => s !== undefined)

  function handleEnter(e: React.MouseEvent<HTMLDivElement>) {
    clearTimeout(timerRef.current)
    setPopupRect(e.currentTarget.getBoundingClientRect())
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isTouch) return
    setPinnedRect(e.currentTarget.getBoundingClientRect())
  }

  function handleLeave() {
    if (pinnedRect != null) return
    timerRef.current = setTimeout(() => setPopupRect(null), 200)
  }

  function closePopup() {
    setPinnedRect(null)
    setPopupRect(null)
  }

  function handleTrade() {
    clearTimeout(timerRef.current)
    closePopup()
    onProposeTrade?.(player.id)
  }

  useEffect(() => {
    if (!activeRect) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (cardRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      closePopup()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [activeRect])

  return (
    <>
      <div
        ref={cardRef}
        data-testid="player-card"
        className={[
          'px-2 py-1.5 rounded-lg bg-bg-dark/70 border border-border-light flex-1 min-w-[130px]',
          isCurrent ? 'ring-2 ring-gold/80 bg-[#1a4a7a]/70' : '',
          player.bankrupt || !connected ? 'opacity-50' : '',
        ].join(' ')}
        style={{ borderLeft: `3px solid ${player.color}` }}
onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1.5 text-base">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: player.color }} />
          <Avatar avatar={player.avatar} className="w-4 h-4 rounded-full object-cover flex-shrink-0" title={player.name} />
          <strong className="truncate">{player.name}</strong>
          {player.inJail && <span>🔒</span>}
          {player.getOutOfJailFreeCards > 0 && (
            <span title={player.getOutOfJailFreeCards > 1 ? t('card.jailFreeCount', { count: player.getOutOfJailFreeCards }) : t('card.jailFreeTitle')}>🎴</span>
          )}
          {player.bankrupt && <span className="text-xs font-bold text-red-danger">{t('card.bankrupt')}</span>}
          {!connected && <span className="text-xs font-bold text-muted">{t('card.disconnected')}</span>}
          {player.botControlled && <span className="text-xs font-bold text-gold">🤖 {t('card.botControl')}</span>}
        </div>
        <div className={[
          'text-sm font-semibold flex items-center relative',
          player.money < 0 ? 'text-red-danger' : 'text-green-money',
        ].join(' ')}>
          <span className="whitespace-nowrap">{formatMoney(player.money)}</span>
          {diff && <MoneyChange key={diff.key} diff={diff.diff} />}
        </div>
      </div>

      {activeRect &&
        createPortal(
          <PlayerPopup
            player={player}
            owned={owned}
            color={player.color}
            rect={activeRect}
            popupRef={popupRef}
            onEnter={() => clearTimeout(timerRef.current)}
            onLeave={handleLeave}
            canTrade={canTrade}
            currentPlayerId={currentPlayerId}
            myPlayerId={myPlayerId}
            onProposeTrade={handleTrade}
            tradesEnabled={tradesEnabled}
            pinned={pinnedRect != null}
            onClose={closePopup}
          />,
          document.body,
        )
      }
    </>
  )
}

function PlayerPopup({ player, owned, color, rect, popupRef, onEnter, onLeave, canTrade, currentPlayerId, myPlayerId, onProposeTrade, tradesEnabled, pinned, onClose }: {
  player: Player
  owned: Space[]
  color: string
  rect: DOMRect
  popupRef: React.RefObject<HTMLDivElement | null>
  onEnter: () => void
  onLeave: () => void
  canTrade: boolean
  currentPlayerId?: number
  myPlayerId?: number | null
  onProposeTrade?: () => void
  tradesEnabled: boolean
  pinned: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = popupRef.current
    if (!el) return
    setPos(computePopupPosition(rect, el.offsetWidth, el.offsetHeight, {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }, [rect, popupRef])

  return (
    <div
      ref={popupRef}
      className="fixed bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[180px] max-w-[min(260px,calc(100vw-16px))] max-h-[60vh] overflow-y-auto z-[999] shadow-lg"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {pinned && (
        <button
          type="button"
          aria-label={t('tooltip.close')}
          onClick={onClose}
          className="absolute -top-2 -right-2 z-[1000] w-6 h-6 rounded-full bg-bg-dark border border-border-light text-text-dim text-xs font-bold leading-none flex items-center justify-center shadow-md cursor-pointer"
        >
          ✕
        </button>
      )}
      <div className="text-base text-gold mb-1 border-l-[3px] pl-1.5" style={{ borderLeftColor: color }}>
        <strong>{player.name}</strong>
      </div>
      <div className={player.money < 0 ? 'text-sm text-red-danger mb-1.5' : 'text-sm text-green-money mb-1.5'}>
        {t('card.money')}<strong>{formatMoney(player.money)}</strong>
      </div>
      {player.getOutOfJailFreeCards > 0 && (
        <div className="text-sm text-gold mb-1.5">
          {player.getOutOfJailFreeCards > 1 ? t('card.jailFreeCount', { count: player.getOutOfJailFreeCards }) : t('card.jailFree')}
        </div>
      )}
      {owned.length > 0 && (
        <>
          <div className="text-xs text-text-dim mb-1">{t('card.properties')}</div>
          <div className="flex flex-col gap-0.5">
            {owned.map((s) => (
              <div key={s.id} className="text-sm text-text-dim flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color || color }}
                />
                <span className={s.mortgaged ? 'line-through opacity-50' : ''}>{t('board.space.' + s.id)}</span>
                {s.mortgaged && <span className="text-red-danger text-xs font-bold">{t('card.mortgaged')}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {owned.length === 0 && (
        <div className="text-sm text-muted italic">{t('card.noProperties')}</div>
      )}
      {player.id !== (myPlayerId ?? currentPlayerId) && tradesEnabled && (
        <Button size="sm" disabled={!canTrade} onClick={onProposeTrade} className="w-full mt-2">
          {t('action.trade')}
        </Button>
      )}
    </div>
  )
}
