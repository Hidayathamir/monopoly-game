// @vitest-environment jsdom
import { fireEvent, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import EventLog from '../EventLog'
import { renderWithProviders } from '../../test/test-utils'
import { SoundProvider } from '../../audio/SoundContext'
import type { LogEntry } from '../../types/game'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

afterEach(cleanup)

describe('EventLog', () => {
  it('shows only the last two entries when collapsed', () => {
    const { getAllByTestId } = renderWithProviders(<EventLog log={[{ key: 'event.gameStarted' }, { key: 'event.turn', params: { name: 'A' } }, { key: 'event.gameStarted' }]} />)
    expect(getAllByTestId('event-entry')).toHaveLength(2)
  })

  it('shows all entries when expanded', () => {
    const { getByRole, getAllByTestId } = renderWithProviders(<EventLog log={[{ key: 'event.gameStarted' }, { key: 'event.turn', params: { name: 'A' } }, { key: 'event.gameStarted' }]} />)
    fireEvent.click(getByRole('button', { name: /Full history/ }))
    expect(getAllByTestId('event-entry')).toHaveLength(3)
  })

  it('plays a click sound when toggling the log', () => {
    playSoundMock.mockClear()
    const log: LogEntry[] = [
      { key: 'event.turn', params: { name: 'A' } },
      { key: 'event.turn', params: { name: 'B' } },
      { key: 'event.turn', params: { name: 'C' } },
    ]
    renderWithProviders(<SoundProvider><EventLog log={log} /></SoundProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Full history/ }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })
})
