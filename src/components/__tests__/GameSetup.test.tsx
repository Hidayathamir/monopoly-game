// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'
import { useRoomList } from '../../hooks/useRoomList'
import { renderWithProviders } from '../../test/test-utils'
import type { RoomInfo } from '../../types/net'

vi.mock('../../hooks/useRoomList')
const mockUseRoomList = vi.mocked(useRoomList)

afterEach(cleanup)
beforeEach(() => {
  mockUseRoomList.mockReturnValue({ rooms: [], error: false })
})

describe('GameSetup', () => {
  it('creates a room with the entered name', () => {
    const onCreate = vi.fn()
    renderWithProviders(<GameSetup onCreate={onCreate} onJoin={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onCreate).toHaveBeenCalledWith('Alice')
  })

  it('joins a room and calls onJoin', () => {
    const onJoin = vi.fn()
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Join Room'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByPlaceholderText('Code'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onJoin).toHaveBeenCalledWith('Alice', 'ABC')
  })

  it('renders the room list with host, player count, and status', () => {
    const rooms: RoomInfo[] = [
      { code: 'ABCDE', hostName: 'Alice', playerCount: 2, phase: 'setup' },
      { code: 'FGHIJ', hostName: 'Bob', playerCount: 4, phase: 'waiting' },
    ]
    mockUseRoomList.mockReturnValue({ rooms, error: false })
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={() => {}} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('2/6')).toBeInTheDocument()
    expect(screen.getByText('4/6')).toBeInTheDocument()
    expect(screen.getByText('Lobby')).toBeInTheDocument()
    expect(screen.getByText('In game')).toBeInTheDocument()
  })

  it('joins a room by clicking a row', () => {
    const onJoin = vi.fn()
    mockUseRoomList.mockReturnValue({
      rooms: [{ code: 'ABCDE', hostName: 'Alice', playerCount: 1, phase: 'setup' }],
      error: false,
    })
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={onJoin} />)
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Charlie' } })
    fireEvent.click(screen.getByTestId('room-row'))
    expect(onJoin).toHaveBeenCalledWith('Charlie', 'ABCDE')
  })

  it('hides the room list when the server is unreachable', () => {
    mockUseRoomList.mockReturnValue({ rooms: [], error: true })
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={() => {}} />)
    expect(screen.queryByText('Open Rooms')).not.toBeInTheDocument()
  })
})
