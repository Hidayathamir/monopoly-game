# Event Log Scroll Stick-to-Bottom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the in-progress game's event log from force-scrolling to the bottom when new events arrive while the user is reading older entries.

**Architecture:** `EventLog` (a controlled, presentational component fed the `state.eventLog` array) currently scrolls to bottom unconditionally in a `useEffect([log, expanded])`. We add a "stick to bottom" ref updated by an `onScroll` handler: the effect only auto-scrolls on `log` change when the user is already at/near the bottom. A `expanded` effect preserves the existing always-scroll-to-bottom toggle behavior, and a small "Latest" chip (visible only when scrolled away from the bottom) lets the user jump back.

**Tech Stack:** React 19, TypeScript (erasableSyntaxOnly, verbatimModuleSyntax), Tailwind v4, Vitest (jsdom), react-i18next.

## Global Constraints

- No TS `enum`; no raw string literals where a constant exists (`SoundId.Click`, not `'click'`). `verbatimModuleSyntax` → `import type` for type-only imports. `noUnusedLocals`/`noUnusedParameters` on.
- Match the no-semicolon style of `src/components/EventLog.tsx` (eslint does not enforce; match the file being edited).
- Every UI string must be routed through i18n keys present in **both** `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json` (flat keys, `keySeparator: false`).
- Tests use `renderWithProviders` from `src/test/test-utils.tsx`; the test setup pins language/currency to `en`/`USD`.
- Existing `data-testid`s (`event-log`, `event-entry`) must not change.

---

### Task 1: Stick-to-bottom scroll + "Latest" jump chip in `EventLog`

**Files:**
- Modify: `src/components/EventLog.tsx` (whole file, ~57 lines)
- Modify: `src/i18n/locales/en/translation.json:72` (after `eventlog.expand`)
- Modify: `src/i18n/locales/id/translation.json:72` (after `eventlog.expand`)
- Test: `src/components/__tests__/EventLog.test.tsx`

**Interfaces:**
- Consumes: `LogEntry` (`src/types/game.ts`), `resolveLogEntry`, `useCurrency().formatMoney`, `useSound()`, `SoundId.Click`, `t('eventlog.jumpToLatest')`.
- Produces: no external API changes; `EventLog` still takes `{ log: LogEntry[] }`. New i18n key `eventlog.jumpToLatest` (en `"Latest"`, id `"Terbaru"`).

- [ ] **Step 1: Add the i18n keys**

In `src/i18n/locales/en/translation.json`, after the `eventlog.expand` line add:

```json
  "eventlog.jumpToLatest": "Latest",
```

In `src/i18n/locales/id/translation.json`, after the `eventlog.expand` line add:

```json
  "eventlog.jumpToLatest": "Terbaru",
```

(Watch trailing commas — the new entry must be the last key in the `eventlog.*` group if followed by `}`.)

- [ ] **Step 2: Write the failing scroll-behavior tests**

Append this block inside the existing `describe('EventLog', ...)` in `src/components/__tests__/EventLog.test.tsx`:

```tsx
describe('scroll behavior', () => {
  const makeLog = (n: number): LogEntry[] =>
    Array.from({ length: n }, (_, i) => ({ key: 'event.turn', params: { name: 'P' + i } }))

  function mockScroll(el: HTMLElement, scrollHeight: number, clientHeight: number) {
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  }

  it('scrolls to the bottom when expanded', () => {
    const { getByTestId, getByRole } = renderWithProviders(<EventLog log={makeLog(10)} />)
    const container = getByTestId('event-log')
    mockScroll(container, 500, 100)
    fireEvent.click(getByRole('button', { name: /Full history/ }))
    expect(container.scrollTop).toBe(500)
  })

  it('keeps the viewport at the bottom when new events arrive while at the bottom', () => {
    const { getByTestId, getByRole, rerender } = renderWithProviders(<EventLog log={makeLog(10)} />)
    const container = getByTestId('event-log')
    mockScroll(container, 500, 100)
    fireEvent.click(getByRole('button', { name: /Full history/ }))
    container.scrollTop = 480
    fireEvent.scroll(container)
    mockScroll(container, 600, 100)
    rerender(<EventLog log={makeLog(20)} />)
    expect(container.scrollTop).toBe(600)
  })

  it('does not move the viewport when new events arrive while scrolled up', () => {
    const { getByTestId, getByRole, rerender } = renderWithProviders(<EventLog log={makeLog(10)} />)
    const container = getByTestId('event-log')
    mockScroll(container, 500, 100)
    fireEvent.click(getByRole('button', { name: /Full history/ }))
    container.scrollTop = 50
    fireEvent.scroll(container)
    rerender(<EventLog log={makeLog(20)} />)
    expect(container.scrollTop).toBe(50)
  })

  it('shows the Latest chip when scrolled up and jumps to the bottom on click', () => {
    const { getByTestId, getByRole, queryByRole } = renderWithProviders(<EventLog log={makeLog(10)} />)
    const container = getByTestId('event-log')
    mockScroll(container, 500, 100)
    fireEvent.click(getByRole('button', { name: /Full history/ }))
    expect(queryByRole('button', { name: /Latest/ })).toBeNull()
    container.scrollTop = 50
    fireEvent.scroll(container)
    const latest = getByRole('button', { name: /Latest/ })
    fireEvent.click(latest)
    expect(container.scrollTop).toBe(500)
    expect(queryByRole('button', { name: /Latest/ })).toBeNull()
  })
})
```

`LogEntry` is already imported at the top of the test file.

- [ ] **Step 3: Run the new tests to confirm they fail**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx`

Expected: the existing 3 tests pass; the 4 new tests FAIL (e.g. `scrollTop` is `0`/`480` instead of the expected value, and no `Latest` button is found). This is the red phase.

- [ ] **Step 4: Implement stick-to-bottom in `EventLog.tsx`**

Replace the entire file `src/components/EventLog.tsx` with (no semicolons, matching the file's style):

```tsx
import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LogEntry } from '../types/game'
import { useCurrency } from '../i18n/CurrencyContext'
import { resolveLogEntry } from '../i18n/log'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'

const SCROLL_BOTTOM_EPSILON = 16

interface Props {
  log: LogEntry[]
}

export default function EventLog({ log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const stickToBottomRef = useRef(true)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const play = useSound()

  useEffect(() => {
    if (ref.current && stickToBottomRef.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
    stickToBottomRef.current = true
    setAtBottom(true)
  }, [expanded])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_EPSILON
    stickToBottomRef.current = nearBottom
    setAtBottom(nearBottom)
  }

  const jumpToLatest = () => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
    stickToBottomRef.current = true
    setAtBottom(true)
    play(SoundId.Click)
  }

  const visible = expanded ? log : log.slice(-2)

  return (
    <div className="shrink w-full border-t border-border pt-2">
      <div className={expanded ? 'relative' : ''}>
        <div
          data-testid="event-log"
          ref={ref}
          onScroll={handleScroll}
          className={expanded ? 'max-h-32 overflow-y-auto' : ''}
        >
          {visible.map((entry, i) => (
            <div
              key={expanded ? i : log.length - visible.length + i}
              data-testid="event-entry"
              className="text-xs text-muted leading-snug py-0.5"
            >
              {resolveLogEntry(entry, t, formatMoney)}
            </div>
          ))}
          {log.length === 0 && <div className="text-xs text-muted">{t('eventlog.empty')}</div>}
        </div>
        {expanded && !atBottom && log.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-1 right-2 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-gold hover:opacity-80"
          >
            {t('eventlog.jumpToLatest')}
          </button>
        )}
      </div>
      {log.length > 2 && (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
            play(SoundId.Click)
          }}
          className="text-xs text-gold mt-1 hover:opacity-80"
        >
          {expanded ? t('eventlog.collapse') : t('eventlog.expand')}
        </button>
      )}
    </div>
  )
}
```

Key points:
- The `expanded` effect preserves the old "always scroll to bottom on toggle" behavior and re-arms the stick ref (collapsed mode has no scrollbar, so this only matters on expand).
- The `log` effect scrolls only when `stickToBottomRef.current` is true.
- The `Latest` chip is positioned absolutely inside the new `relative` wrapper that only exists when expanded, so it overlays the bottom-right of the scroll area.
- `bg-card` is a confirmed theme token (used in `GameSetup.tsx`, `Dice.tsx`); do not use `bg-background`.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx`

Expected: all 3 existing + 4 new tests PASS.

- [ ] **Step 6: Verify typecheck and lint**

Run: `npm run typecheck` and `npm run lint`

Expected: both exit 0 (no errors/warnings). Watch for `noUnusedLocals`/`noUnusedParameters` and unused-import complaints.

- [ ] **Step 7: Commit**

```bash
git add src/components/EventLog.tsx src/components/__tests__/EventLog.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "fix: event log stays put while reading history (stick-to-bottom + jump-to-latest)"
```

---

## Verification

Run `npm run typecheck && npm run lint && npm run test:unit`. Manual smoke (dev or built server): start a game with bots, expand the log, scroll up to an old entry — the viewport must stay put as new events arrive; clicking "Latest" returns to the bottom and the chip hides.
