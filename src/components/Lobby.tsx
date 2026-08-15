import type { LobbyPlayer } from '../types/net'
import type { NetworkGameApi } from '../hooks/useNetworkGame'
import { PLAYER_COLORS } from '../data/players'
import Button from './Button'

interface Props {
  game: NetworkGameApi
}

export default function Lobby({ game }: Props) {
  const { lobby, playerId, hostPlayerId, code, status, error, start, leave } = game
  const isHost = playerId !== null && playerId === hostPlayerId
  const url = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-4xl text-gold m-0">Lobi</h1>
      <div className="bg-bg-card px-10 py-6 rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="text-center">
          <p className="text-sm text-muted">Kode Kamar:</p>
          <strong data-testid="room-code" className="text-4xl text-gold tracking-[0.3em]">{code ?? '—'}</strong>
          <p className="text-sm text-muted mt-2">Bagikan kode atau alamat ini ke temanmu:</p>
          <strong className="text-text break-all">{url}</strong>
        </div>

        {status === 'connecting' && <p className="text-muted text-center">Menghubungkan…</p>}
        {status === 'disconnected' && <p className="text-red-danger text-center">Terputus dari server</p>}
        {error && <p className="text-red-danger text-center">{error}</p>}

        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted mb-1.5 text-center">Pemain</div>
          {Array.from({ length: 6 }).map((_, i) => {
            const p: LobbyPlayer | undefined = lobby[i]
            return (
              <div key={i} className="flex items-center gap-2 text-base">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                <span className="text-muted">{i === hostPlayerId ? 'Host' : 'Pemain'} {i + 1}</span>
                <span className="text-text">
                  {p?.name ?? '—'}
                  {p && !p.connected ? ' (terputus)' : ''}
                </span>
              </div>
            )
          })}
        </div>

        {isHost && (
          <Button variant="start" size="lg" onClick={start} disabled={lobby.filter((p) => p.name).length < 2}>
            Mulai ({lobby.filter((p) => p.name).length}/6)
          </Button>
        )}
        <Button variant="secondary" onClick={leave}>
          Keluar
        </Button>
      </div>
    </div>
  )
}
