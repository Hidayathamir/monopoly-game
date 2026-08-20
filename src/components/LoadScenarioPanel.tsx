import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { validateStateStructure, ValidationKind } from '../logic/seed'
import { HttpPath } from '../types/net'
import type { GameState } from '../types/game'

const ScenarioMessageKind = { Ok: 'ok', Error: 'error' } as const
type ScenarioMessageKind = (typeof ScenarioMessageKind)[keyof typeof ScenarioMessageKind]

interface Props {
  seedEnabled: boolean
  code: string | null
}

export default function LoadScenarioPanel({ seedEnabled, code }: Props) {
  const { t } = useTranslation()
  const [json, setJson] = useState('')
  const [roomCode, setRoomCode] = useState(code ?? '')
  const [message, setMessage] = useState<{ kind: ScenarioMessageKind; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!seedEnabled) return null

  function handleValidate() {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      setMessage({ kind: ScenarioMessageKind.Error, text: t('seed.invalidJson') })
      return
    }
    const result = validateStateStructure(parsed as GameState)
    setMessage(result.kind === ValidationKind.Ok ? { kind: ScenarioMessageKind.Ok, text: t('seed.validJson') } : { kind: ScenarioMessageKind.Error, text: result.message })
  }

  async function handleApply() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(HttpPath.Seed, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, state: JSON.parse(json) }),
      })
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      if (res.ok) {
        setMessage({ kind: ScenarioMessageKind.Ok, text: t('seed.applied') })
        setJson('')
      } else {
        setMessage({ kind: ScenarioMessageKind.Error, text: `${t('seed.applyError')}: ${body?.message ?? res.status}` })
      }
    } catch {
      setMessage({ kind: ScenarioMessageKind.Error, text: t('seed.applyError') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg-card px-10 py-6 rounded-xl flex flex-col gap-3 min-w-[360px] border border-border-light">
      <h2 className="text-xl text-gold m-0">{t('seed.title')}</h2>
      <label className="text-sm text-muted">
        {t('seed.roomCode')}
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          maxLength={5}
          className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base w-full mt-1"
        />
      </label>
      <label className="text-sm text-muted">
        {t('seed.json')}
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-xs font-mono w-full mt-1"
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleValidate}>{t('seed.validate')}</Button>
        <Button size="sm" onClick={handleApply} disabled={busy}>{t('seed.apply')}</Button>
      </div>
      {message && (
        <p className={message.kind === ScenarioMessageKind.Ok ? 'text-green-money text-sm' : 'text-red-danger text-sm'}>{message.text}</p>
      )}
    </div>
  )
}