// @vitest-environment jsdom
import { fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import EventLog from '../EventLog'
import { renderWithProviders } from '../../test/test-utils'

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
})
