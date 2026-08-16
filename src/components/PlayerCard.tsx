import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Player, Space } from '../types/game'
import { useCurrency } from '../i18n/CurrencyContext'
import Button from './Button'

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
  color: string
  diff?: { diff: number; key: number } | null
  board: Space[]
  canTrade?: boolean
  currentPlayerId?: number
  onProposeTrade?: (playerId: number) => void
}

export default function PlayerCard({ player, isCurrent, color, diff, board, canTrade = true, currentPlayerId, onProposeTrade }: PlayerCardProps) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const [popupRect, setPopupRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const owned = player.properties
    .map((id) => board[id])
    .filter((s): s is Space => s !== undefined)

  function handleEnter(e: React.MouseEvent<HTMLDivElement>) {
    clearTimeout(timerRef.current)
    setPopupRect(e.currentTarget.getBoundingClientRect())
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setPopupRect(null), 200)
  }

  function handleTrade() {
    clearTimeout(timerRef.current)
    setPopupRect(null)
    onProposeTrade?.(player.id)
  }

  return (
    <>
      <div
        data-testid="player-card"
        className={[
          'px-2 py-1.5 rounded-lg bg-bg-dark/70 border border-border-light flex-1 min-w-[130px]',
          isCurrent ? 'ring-2 ring-gold/80 bg-[#1a4a7a]/70' : '',
          player.bankrupt ? 'opacity-50' : '',
        ].join(' ')}
        style={{ borderLeft: `3px solid ${color}` }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="flex items-center gap-1.5 text-base">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
          <strong className="truncate">{player.name}</strong>
          {player.inJail && <span>🔒</span>}
          {player.getOutOfJailFreeCards > 0 && (
            <span title={player.getOutOfJailFreeCards > 1 ? t('card.jailFreeCount', { count: player.getOutOfJailFreeCards }) : t('card.jailFreeTitle')}>🎴</span>
          )}
          {player.bankrupt && <span className="text-xs font-bold text-red-danger">{t('card.bankrupt')}</span>}
        </div>
        <div className={[
          'text-sm font-semibold flex items-center relative',
          player.money < 0 ? 'text-red-danger' : 'text-green-money',
        ].join(' ')}>
          <span className="whitespace-nowrap">{formatMoney(player.money)}</span>
          {diff && <MoneyChange key={diff.key} diff={diff.diff} />}
        </div>
      </div>

      {popupRect &&
        createPortal(
          <PlayerPopup
            player={player}
            owned={owned}
            color={color}
            rect={popupRect}
            onEnter={() => clearTimeout(timerRef.current)}
            onLeave={handleLeave}
            canTrade={canTrade}
            currentPlayerId={currentPlayerId}
            onProposeTrade={handleTrade}
          />,
          document.body,
        )
      }
    </>
  )
}

function PlayerPopup({ player, owned, color, rect, onEnter, onLeave, canTrade, currentPlayerId, onProposeTrade }: {
  player: Player
  owned: Space[]
  color: string
  rect: DOMRect
  onEnter: () => void
  onLeave: () => void
  canTrade: boolean
  currentPlayerId?: number
  onProposeTrade?: () => void
}) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  return (
    <div
      className="fixed bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[180px] max-w-[260px] max-h-[60vh] overflow-y-auto z-[999] shadow-lg"
      style={{
        left: rect.right + 8,
        top: Math.max(0, rect.top - 4),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
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
      {player.id !== currentPlayerId && (
        <Button size="sm" disabled={!canTrade} onClick={onProposeTrade} className="w-full mt-2">
          {t('action.trade')}
        </Button>
      )}
    </div>
  )
}
