// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { renderWithProviders } from '../../test/test-utils'
import LoadScenarioPanel from '../LoadScenarioPanel'

describe('LoadScenarioPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when seedEnabled is false', () => {
    const { container } = renderWithProviders(<LoadScenarioPanel seedEnabled={false} code="ABC12" />)
    expect(container.firstChild).toBeNull()
  })

  it('validates pasted JSON client-side', () => {
    renderWithProviders(<LoadScenarioPanel seedEnabled code="ABC12" />)
    fireEvent.change(screen.getByLabelText(/State JSON/i), { target: { value: '{not json' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }))
    expect(screen.getByText(/Invalid state/i)).toBeVisible()
  })

  it('posts the seed and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<LoadScenarioPanel seedEnabled code="ABC12" />)
    fireEvent.change(screen.getByLabelText(/State JSON/i), {
      target: { value: '{"phase":"waiting","players":[],"turnOrder":[],"currentPlayer":0,"board":[],"chanceDeck":[],"communityDeck":[],"freeParkingPot":0,"dice":null,"doublesCount":0,"lastMoveSteps":null,"eventLog":[],"pendingAction":null,"justBoughtSpaceId":null,"builtThisStop":false,"reconnectGrace":null,"pendingTrades":[],"nextTradeId":0,"tradesEnabled":false}' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }))
    expect(await screen.findByText(/State applied/i)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/seed', expect.objectContaining({ method: 'POST' }))
  })
})