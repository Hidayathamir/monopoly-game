// @vitest-environment jsdom
import { render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import EventLog from '../EventLog'

afterEach(cleanup)

describe('EventLog', () => {
  it('shows only the last two entries when collapsed', () => {
    const { getAllByTestId } = render(<EventLog log={['a', 'b', 'c']} />)
    expect(getAllByTestId('event-entry')).toHaveLength(2)
  })

  it('shows all entries when expanded', () => {
    const { getByRole, getAllByTestId } = render(<EventLog log={['a', 'b', 'c']} />)
    fireEvent.click(getByRole('button', { name: /Riwayat penuh/ }))
    expect(getAllByTestId('event-entry')).toHaveLength(3)
  })
})
