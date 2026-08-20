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

  describe('scroll behavior', () => {
    const makeLog = (n: number): LogEntry[] =>
      Array.from({ length: n }, (_, i) => ({ key: 'event.turn', params: { name: 'P' + i } }))

    function mockScroll(el: HTMLElement, scrollHeight: number, clientHeight: number) {
      Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
      Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
    }

    it('scrolls to the bottom when expanded', () => {
      const { getByTestId, getByRole } = renderWithProviders(<EventLog log={makeLog(10)} />)
      const container = getByTestId('event-log')
      mockScroll(container, 500, 100)
      fireEvent.click(getByRole('button', { name: /Full history/ }))
      expect(container.scrollTop).toBe(500)
    })

    it('keeps the viewport at the bottom when new events arrive while at the bottom', () => {
      const { getByTestId, getByRole, rerender } = renderWithProviders(<EventLog log={makeLog(10)} />)
      const container = getByTestId('event-log')
      mockScroll(container, 500, 100)
      fireEvent.click(getByRole('button', { name: /Full history/ }))
      container.scrollTop = 480
      fireEvent.scroll(container)
      mockScroll(container, 600, 100)
      rerender(<EventLog log={makeLog(20)} />)
      expect(container.scrollTop).toBe(600)
    })

    it('does not move the viewport when new events arrive while scrolled up', () => {
      const { getByTestId, getByRole, rerender } = renderWithProviders(<EventLog log={makeLog(10)} />)
      const container = getByTestId('event-log')
      mockScroll(container, 500, 100)
      fireEvent.click(getByRole('button', { name: /Full history/ }))
      container.scrollTop = 50
      fireEvent.scroll(container)
      rerender(<EventLog log={makeLog(20)} />)
      expect(container.scrollTop).toBe(50)
    })

    it('shows the Latest chip when scrolled up and jumps to the bottom on click', () => {
      const { getByTestId, getByRole, queryByRole } = renderWithProviders(<EventLog log={makeLog(10)} />)
      const container = getByTestId('event-log')
      mockScroll(container, 500, 100)
      fireEvent.click(getByRole('button', { name: /Full history/ }))
      expect(queryByRole('button', { name: /Latest/ })).toBeNull()
      container.scrollTop = 50
      fireEvent.scroll(container)
      const latest = getByRole('button', { name: /Latest/ })
      fireEvent.click(latest)
      expect(container.scrollTop).toBe(500)
      expect(queryByRole('button', { name: /Latest/ })).toBeNull()
    })
  })
})
