import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Bomb(): never {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(getByText('all good')).toBeTruthy()
  })

  it('shows the fallback with the error message when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getByText } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(getByText('Something went wrong')).toBeTruthy()
    expect(getByText('kaboom')).toBeTruthy()
    expect(getByText('Reload')).toBeTruthy()
    spy.mockRestore()
  })
})
