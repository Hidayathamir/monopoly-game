// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SoundProvider, useSound } from '../SoundContext'
import { SoundId } from '../soundEngine'

const { playSoundMock, unlockMock } = vi.hoisted(() => ({ playSoundMock: vi.fn(), unlockMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock, unlockAudio: unlockMock }
})

function Consumer() {
  const play = useSound()
  return <button onClick={() => play(SoundId.RoomJoin)}>beep</button>
}

beforeEach(() => {
  playSoundMock.mockClear()
  unlockMock.mockClear()
  unlockMock.mockReturnValue(true)
  cleanup()
})

describe('SoundProvider', () => {
  it('plays a sound through useSound', () => {
    render(<SoundProvider><Consumer /></SoundProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'beep' }))
    expect(playSoundMock).toHaveBeenCalledWith('roomJoin')
  })

  it('unlocks audio on the first pointerdown only', () => {
    render(<SoundProvider><div /></SoundProvider>)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
  })

  it('unlocks audio on the first keydown only', () => {
    render(<SoundProvider><div /></SoundProvider>)
    fireEvent.keyDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
  })

  it('keeps listening until audio is actually running', () => {
    unlockMock.mockReturnValueOnce(false)
    render(<SoundProvider><div /></SoundProvider>)
    fireEvent.pointerDown(document.body)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(2)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(2)
  })
})
