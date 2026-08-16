// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Speedometer, { valueToAngle } from '../Speedometer'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('valueToAngle', () => {
  it('maps the scale linearly across the 150° arc', () => {
    expect(valueToAngle(2)).toBe(165) // left end
    expect(valueToAngle(7)).toBe(90) // top apex
    expect(valueToAngle(12)).toBe(15) // right end
    expect(valueToAngle(2 + 10 * 0.5)).toBe(90)
  })
})

describe('Speedometer', () => {
  it('renders the gauge with the three landmark labels', () => {
    renderWithProviders(<Speedometer value={7} label="Dice gauge" />)
    expect(screen.getByTestId('speedometer')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('applies the passed label as the aria-label', () => {
    renderWithProviders(<Speedometer value={7} label="Pengukur dadu" />)
    expect(screen.getByTestId('speedometer').getAttribute('aria-label')).toBe('Pengukur dadu')
  })

  it('renders 11 tick marks (one per value 2..12)', () => {
    renderWithProviders(<Speedometer value={7} label="Dice gauge" />)
    expect(screen.getAllByTestId('speedometer-tick')).toHaveLength(11)
  })

  it('points the needle at the value angle', () => {
    const { rerender } = renderWithProviders(<Speedometer value={2} label="Dice gauge" />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(165 70 70)')

    rerender(<Speedometer value={7} label="Dice gauge" />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(90 70 70)')

    rerender(<Speedometer value={12} label="Dice gauge" />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(15 70 70)')
  })
})
