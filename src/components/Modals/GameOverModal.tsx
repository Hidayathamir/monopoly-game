import { GamePhase, type GameState } from '../../types/game'
import { useCurrency } from '../../i18n/CurrencyContext'
import { getTotalHouseInvestment } from '../../data/board'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onReset: () => void
}

export default function GameOverModal({ state, onReset }: Props) {
  const { formatMoney } = useCurrency()
  if (state.phase !== GamePhase.GameOver) return null
  const winner = state.players.find((p) => !p.bankrupt)
  if (!winner) return null

  const netWorth = winner.money + state.board
    .filter((s) => s.owner === winner.id)
    .reduce((sum, s) => sum + (s.price ?? 0) + getTotalHouseInvestment(s), 0)

  return (
    <Modal className="text-center">
      <h2 className="text-3xl text-gold m-0">🏆 Permainan Selesai!</h2>
      <p className="text-[49px] text-gold font-bold">{winner.name} menang!</p>
      <p className="text-lg m-0">Dengan kekayaan bersih: {formatMoney(netWorth)}</p>
      <Modal.Actions>
        <Button variant="primary" onClick={onReset}>Main Lagi</Button>
      </Modal.Actions>
    </Modal>
  )
}
