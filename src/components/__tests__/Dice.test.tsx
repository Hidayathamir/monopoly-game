// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Dice from '../Dice'

describe('Dice', () => {
  it('renders the correct number of pips for a value', () => {
    const { getAllByTestId } = render(<Dice value={5} rolling={false} />)
    expect(getAllByTestId('dice-pip')).toHaveLength(5)
  })

  it('renders a placeholder when there is no value', () => {
    const { container } = render(<Dice value={null} rolling={false} />)
    expect(container.textContent).toContain('?')
  })
})
