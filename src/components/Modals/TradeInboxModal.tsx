import { useTranslation } from 'react-i18next'
import type { GameState } from '../../types/game'
import { useCurrency } from '../../i18n/CurrencyContext'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  myPlayerId: number | null
  onAccept: (tradeId: number) => void
  onReject: (tradeId: number) => void
  onCancel: (tradeId: number) => void
  onClose: () => void
}

export default function TradeInboxModal({ state, myPlayerId, onAccept, onReject, onCancel, onClose }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()

  const relevant = myPlayerId === null
    ? state.pendingTrades
    : state.pendingTrades.filter((tr) => tr.fromId === myPlayerId || tr.toId === myPlayerId)

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">{t('trade.inbox')}</h3>
      {relevant.length === 0 && <p className="text-base text-muted">{t('trade.noOffers')}</p>}
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {relevant.map((tr) => {
          const from = state.players[tr.fromId]?.name ?? '?'
          const to = state.players[tr.toId]?.name ?? '?'
          const offerProps = tr.offerProperties.map((id) => t('board.space.' + id)).join(', ')
          const requestProps = tr.requestProperties.map((id) => t('board.space.' + id)).join(', ')
          const canAccept = myPlayerId === null || tr.toId === myPlayerId
          const canCancel = myPlayerId === null || tr.fromId === myPlayerId

          // Derive the viewer's perspective.
          const viewerIsRecipient = myPlayerId !== null && tr.toId === myPlayerId
          const viewerIsProposer = myPlayerId !== null && tr.fromId === myPlayerId
          const giveProps = viewerIsRecipient ? requestProps : offerProps
          const giveCash = viewerIsRecipient ? tr.requestCash : tr.offerCash
          const receiveProps = viewerIsRecipient ? offerProps : requestProps
          const receiveCash = viewerIsRecipient ? tr.offerCash : tr.requestCash

          let giveLabel: string
          let receiveLabel: string
          if (viewerIsRecipient || viewerIsProposer) {
            giveLabel = t('trade.youGive')
            receiveLabel = t('trade.youReceive')
          } else {
            giveLabel = t('trade.gives', { name: from })
            receiveLabel = t('trade.wants', { name: from })
          }

          return (
            <div key={tr.id} data-testid="trade-offer" className="bg-bg-darker rounded p-2">
              <p className="text-sm text-text-dim">
                <strong>{from}</strong> → <strong>{to}</strong>
              </p>
              <p className="text-sm text-text-dim">
                {receiveLabel} {receiveProps || '—'} + {formatMoney(receiveCash)}
              </p>
              <p className="text-sm text-text-dim">
                {giveLabel} {giveProps || '—'} + {formatMoney(giveCash)}
              </p>
              <div className="flex gap-1 mt-1">
                {canAccept && (
                  <Button size="sm" variant="success" onClick={() => onAccept(tr.id)}>{t('trade.accept')}</Button>
                )}
                {canAccept && (
                  <Button size="sm" variant="secondary" onClick={() => onReject(tr.id)}>{t('trade.reject')}</Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="danger" onClick={() => onCancel(tr.id)}>{t('trade.cancel')}</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Modal.Actions>
        <Button variant="secondary" onClick={onClose}>{t('trade.close')}</Button>
      </Modal.Actions>
    </Modal>
  )
}
