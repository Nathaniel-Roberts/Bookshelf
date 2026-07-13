import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { useKeyboardScanner } from './useScanner'

function Harness({ onScan }: { onScan: (code: string) => void }) {
  useKeyboardScanner(onScan)
  return <input data-testid="field" />
}

function typeCode(target: Window | Element, code: string, pressEnter = true) {
  for (const ch of code) {
    fireEvent.keyDown(target, { key: ch })
  }
  if (pressEnter) {
    fireEvent.keyDown(target, { key: 'Enter' })
  }
}

describe('useKeyboardScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onScan for rapid input ending with Enter', () => {
    const onScan = vi.fn()
    render(<Harness onScan={onScan} />)
    typeCode(window, '9780261103283')
    expect(onScan).toHaveBeenCalledWith('9780261103283')
  })

  it('ignores short buffers', () => {
    const onScan = vi.fn()
    render(<Harness onScan={onScan} />)
    typeCode(window, 'abc')
    expect(onScan).not.toHaveBeenCalled()
  })

  it('resets the buffer when typing is slow', () => {
    const onScan = vi.fn()
    render(<Harness onScan={onScan} />)
    typeCode(window, '97802', false)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    typeCode(window, '61103')
    expect(onScan).toHaveBeenCalledWith('61103')
  })

  it('ignores keystrokes inside input fields', () => {
    const onScan = vi.fn()
    const { getByTestId } = render(<Harness onScan={onScan} />)
    typeCode(getByTestId('field'), '9780261103283')
    expect(onScan).not.toHaveBeenCalled()
  })
})
