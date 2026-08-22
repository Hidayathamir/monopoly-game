import { ConnectionStatus } from '../types/net'
import type { LobbyPlayer } from '../types/net'
import type { NetworkGameApi } from '../hooks/useNetworkGame'
import { useTranslation } from 'react-i18next'
import { PLAYER_COLORS, MAX_PLAYERS } from '../data/players'
import { PRESET_AVATARS, PRESET_EMOJI, DEFAULT_AVATAR, CUSTOM_AVATAR_MAX_DIMENSION, type PresetAvatarId } from '../data/avatars'
import { AvatarKind } from '../types/game'
import { loadIdentity, saveIdentity } from '../net/identity'
import Avatar from './Avatar'
import Button from './Button'
import RoomExit from './RoomExit'
import LoadScenarioPanel from './LoadScenarioPanel'
import { useServerConfig } from '../hooks/useServerConfig'

interface Props {
  game: NetworkGameApi
}

export default function Lobby({ game }: Props) {
  const { t } = useTranslation()
  const { lobby, playerId, hostPlayerId, code, status, error, start, leave, addBot, removeBot, setIdentity } = game
  const isHost = playerId !== null && playerId === hostPlayerId
  const url = typeof window !== 'undefined' ? window.location.origin : ''
  const { seedEnabled } = useServerConfig()
  const mySlot = playerId != null ? lobby[playerId] : undefined

  function pickColor(color: string) {
    setIdentity({ color })
    const cur = loadIdentity()
    saveIdentity({ color, avatar: cur?.avatar ?? mySlot?.avatar ?? DEFAULT_AVATAR })
  }

  function pickPreset(id: PresetAvatarId) {
    const avatar = { kind: AvatarKind.Preset, id }
    setIdentity({ avatar })
    saveIdentity({ color: mySlot?.color ?? PLAYER_COLORS[playerId!], avatar })
  }

  async function uploadCustom(file: File) {
    try {
      const dataUrl = await downscaleImage(file)
      const avatar = { kind: AvatarKind.Custom, dataUrl }
      setIdentity({ avatar })
      saveIdentity({ color: mySlot?.color ?? PLAYER_COLORS[playerId!], avatar })
    } catch {
      // ignore unreadable/invalid images
    }
  }

  function downscaleImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read failed'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('decode failed'))
        img.onload = () => {
          const scale = Math.min(1, CUSTOM_AVATAR_MAX_DIMENSION / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('no canvas')); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = String(reader.result)
      }
      reader.readAsDataURL(file)
    })
  }

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
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p?.color ?? PLAYER_COLORS[i] }} />
                <span className="text-muted">{i === hostPlayerId ? t('lobby.host') : t('lobby.player')} {i + 1}</span>
                {p && <Avatar avatar={p.avatar} className="w-4 h-4 rounded-full object-cover inline-block" />}
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

        {playerId != null && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <div className="text-xs uppercase tracking-[0.25em] text-muted text-center">{t('lobby.yourLook')}</div>
            <div className="text-xs text-muted text-center">{t('lobby.pieceColor')}</div>
            <div data-testid="color-picker" className="flex gap-1.5 flex-wrap justify-center">
              {PLAYER_COLORS.map((c) => {
                const taken = lobby.some((p) => p.id !== playerId && p.name !== null && p.color === c)
                const selected = mySlot?.color === c
                return (
                  <button
                    key={c}
                    type="button"
                    data-testid="color-swatch"
                    aria-label={`${t('lobby.pieceColor')} ${c}`}
                    aria-disabled={taken}
                    disabled={taken}
                    onClick={() => pickColor(c)}
                    className={[
                      'w-7 h-7 rounded-full border-2 border-transparent transition',
                      selected ? 'ring-2 ring-gold border-white' : '',
                      taken ? 'opacity-30 cursor-not-allowed' : '',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                  />
                )
              })}
            </div>
            <label className="flex items-center gap-2 justify-center text-xs text-muted">
              {t('lobby.customColor')}
              <input
                type="color"
                data-testid="color-custom"
                value={mySlot?.color ?? PLAYER_COLORS[playerId ?? 0]}
                onChange={(e) => pickColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border"
              />
            </label>
            <div className="text-xs text-muted text-center">{t('lobby.avatar')}</div>
            <div data-testid="avatar-picker" className="flex gap-1.5 flex-wrap justify-center">
              {(Object.values(PRESET_AVATARS) as PresetAvatarId[]).map((id) => {
                const takenAvatar = (avatarId: PresetAvatarId) =>
                  lobby.some((p) => p.id !== playerId && p.name !== null && p.avatar?.kind === AvatarKind.Preset && p.avatar.id === avatarId)
                const taken = takenAvatar(id)
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid="avatar-option"
                    aria-label={`${t('lobby.avatar')} ${id}`}
                    aria-disabled={taken}
                    disabled={taken}
                    onClick={() => pickPreset(id)}
                    className={[
                      'w-8 h-8 rounded-lg text-lg flex items-center justify-center border',
                      mySlot?.avatar.kind === AvatarKind.Preset && mySlot.avatar.id === id ? 'ring-2 ring-gold border-white' : 'border-border',
                      taken ? 'opacity-30 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {PRESET_EMOJI[id]}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 items-center justify-center">
              <label data-testid="avatar-upload" className="cursor-pointer text-sm">
                {t('lobby.uploadAvatar')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadCustom(file)
                  }}
                />
              </label>
              {mySlot?.avatar.kind === AvatarKind.Custom && (
                <button type="button" data-testid="avatar-remove-custom" onClick={() => pickPreset(PRESET_AVATARS.Cat)}>
                  {t('lobby.usePreset')}
                </button>
              )}
            </div>
          </div>
        )}

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
