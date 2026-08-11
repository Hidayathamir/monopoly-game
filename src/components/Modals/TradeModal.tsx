import { useState } from 'react'
import type { GameState, TradeOffer } from '../../types/game'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onPropose: (offer: TradeOffer) => void
  onClose: () => void
}

export default function TradeModal({ state, onPropose, onClose }: Props) {
  const [targetPlayer, setTargetPlayer] = useState<number | null>(null)
  const [offerProperties, setOfferProperties] = useState<number[]>([])
  const [offerCash, setOfferCash] = useState(0)
  const [requestProperties] = useState<number[]>([])
  const [requestCash, setRequestCash] = useState(0)

  const currentProps = state.board.filter(
    (s) => s.owner === state.currentPlayer && !s.mortgaged && s.houses === 0
  )

  function handlePropose() {
    if (targetPlayer === null) return
    onPropose({
      fromId: state.currentPlayer,
      toId: targetPlayer,
      offerProperties,
      offerCash,
      requestProperties,
      requestCash,
    })
  }

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">🤝 Tukar</h3>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-dim">Dengan:</label>
        <select
          value={targetPlayer ?? ''}
          onChange={(e) => setTargetPlayer(Number(e.target.value))}
          className="p-2 rounded-md border border-border bg-input-bg text-text"
        >
          <option value="">Pilih pemain</option>
          {state.players
            .filter((p) => p.id !== state.currentPlayer && !p.bankrupt)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm text-gold m-0">Anda tawarkan:</h4>
          <label className="text-xs flex items-center gap-1 text-text-dim">
            Uang: <input type="number" value={offerCash} onChange={(e) => setOfferCash(Number(e.target.value))} min={0} className="w-20 py-1 px-2 rounded border border-border bg-input-bg text-text text-xs" />
          </label>
          {currentProps.map((s) => (
            <label key={s.id} className="text-xs flex items-center gap-1 text-text-dim">
              <input
                type="checkbox"
                checked={offerProperties.includes(s.id)}
                onChange={() =>
                  setOfferProperties((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                  )
                }
                className="mr-1"
              />
              {s.name}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm text-gold m-0">Anda minta:</h4>
          <label className="text-xs flex items-center gap-1 text-text-dim">
            Uang: <input type="number" value={requestCash} onChange={(e) => setRequestCash(Number(e.target.value))} min={0} className="w-20 py-1 px-2 rounded border border-border bg-input-bg text-text text-xs" />
          </label>
        </div>
      </div>
      <Modal.Actions>
        <Button variant="success" onClick={handlePropose}>Ajukan</Button>
        <Button variant="secondary" onClick={onClose}>Batal</Button>
      </Modal.Actions>
    </Modal>
  )
}
