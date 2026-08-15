import { GamePhase, PendingActionType, type GameState } from '../types/game'
import { formatMoney } from '../utils/format'
import { JAIL_FINE } from '../data/board'
import Button from './Button'

interface Props {
  state: GameState
  onEndTurn: () => void
  onDrawCard: () => void
  onProposeTrade: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
  isMyTurn?: boolean
}

export default function ActionSection({
  state, onEndTurn, onDrawCard, onProposeTrade, onBuyProperty,
  onDeclineBuy, onPayRent, onDeclareBankruptcy, onPayJailFine, onUseGetOutOfJailFree,
  isMyTurn = true,
}: Props) {
  const player = state.players[state.currentPlayer]
  if (!isMyTurn) return null
  const pending = state.pendingAction
  const canAct = state.phase === GamePhase.Waiting && !pending
  const hasRolled = state.dice !== null

  if (pending?.type === PendingActionType.BuyProperty) {
    const space = state.board[pending.spaceId]
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">Beli <strong>{space.name}</strong>?</p>
          <p className="text-base my-[3px] text-center">Harga: <strong>{formatMoney(space.price)}</strong></p>
          <Button variant="success" onClick={onBuyProperty} disabled={player.money < (space.price ?? 0)}>
            Beli ({formatMoney(space.price)}){player.money < (space.price ?? 0) ? ' - uang kurang' : ''}
          </Button>
          <Button variant="secondary" onClick={onDeclineBuy}>Tidak</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.PayRent || pending?.type === PendingActionType.Bankruptcy) {
    const amount = pending.amount
    const canAffordNow = player.money >= amount
    const label = pending.type === PendingActionType.PayRent ? 'Bayar sewa' : 'Uang tidak cukup!'
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">{label} <strong>{formatMoney(amount)}</strong></p>
          {!canAffordNow && (
            <p className="text-base text-muted text-center font-bold" style={{ color: '#f39c12' }}>
              Hover properti di papan untuk jual/gadai/tebus aset
            </p>
          )}
          <Button variant="success" onClick={onPayRent} disabled={!canAffordNow}>
            {canAffordNow ? 'Bayar Sewa' : 'Uang Masih Kurang'}
          </Button>
          <Button variant="danger" onClick={onDeclareBankruptcy}>Nyatakan Bangkrut</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.DrawCard) {
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <Button variant="primary" onClick={onDrawCard}>Ambil Kartu</Button>
      </div>
    )
  }

  if (pending?.type === PendingActionType.CardEffect) {
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">{pending.card.description}</p>
          <p className="text-base text-muted text-center">Klik tombol untuk melanjutkan</p>
        </div>
      </div>
    )
  }

  if (!canAct) return null

  return (
    <div className="flex flex-col gap-1.5 w-full items-stretch">
      {player.inJail ? (
        <>
          <p className="text-base text-muted text-center mt-1">Di Penjara — pilih:</p>
          {player.hasGetOutOfJailFree && (
            <Button variant="success" size="sm" onClick={onUseGetOutOfJailFree}>
              🎴 Gunakan Kartu Bebas Penjara
            </Button>
          )}
          {player.jailTurns > 0 && (
            <>
              <Button variant="success" size="sm" onClick={onPayJailFine} disabled={player.money < JAIL_FINE}>
                Bayar {formatMoney(JAIL_FINE)}
              </Button>
              {player.money < JAIL_FINE && (
                <p className="text-base text-muted text-center mt-1">Uang tidak cukup</p>
              )}
              <p className="text-base text-muted text-center mt-1">
                atau lempar dadu ganda ({3 - player.jailTurns}x lagi)
              </p>
            </>
          )}
          {player.jailTurns === 0 && (
            <p className="text-base text-muted text-center mt-1">
              Lempar dadu ganda untuk keluar. Bayar bisa mulai putaran depan.
            </p>
          )}
        </>
      ) : hasRolled ? (
        <>
          {player.money >= 0 ? (
            <>
              <Button variant="secondary" onClick={onEndTurn}>Akhiri Giliran</Button>
              <Button size="sm" onClick={onProposeTrade}>🤝 Tukar</Button>
            </>
          ) : (
            <p className="text-base text-muted text-center mt-1" style={{ color: '#e74c3c' }}>
              Uang minus! Jual aset dulu sebelum akhiri giliran.
            </p>
          )}
        </>
      ) : null}
      {(hasRolled && !player.inJail) || player.money < 0 ? (
        <p className="text-base text-muted text-center" style={{ fontSize: '16px' }}>
          Hover properti di papan untuk jual/gadai
        </p>
      ) : null}
    </div>
  )
}
