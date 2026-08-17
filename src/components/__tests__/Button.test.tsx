// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Button from '../Button'
import { SoundProvider } from '../../audio/SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function renderButton(children: ReactNode, props: ComponentProps<typeof Button> = {}) {
  return render(<SoundProvider><Button {...props}>{children}</Button></SoundProvider>)
}

beforeEach(() => {
  playSoundMock.mockClear()
  cleanup()
})

describe('Button sound', () => {
  it('plays a click by default', () => {
    renderButton('Go')
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })

  it('plays a custom sound when provided', () => {
    renderButton('Go', { sound: 'buy' })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).toHaveBeenCalledWith('buy')
  })

  it('is silent when sound is null', () => {
    renderButton('Go', { sound: null })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('still fires onClick', () => {
    const onClick = vi.fn()
    renderButton('Go', { onClick })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
