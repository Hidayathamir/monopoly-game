// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect } from 'vitest'
import Avatar from '../Avatar'
import { renderWithProviders } from '../../test/test-utils'
import { AvatarKind } from '../../types/game'
import { PRESET_AVATARS } from '../../data/avatars'

afterEach(cleanup)

describe('Avatar', () => {
  it('renders the preset emoji', () => {
    renderWithProviders(<Avatar avatar={{ kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat }} />)
    expect(screen.getByText('🐱')).toBeTruthy()
  })

  it('renders a custom image from its data URL', () => {
    const dataUrl = 'data:image/png;base64,abc'
    renderWithProviders(<Avatar avatar={{ kind: AvatarKind.Custom, dataUrl }} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe(dataUrl)
  })
})
