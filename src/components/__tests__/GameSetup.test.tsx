// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('switches to multiplayer form and calls onJoin', () => {
    const onJoin = vi.fn()
    render(<GameSetup onStartLocal={() => {}} onCreate={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Multiplayer (LAN)'))
    fireEvent.click(screen.getByText('Masuk Kamar'))
    fireEvent.change(screen.getByPlaceholderText('Nama'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByPlaceholderText('Kode'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Lanjut'))

    expect(onJoin).toHaveBeenCalledWith('Alice', 'ABC')
  })

  it('starts a local game with filled names', () => {
    const onStartLocal = vi.fn()
    render(<GameSetup onStartLocal={onStartLocal} onCreate={() => {}} onJoin={() => {}} />)

    fireEvent.change(screen.getAllByPlaceholderText(/Pemain/)[0], { target: { value: 'A' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Pemain/)[1], { target: { value: 'B' } })
    fireEvent.click(screen.getByText('Mulai Permainan'))

    expect(onStartLocal).toHaveBeenCalledWith(2, ['A', 'B'])
  })
})
