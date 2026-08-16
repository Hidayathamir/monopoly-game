# ID Language / IDR Currency Feature Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a build-time feature flag `VITE_ID_IDR_ENABLED` (default off) that hides the Indonesian-language and IDR-currency options entirely and clamps any saved `id`/`IDR` preference back to `en`/`USD`.

**Architecture:** A new `src/config/features.ts` module reads `import.meta.env.VITE_ID_IDR_ENABLED === 'true'` and exports `ID_IDR_ENABLED`. When false: `LanguageCurrencyBar` returns `null` (hidden), `src/i18n/index.ts` forces the initial language to `en`, and `src/i18n/CurrencyContext.tsx` forces the currency to `USD`. Both `id`/`IDR` definitions stay in the codebase, so enabling is a rebuild with the env var set. Unit tests mock the `features` module (`vi.mock`) to exercise both paths deterministically; the ID/IDR e2e spec skips under the default build.

**Tech Stack:** React 19 + TypeScript + Vite (env vars, `vite/client` types already configured), Vitest (jsdom), react-i18next, Playwright.

## Global Constraints

- `VITE_ID_IDR_ENABLED`: the literal string `'true'` enables ID language + IDR currency; unset/anything else disables. Default disabled.
- No TS enums; `verbatimModuleSyntax` → type-only imports via `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- Components/hooks omit semicolons; `src/types/*`, `src/data/*` use them. Match the file you edit.
- i18n keys stay flat (`keySeparator: false`) and must exist in both locale files.
- `react-refresh/only-export-components` is enforced — a new non-component export from a component file needs `// eslint-disable-next-line react-refresh/only-export-components`.
- `vi.mock` factory must return the exact export shape of the mocked module (`{ ID_IDR_ENABLED: boolean }`).
- Each task leaves `npm run typecheck` and `npm run test:unit` green.

---

## File Structure

- Create `src/config/features.ts` — `ID_IDR_ENABLED` from `import.meta.env`.
- Modify `src/components/LanguageCurrencyBar.tsx` — returns `null` when disabled.
- Modify `src/i18n/index.ts` — `resolveInitialLanguage()` forces `en` when disabled.
- Modify `src/i18n/CurrencyContext.tsx` — `readSavedCurrency(enabled)` forces `USD`; `setCurrency` clamps.
- Modify `src/components/__tests__/LanguageCurrencyBar.test.tsx` — mock flag `true`.
- Create `src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx` — mock flag `false`.
- Create `src/i18n/__tests__/id-idr-feature-flag.test.ts` — clamp tests with flag `false`.
- Modify `e2e/i18n.spec.ts` — skip the two ID/IDR tests under the default build.
- Modify `AGENTS.md` — document the env var.

---

### Task 1: features module + hide the language/currency bar

**Files:**
- Create: `src/config/features.ts`
- Modify: `src/components/LanguageCurrencyBar.tsx:6-31`
- Test: `src/components/__tests__/LanguageCurrencyBar.test.tsx`
- Test: create `src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx`

**Interfaces:**
- Consumes: nothing (Task 1 is the foundation).
- Produces:
  - `ID_IDR_ENABLED: boolean` exported from `src/config/features.ts`.
  - `LanguageCurrencyBar` renders `null` when `!ID_IDR_ENABLED` (after all hooks).

- [ ] **Step 1: Write the failing tests**

Edit `src/components/__tests__/LanguageCurrencyBar.test.tsx` — add a `vi.mock` for the flag ON right after the imports (lines 1-9), so the six existing tests exercise the enabled path unchanged:

```tsx
vi.mock('../../config/features', () => ({ ID_IDR_ENABLED: true }))
```

Create `src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'

vi.mock('../../config/features', () => ({ ID_IDR_ENABLED: false }))

afterEach(cleanup)

describe('LanguageCurrencyBar disabled', () => {
  it('renders nothing when the ID/IDR feature is disabled', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/LanguageCurrencyBar.test.tsx src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx`
Expected: FAIL — `src/config/features` cannot be resolved (module does not exist yet), so the mocks and the component fail.

- [ ] **Step 3: Create the features module**

Create `src/config/features.ts`:

```ts
export const ID_IDR_ENABLED = import.meta.env.VITE_ID_IDR_ENABLED === 'true'
```

- [ ] **Step 4: Hide the bar when disabled**

Edit `src/components/LanguageCurrencyBar.tsx`:

1. Add the import at the top (line 4 area):

```tsx
import { ID_IDR_ENABLED } from '../config/features'
```

2. After the `useEffect` block (after line 29) and **before** the `return (` at line 31, add the guard (keeps all hooks above it, preserving hook order):

```tsx
  if (!ID_IDR_ENABLED) return null
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npx vitest run src/components/__tests__/LanguageCurrencyBar.test.tsx src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx`
Expected: PASS — the six enabled tests still pass and the disabled test sees no bar.

- [ ] **Step 6: Commit**

```bash
git add src/config/features.ts src/components/LanguageCurrencyBar.tsx src/components/__tests__/LanguageCurrencyBar.test.tsx src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx
git commit -m "feat: gate the language/currency bar behind VITE_ID_IDR_ENABLED"
```

---

### Task 2: Clamp saved language and currency when the flag is off

**Files:**
- Modify: `src/i18n/index.ts:1-7,12-19`
- Modify: `src/i18n/CurrencyContext.tsx:1-39`
- Test: create `src/i18n/__tests__/id-idr-feature-flag.test.ts`

**Interfaces:**
- Consumes: `ID_IDR_ENABLED` from Task 1.
- Produces:
  - `resolveInitialLanguage(enabled = ID_IDR_ENABLED): string` exported from `src/i18n/index.ts`; `i18n.init` uses it for `lng`.
  - `readSavedCurrency(enabled = ID_IDR_ENABLED): Currency` exported from `src/i18n/CurrencyContext.tsx`; returns `DEFAULT_CURRENCY` when disabled.
  - `setCurrency` stores `USD` when disabled.

- [ ] **Step 1: Write the failing tests**

Create `src/i18n/__tests__/id-idr-feature-flag.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveInitialLanguage } from '../index'
import { readSavedCurrency } from '../CurrencyContext'

vi.mock('../../config/features', () => ({ ID_IDR_ENABLED: false }))

describe('ID/IDR feature flag disabled clamps', () => {
  beforeEach(() => {
    localStorage.setItem('monopoly-language', 'id')
    localStorage.setItem('monopoly-currency', 'IDR')
  })

  it('forces English regardless of a saved Indonesian preference', () => {
    expect(resolveInitialLanguage()).toBe('en')
  })

  it('forces USD regardless of a saved IDR preference', () => {
    expect(readSavedCurrency()).toBe('USD')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/i18n/__tests__/id-idr-feature-flag.test.ts`
Expected: FAIL — `resolveInitialLanguage` is not exported, and `readSavedCurrency('IDR')` returns `'IDR'` instead of `'USD'`.

- [ ] **Step 3: Implement the language clamp**

Edit `src/i18n/index.ts`:

1. Add the import (line 2 area):

```ts
import { ID_IDR_ENABLED } from '../config/features'
```

2. Add the resolver after `readSavedLanguage`:

```ts
export function resolveInitialLanguage(enabled = ID_IDR_ENABLED): string {
  return enabled ? readSavedLanguage() : DEFAULT_LANGUAGE
}
```

3. Change the `init` call (currently `lng: readSavedLanguage(),`) to:

```ts
  lng: resolveInitialLanguage(),
```

- [ ] **Step 4: Implement the currency clamp**

Edit `src/i18n/CurrencyContext.tsx`:

1. Add the import (line 2 area):

```ts
import { ID_IDR_ENABLED } from '../config/features'
```

2. Change `readSavedCurrency` to accept the flag, return `USD` when disabled, and export it:

```ts
// eslint-disable-next-line react-refresh/only-export-components
export function readSavedCurrency(enabled = ID_IDR_ENABLED): Currency {
  if (!enabled) return DEFAULT_CURRENCY
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'IDR' || saved === 'USD' ? saved : DEFAULT_CURRENCY
  } catch {
    return DEFAULT_CURRENCY
  }
}
```

3. Clamp `setCurrency`:

```ts
  const setCurrency = (c: Currency) => {
    const next = ID_IDR_ENABLED ? c : DEFAULT_CURRENCY
    setCurrencyState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — the clamp tests pass and every existing test still passes (setup pins `en`/`USD`, which is unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/index.ts src/i18n/CurrencyContext.tsx src/i18n/__tests__/id-idr-feature-flag.test.ts
git commit -m "feat: clamp language and currency to en/USD when the ID/IDR flag is off"
```

---

### Task 3: e2e skip + AGENTS.md docs

**Files:**
- Modify: `e2e/i18n.spec.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the `VITE_ID_IDR_ENABLED` env var concept from Task 1.
- Produces: an operator-facing documented build flag and e2e specs that skip under the default build.

- [ ] **Step 1: Guard the ID/IDR e2e tests**

Edit `e2e/i18n.spec.ts` — after the imports (line 1), add:

```ts
const idIdrEnabled = process.env.VITE_ID_IDR_ENABLED === 'true'
```

Add as the first line of each test body (the `'defaults to English and toggles to Indonesian'` test at line 3 and the `'currency defaults to USD and toggles money symbol'` test at line 12):

```ts
  test.skip(!idIdrEnabled, 'ID/IDR feature disabled by default')
```

- [ ] **Step 2: Document the flag**

Edit `AGENTS.md`, in the `## Commands` section directly under the `TRADES_ENABLED=true npm run server` bullet, add:

```markdown
- `VITE_ID_IDR_ENABLED=true npm run dev`/`npm run build` — enables the Indonesian language and IDR currency options (env `VITE_ID_IDR_ENABLED`, default disabled; anything other than the literal `true` leaves only English/USD available)
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS (unchanged — e2e and docs only).

- [ ] **Step 4: Commit**

```bash
git add e2e/i18n.spec.ts AGENTS.md
git commit -m "docs: document VITE_ID_IDR_ENABLED and skip ID/IDR e2e under the default build"
```

---

## Self-Review

**Spec coverage:**
- `src/config/features.ts` reads `import.meta.env.VITE_ID_IDR_ENABLED === 'true'`, default off → Task 1 ✓
- `LanguageCurrencyBar` returns `null` when disabled → Task 1 ✓
- i18n forces `en` via `resolveInitialLanguage` → Task 2 ✓
- Currency forces `USD` via `readSavedCurrency(enabled)` + `setCurrency` clamp → Task 2 ✓
- Unit tests mock `features` to exercise both paths → Task 1 (enabled bar tests + disabled hidden test), Task 2 (clamp tests) ✓
- e2e `i18n.spec.ts` skips the two ID/IDR tests when `process.env.VITE_ID_IDR_ENABLED !== 'true'` → Task 3 ✓
- AGENTS.md documents the env var → Task 3 ✓

**Placeholder scan:** Every step has concrete code or an exact edit target; no TBDs.

**Type consistency:** `ID_IDR_ENABLED: boolean` is produced by `features.ts` (Task 1) and consumed by `LanguageCurrencyBar`, `i18n/index.ts`, and `CurrencyContext.tsx` (Tasks 1-2). `resolveInitialLanguage(enabled = ID_IDR_ENABLED): string` (Task 2) is used in `i18n.init` and tested directly. `readSavedCurrency(enabled = ID_IDR_ENABLED): Currency` (Task 2) is used by `CurrencyProvider`'s `useState` initializer and tested directly. The `vi.mock` factories in all three test files return `{ ID_IDR_ENABLED: <bool> }`, matching the real module's single export.
