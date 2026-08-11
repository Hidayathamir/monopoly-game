import { PendingActionType, type GameState } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { getTotalHouseInvestment } from '../../data/board'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onClose: () => void
  onBankruptcy: () => void
}

export default function BankruptcyModal({ state, onClose, onBankruptcy }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.Bankruptcy) return null
  const player = state.players[state.currentPlayer]
  const amount = pending.amount

  const canPayAfterLiquidation = (() => {
    let money = player.money
    const ownedProps = state.board.filter((s) => s.owner === state.currentPlayer && !s.mortgaged)
    for (const s of ownedProps) {
      money += Math.floor(getTotalHouseInvestment(s) / 2)
      money += Math.floor((s.price ?? 0) / 2)
    }
    return money >= amount
  })()

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">⚠️ Kebangkrutan</h3>
      <p className="text-lg m-0">{player.name} tidak bisa membayar <strong>{formatMoney(amount)}</strong>.</p>
      <p className="text-lg m-0">Uang saat ini: {formatMoney(player.money)}</p>
      {canPayAfterLiquidation && (
        <p className="text-muted text-base">Jual rumah / gadaikan properti untuk mendapatkan uang.</p>
      )}
      <Modal.Actions>
        {!canPayAfterLiquidation && (
          <Button variant="danger" onClick={onBankruptcy}>Nyatakan Bangkrut</Button>
        )}
        <Button variant="secondary" onClick={onClose}>Tutup (Jual/Gadai lebih dulu)</Button>
      </Modal.Actions>
    </Modal>
  )
}
