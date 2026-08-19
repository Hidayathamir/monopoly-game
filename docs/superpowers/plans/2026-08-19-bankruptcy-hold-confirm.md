# Bankruptcy Hold-to-Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the player to press-and-hold either "Declare Bankruptcy" button for 5 full seconds (with a visible progress animation + countdown) before the bankruptcy action fires; releasing early cancels.

**Architecture:** A new reusable `HoldToConfirmButton` component (composes the existing `Button`) implements the hold gesture, progress fill, and countdown entirely client-side. It replaces the two `danger` bankruptcy buttons — in `BankruptcyModal` and in `ActionSection` — wiring `onConfirm` to the existing `onBankruptcy` / `onDeclareBankruptcy` callbacks. No reducer, type, wire, or server changes.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest (jsdom + fake timers), react-i18next.

## Global Constraints

- No TS `enum` anywhere (`erasableSyntaxOnly`); use `const` objects + derived union types. `verbatimModuleSyntax` is on — type-only imports must use `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolons: `src/logic/*` and `src/data/*` use them; `src/components/*` omit them. Match the file being edited (both tasks edit `src/components/*` — omit semicolons).
- i18n: every UI string must exist in BOTH `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`). Never add a hardcoded user-facing string.
- `src/types/*`, `src/logic/*`, `server/*`, `src/net/*` are UNTOUCHED by this feature. Do not modify them.
- `npm run typecheck` = `tsc -b` (all three TS projects). `npm run lint` must stay clean. `npm run test:unit` = vitest.
- Components use `renderWithProviders` from `src/test/test-utils.tsx` in tests (i18n + currency context required).
- The hold guard is client-side UX only: the existing `onBankruptcy`/`onDeclareBankruptcy` callbacks and their network behavior stay identical.

---

### Task 1: `HoldToConfirmButton` component + unit tests + `hold.countdown` i18n key

**Files:**
- Create: `src/components/HoldToConfirmButton.tsx`
- Test: `src/components/__tests__/HoldToConfirmButton.test.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Produces:
  ```ts
  interface HoldToConfirmButtonProps {
    onConfirm: () => void
    holdMs?: number       // default 5000
    hint?: string         // helper line rendered under the button
    children: ReactNode   // idle label
    variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    disabled?: boolean
  }
  export default function HoldToConfirmButton(props: HoldToConfirmButtonProps): JSX.Element
  ```
- The button's accessible name while idle is exactly `children`. While holding it becomes `hold.countdown` rendered with `{ n }` = remaining whole seconds (5 → 1).
- The fill overlay is a `<span data-testid="hold-fill">`; the hint is a `<p data-testid="hold-hint">`.

- [ ] **Step 1: Add the `hold.countdown` i18n key to both locales**

In `src/i18n/locales/en/translation.json`, add the flat key `hold.countdown` with value `"Hold {n}s"`. In `src/i18n/locales/id/translation.json`, add the flat key `hold.countdown` with value `"Tahan {n}d"`. Insert both right before the `"seed.title"` key (the files are flat-key JSON objects; position does not affect behavior, but keep en and id parallel). Do not add any other keys in this task.

- [ ] **Step 2: Write the failing component test**

Create `src/components/__tests__/HoldToConfirmButton.test.tsx` (no semicolons, matching sibling component tests):

```tsx
// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoldToConfirmButton from '../HoldToConfirmButton'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderButton(overrides: Partial<ComponentProps<typeof HoldToConfirmButton>> = {}) {
    const props = { onConfirm: () => {}, children: 'Declare Bankruptcy', ...overrides }
    return renderWithProviders(<HoldToConfirmButton {...props} />)
  }

  it('renders the idle label and the hint', () => {
    renderButton({ hint: 'Press and hold for 5 seconds' })
    expect(screen.getByRole('button', { name: 'Declare Bankruptcy' })).toBeVisible()
    expect(screen.getByTestId('hold-hint')).toHaveTextContent('Press and hold for 5 seconds')
  })

  it('fires onConfirm once after holding for the full duration', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not fire on a quick tap', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.pointerUp(button)
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets after an early release and still fires on the next full hold', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(2500))
    fireEvent.pointerUp(button)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Declare Bankruptcy' })).toBeVisible()
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the countdown label while holding', () => {
    renderButton()
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('button', { name: /^Hold/ })).toBeVisible()
  })

  it('ignores non-primary pointer buttons', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 2 })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('supports keyboard hold with Space', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.keyUp(button, { key: ' ' })
  })

  it('does not fire on a quick keyboard press', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyUp(button, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not fire while disabled', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm, disabled: true })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

Note: `vi.useFakeTimers()` mocks `Date` as well as `setInterval` by default, so `Date.now()`-based elapsed-time ticks advance with `vi.advanceTimersByTime`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/HoldToConfirmButton.test.tsx`
Expected: FAIL — module `../HoldToConfirmButton` cannot be resolved.

- [ ] **Step 4: Implement `src/components/HoldToConfirmButton.tsx`**

Create `src/components/HoldToConfirmButton.tsx` (no semicolons, like `Button.tsx`):

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'

interface Props {
  onConfirm: () => void
  holdMs?: number
  hint?: string
  children: ReactNode
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
}

const TICK_MS = 50

export default function HoldToConfirmButton({
  onConfirm,
  holdMs = 5000,
  hint,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
}: Props) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const startRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const reset = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startRef.current = 0
    firedRef.current = false
    setHolding(false)
    setProgress(0)
  }, [])

  const begin = useCallback(() => {
    if (disabled || firedRef.current || intervalRef.current !== null) return
    startRef.current = Date.now()
    firedRef.current = false
    setHolding(true)
    setProgress(0)
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const next = Math.min(1, elapsed / holdMs)
      setProgress(next)
      if (next >= 1) {
        if (intervalRef.current !== null) clearInterval(intervalRef.current)
        intervalRef.current = null
        firedRef.current = true
        setHolding(false)
        setProgress(0)
        onConfirm()
      }
    }, TICK_MS)
  }, [disabled, holdMs, onConfirm])

  useEffect(() => reset, [reset])

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    begin()
  }

  function handlePointerUp() {
    reset()
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (e.repeat) return
    e.preventDefault()
    begin()
  }

  function handleKeyUp(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    reset()
  }

  const remaining = Math.max(0, Math.ceil((holdMs * (1 - progress)) / 1000))

  return (
    <div className="flex-1 flex flex-col">
      <Button
        variant={variant}
        size={size}
        className={[className, 'relative overflow-hidden select-none touch-none'].join(' ')}
        sound={null}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
        onBlur={reset}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <span
          data-testid="hold-fill"
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-white/30"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative z-10">{holding ? t('hold.countdown', { n: remaining }) : children}</span>
      </Button>
      {hint && (
        <p data-testid="hold-hint" className="text-sm text-muted text-center mt-1">
          {hint}
        </p>
      )}
    </div>
  )
}
```

Notes:
- `Button` forwards `onPointerDown`/`onPointerUp`/`onPointerCancel`/`onKeyDown`/`onKeyUp`/`onBlur` through its `...props` spread, so the handlers attach to the native button. `sound={null}` silences the default click sound (a cancelled hold must not emit a click).
- `touch-none` sets `touch-action: none` (the hold gesture must not scroll on touch); `select-none` avoids text selection during a press-and-hold.
- `firedRef` guarantees `onConfirm` fires exactly once even if the final tick races the release.
- `useEffect(() => reset, [reset])` cleans up the interval on unmount.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/HoldToConfirmButton.test.tsx`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS across all three tsconfig projects.

- [ ] **Step 7: Commit**

```bash
git add src/components/HoldToConfirmButton.tsx src/components/__tests__/HoldToConfirmButton.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: add HoldToConfirmButton with 5-second hold guard"
```

---

### Task 2: Wire the hold button into `BankruptcyModal` and `ActionSection` + hint i18n keys

**Files:**
- Modify: `src/components/Modals/BankruptcyModal.tsx`
- Modify: `src/components/ActionSection.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Verify: `src/components/__tests__/BankruptcyModal.test.tsx`, `src/components/__tests__/ActionSection.test.tsx` (no changes expected — they must keep passing)

**Interfaces:**
- Consumes: `HoldToConfirmButton` from `../HoldToConfirmButton` (Task 1). Props: `{ onConfirm, hint, variant, children }`. The `onConfirm` callback is the existing `onBankruptcy` / `onDeclareBankruptcy` prop — unchanged network/behavior path.

- [ ] **Step 1: Add the hint i18n keys to both locales**

In `src/i18n/locales/en/translation.json`:
- add `"bankruptcy.holdHint"` = `"Press and hold for 5 seconds to declare bankruptcy."` (right after `"bankruptcy.close"`),
- add `"action.holdHint"` = `"Press and hold for 5 seconds to declare bankruptcy."` (right after `"action.declareBankruptcy"`).

In `src/i18n/locales/id/translation.json`:
- add `"bankruptcy.holdHint"` = `"Tahan tombol selama 5 detik untuk menyatakan bangkrut."` (after `"bankruptcy.close"`),
- add `"action.holdHint"` = `"Tahan tombol selama 5 detik untuk menyatakan bangkrut."` (after `"action.declareBankruptcy"`).

- [ ] **Step 2: Update `src/components/Modals/BankruptcyModal.tsx`**

1. Add the import after the existing `import Button from '../Button'` line:

```tsx
import HoldToConfirmButton from '../HoldToConfirmButton'
```

2. Replace the declare button block (currently lines 46–48):

```tsx
{!canPayAfterLiquidation && (
  <Button variant="danger" onClick={onBankruptcy}>{t('bankruptcy.declare')}</Button>
)}
```

with:

```tsx
{!canPayAfterLiquidation && (
  <HoldToConfirmButton variant="danger" onConfirm={onBankruptcy} hint={t('bankruptcy.holdHint')}>
    {t('bankruptcy.declare')}
  </HoldToConfirmButton>
)}
```

`Button` is still imported for the Close button — do not remove that import. All other logic (`canPayAfterLiquidation`, the `isMyTurn` branch) is unchanged.

- [ ] **Step 3: Update `src/components/ActionSection.tsx`**

1. Add the import after the existing `import Button from './Button'` line:

```tsx
import HoldToConfirmButton from './HoldToConfirmButton'
```

2. Replace the bankruptcy button (currently line 66) inside the `PayRent | Bankruptcy` branch:

```tsx
<Button variant="danger" onClick={onDeclareBankruptcy}>{t('action.declareBankruptcy')}</Button>
```

with:

```tsx
<HoldToConfirmButton variant="danger" onConfirm={onDeclareBankruptcy} hint={t('action.holdHint')}>
  {t('action.declareBankruptcy')}
</HoldToConfirmButton>
```

No other changes in this file; the button stays rendered exactly when it was before (inside the `pending PayRent | Bankruptcy` branch, alongside the disabled Pay Rent button).

- [ ] **Step 4: Run the affected component tests**

Run: `npx vitest run src/components/__tests__/HoldToConfirmButton.test.tsx src/components/__tests__/BankruptcyModal.test.tsx src/components/__tests__/ActionSection.test.tsx`
Expected: PASS — the modal still shows a button named "Declare Bankruptcy" (idle label) and the Close button; the ActionSection behavior tests are unaffected.

- [ ] **Step 5: Typecheck + lint + full unit suite**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (no new warnings).

Run: `npm run test:unit`
Expected: PASS (full suite).

- [ ] **Step 6: Commit**

```bash
git add src/components/Modals/BankruptcyModal.tsx src/components/ActionSection.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: require 5-second hold on declare-bankruptcy buttons"
```
