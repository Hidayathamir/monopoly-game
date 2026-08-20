import { ConnectionStatus } from '../types/net'
import type { LobbyPlayer } from '../types/net'
import type { NetworkGameApi } from '../hooks/useNetworkGame'
import { useTranslation } from 'react-i18next'
import { PLAYER_COLORS, MAX_PLAYERS } from '../data/players'
import Button from './Button'
import RoomExit from './RoomExit'
import LoadScenarioPanel from './LoadScenarioPanel'
import { useServerConfig } from '../hooks/useServerConfig'

interface Props {
  game: NetworkGameApi
}

export default function Lobby({ game }: Props) {
  const { t } = useTranslation()
  const { lobby, playerId, hostPlayerId, code, status, error, start, leave, addBot, removeBot } = game
  const isHost = playerId !== null && playerId === hostPlayerId
  const url = typeof window !== 'undefined' ? window.location.origin : ''
  const { seedEnabled } = useServerConfig()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-4xl text-gold m-0">{t('lobby.title')}</h1>
      <div className="bg-bg-card px-10 py-6 rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="text-center">
          <p className="text-sm text-muted">{t('lobby.roomCode')}</p>
          <strong data-testid="room-code" className="text-4xl text-gold tracking-[0.3em]">{code ?? '—'}</strong>
          <p className="text-sm text-muted mt-2">{t('lobby.share')}</p>
          <strong className="text-text break-all">{url}</strong>
        </div>

        {status === ConnectionStatus.Connecting && <p className="text-muted text-center">{t('lobby.connecting')}</p>}
        {status === ConnectionStatus.Disconnected && <p className="text-red-danger text-center">{t('lobby.disconnected')}</p>}
        {error && <p className="text-red-danger text-center">{error}</p>}

        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted mb-1.5 text-center">{t('lobby.players')}</div>
          {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
            const p: LobbyPlayer | undefined = lobby[i]
            return (
              <div key={i} className={`flex items-center gap-2 text-base ${p && !p.connected ? 'opacity-50' : ''}`}>
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                <span className="text-muted">{i === hostPlayerId ? t('lobby.host') : t('lobby.player')} {i + 1}</span>
                <span className="text-text">
                  {p?.name ?? '—'}
                  {p && !p.connected ? t('lobby.disconnectedSuffix') : ''}
                </span>
                {p?.isBot && isHost && (
                  <button
                    aria-label={t('lobby.removeBot', { name: p.name ?? '' })}
                    onClick={() => removeBot(i)}
                    className="ml-auto text-red-danger text-lg leading-none hover:opacity-70"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {isHost && (
          <Button variant="secondary" size="sm" onClick={addBot} disabled={lobby.filter((p) => p.name).length >= MAX_PLAYERS}>
            {t('lobby.addBot')}
          </Button>
        )}

        {isHost && (
          <Button variant="start" size="lg" onClick={start} disabled={lobby.filter((p) => p.name).length < 2}>
            {t('lobby.start', { n: lobby.filter((p) => p.name).length })}
          </Button>
        )}
        <RoomExit onLeave={leave} />
      </div>
      <LoadScenarioPanel seedEnabled={seedEnabled === true} code={code} />
    </div>
  )
}
