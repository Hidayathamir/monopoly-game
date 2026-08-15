# English/USD Defaults & Compact Money Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game default to English + USD and display all money in compact notation (~3 digits) in both currencies.

**Architecture:** Two one-line default constants in `src/i18n/index.ts` and `src/data/currency.ts`, plus a two-option change to the single `formatMoney` function. All money consumers go through `useCurrency().formatMoney`, so no call-site changes are needed. Tests updated TDD-first.

**Tech Stack:** TypeScript, i18next, `Intl.NumberFormat`, Vitest, Playwright.

## Global Constraints

- `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `noUnusedLocals`/`noUnusedParameters` across all TS projects — type-only imports must use `import type`.
- `src/logic/*`, `src/data/*`, `src/types/*` files use semicolons; match the file being edited.
- Defaults only affect first-run/no-saved-preference behavior; saved `localStorage` (`monopoly-language`, `monopoly-currency`) always overrides.
- `formatMoney` output must remain locale-appropriate: `notation: 'compact'` with `maximumFractionDigits: 1`.
- Run `npm run typecheck`, `npm run lint`, and `npm run test:unit` after each code task.

---

### Task 1: Update currency unit tests (TDD — write failing tests)

**Files:**
- Modify: `src/data/__tests__/currency.test.ts`

**Interfaces:**
- Consumes: `formatMoney`, `CURRENCIES`, `DEFAULT_CURRENCY` from `../currency`
- Produces: Updated expectations that Task 2's implementation must satisfy.

- [ ] **Step 1: Update the test file to expect USD default and compact formatting**

Replace the entire contents of `src/data/__tests__/currency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '../currency';

describe('currency', () => {
  it('defaults to USD', () => {
    expect(DEFAULT_CURRENCY).toBe('USD');
  });

  it('defines USD and IDR', () => {
    expect(CURRENCIES.USD.multiplier).toBe(1);
    expect(CURRENCIES.IDR.multiplier).toBe(1_000_000);
  });

  it('formats USD with compact notation', () => {
    expect(formatMoney(1500, 'USD')).toContain('$1.5K');
    expect(formatMoney(2000, 'USD')).toContain('$2K');
    expect(formatMoney(60, 'USD')).toContain('$60');
  });

  it('formats IDR by applying the 1e6 multiplier in compact notation', () => {
    expect(formatMoney(1500, 'IDR')).toContain('1,5');
    expect(formatMoney(1500, 'IDR')).toContain('M');
  });

  it('treats undefined as zero', () => {
    expect(formatMoney(undefined, 'USD')).toContain('$0');
  });
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `npm run test:unit -- src/data/__tests__/currency.test.ts`
Expected: FAIL — `defaults to IDR` expectation no longer matches (current `DEFAULT_CURRENCY` is `'IDR'`), and compact strings (`$1.5K`) don't match current `$1,500` output.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/data/__tests__/currency.test.ts
git commit -m "test: update currency tests for USD default and compact formatting"
```

---

### Task 2: Implement USD default and compact `formatMoney`

**Files:**
- Modify: `src/data/currency.ts:15-26`

**Interfaces:**
- Consumes: `Currency` type defined in the same file
- Produces: `DEFAULT_CURRENCY: Currency = 'USD'`; `formatMoney(amount: number | undefined, currency?: Currency): string` using compact notation. Task 3 depends on `DEFAULT_CURRENCY`.

- [ ] **Step 1: Change the default currency**

In `src/data/currency.ts:15`:

```ts
export const DEFAULT_CURRENCY: Currency = 'USD'
```

- [ ] **Step 2: Add compact notation to `formatMoney`**

In `src/data/currency.ts:21-25`, add `notation: 'compact'` and change `maximumFractionDigits` to `1`:

```ts
  return new Intl.NumberFormat(def.locale, {
    style: 'currency',
    currency: def.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
```

- [ ] **Step 3: Run the unit tests to verify they pass**

Run: `npm run test:unit -- src/data/__tests__/currency.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (only the 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/data/currency.ts
git commit -m "feat: default to USD and format money with compact notation"
```

---

### Task 3: Default language to English

**Files:**
- Modify: `src/i18n/index.ts:7`

**Interfaces:**
- Consumes: nothing new
- Produces: `DEFAULT_LANGUAGE = 'en'`, used as `fallbackLng` and default when no saved language exists.

- [ ] **Step 1: Change the default language constant**

In `src/i18n/index.ts:7`:

```ts
export const DEFAULT_LANGUAGE = 'en'
```

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/index.ts
git commit -m "feat: default app language to English"
```

---

### Task 4: Update e2e default assertions (English/USD)

**Files:**
- Modify: `e2e/i18n.spec.ts`

**Interfaces:**
- Consumes: default language `en`, default currency `USD`, compact money display (1500 units → `$1.5K`, IDR `Rp 1,5 M`).
- Produces: e2e coverage that the app defaults to English/USD and toggles correctly.

- [ ] **Step 1: Rewrite the two tests to assert English/USD defaults**

Replace the entire contents of `e2e/i18n.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('defaults to English and toggles to Indonesian', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Start Game')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Language').selectOption('id')
  await expect(page.getByText('Mulai Permainan')).toBeVisible()
})

test('currency defaults to USD and toggles money symbol', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('player-count').selectOption('2')
  await page.locator('input[type="text"]').nth(0).fill('Alpha')
  await page.locator('input[type="text"]').nth(1).fill('Beta')
  await page.getByRole('button', { name: 'Start Game' }).click()
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Currency').selectOption('IDR')
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('Rp')
})
```

- [ ] **Step 2: Run the i18n e2e spec**

Run: `npm run build && npx playwright test e2e/i18n.spec.ts`
Expected: PASS (build first — `multiplayer.spec.ts` and this spec serve `dist/`).

- [ ] **Step 3: Run the full test suite**

Run: `npm run build && npm run test`
Expected: PASS — unit, and all e2e specs. `monopoly.spec.ts`/`multiplayer.spec.ts` pin `en`+`USD` via `addInitScript`, so `$`-containing assertions still hold with compact formatting.

- [ ] **Step 4: Commit**

```bash
git add e2e/i18n.spec.ts
git commit -m "test: e2e asserts English and USD defaults with compact money"
```
