import { PendingActionType, type GameState } from '../types/game'

interface Props {
  state: GameState
}

function statusText(state: GameState): string {
  const p = state.players[state.currentPlayer]
  const pending = state.pendingAction
  if (pending?.type === PendingActionType.BuyProperty) return 'Tawaran beli properti'
  if (pending?.type === PendingActionType.PayRent) return 'Bayar sewa'
  if (pending?.type === PendingActionType.Bankruptcy) return 'Uang tidak cukup'
  if (pending?.type === PendingActionType.DrawCard) return 'Ambil kartu'
  if (pending?.type === PendingActionType.CardEffect) return 'Efek kartu'
  if (p.inJail) return 'Di penjara'
  if (state.dice) return `Dadu ${state.dice[0]} + ${state.dice[1]} = ${state.dice[0] + state.dice[1]}`
  return 'Lempar dadu'
}

export default function TurnHeader({ state }: Props) {
  const player = state.players[state.currentPlayer]
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-muted">Giliran</div>
      <div className="text-2xl font-bold text-gold leading-tight">{player.name}</div>
      <div className="text-sm text-muted mt-0.5">{statusText(state)}</div>
    </div>
  )
}
