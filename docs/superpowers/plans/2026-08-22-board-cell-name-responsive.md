# Responsive Board Cell Name Typography (Rotation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 40 board city names never clip and scale fluidly with the screen, with phone portrait as the priority.

**Architecture:** Rotate all cell names to vertical (`writing-mode: vertical-rl`) in portrait orientation, where cells are tall-and-narrow, so the 75px cell height is used instead of the 34px width; keep names horizontal one-line in landscape/desktop. A fluid font clamp bounds the size by the binding constraint per orientation. A new Playwright spec seeds a waiting game and asserts every cell-name is rotated in portrait / horizontal in landscape and never overflows its cell. No data, i18n, or wire-contract changes.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (arbitrary-value utilities) + plain CSS media query in `index.css`, Vitest, Playwright (worker-scoped `serverUrl` fixture). Must run `npm run build` before server-backed e2e.

## Global Constraints

- No TS enums; `verbatimModuleSyntax: true` → `import type` for type-only imports. `noUnusedLocals`/`noUnusedParameters` on.
- Enum-like string constants via `const` objects + derived unions (not relevant here — no new types).
- i18n: every UI string in both `en`/`id` locales (no new strings here — names come from existing `t('board.space.' + id)`).
- Board is 11×11 grid filling the viewport; cells = `(viewport − 16px)/11`. Keep this layout; do NOT restructure it.
- Semicolons: `BoardGrid.tsx` omits them; match the file.
- Playwright server-backed specs require `dist/` → run `npm run build` first.
- Work on branch `feat/board-cell-name-responsive` (already created); commit after each task.

---

### Task 1: Rotate cell names in portrait, keep horizontal one-line otherwise

**Files:**
- Modify: `src/components/BoardGrid.tsx:184-211` (`.cell-name` button + houses/hotel buttons)
- Modify: `src/index.css` (base `.cell-houses` rule + `@media (orientation: portrait)` block)

**Interfaces:**
- Consumes: nothing new — existing `t('board.space.' + space.id)` and the `cell-name` class (used by Chance/Community color overrides via `[&_.cell-name]`).
- Produces: `.cell-name` buttons that render `writing-mode: vertical-rl` in portrait and horizontal one-line in landscape/desktop, with fluid font sizes; a `cell-houses` class on the houses/hotel buttons so portrait CSS can target them without hitting the mortgage `M` badge. No new props or types.

- [ ] **Step 1: Edit the `.cell-name` button className**

In `src/components/BoardGrid.tsx`, the name button (around line 184):

```tsx
<button
  type="button"
  tabIndex={-1}
  onClick={(e) => e.preventDefault()}
  className="cell-name m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none w-full min-w-0 whitespace-nowrap text-center font-semibold leading-tight text-text-dim text-[clamp(7px,min(2.6vw,2.2vh),14px)]"
>
  {t('board.space.' + space.id)}
</button>
```

Notes:
- Replaces the earlier wrap-based `break-words text-balance` + `clamp(9px,min(2.6vw,2.4vh),14px)` from the previous iteration with `whitespace-nowrap` + `clamp(7px,min(2.6vw,2.2vh),14px)` (landscape/desktop baseline; portrait overrides font-size and writing-mode via CSS).
- `w-full min-w-0` stays — in landscape it makes the button fill the cell so centered one-line text doesn't clip; in portrait the CSS media query switches the cell to `flex-direction: row` so the name column and houses column sit side by side.
- `text-[clamp(...)]` — Tailwind v4 arbitrary value; commas fine, no spaces (there are none).

- [ ] **Step 2: Add the `cell-houses` class to the houses/hotel buttons**

Find the two house-marker buttons (around lines 192-211):

```tsx
{space.houses > 0 && space.houses < MAX_HOUSES && (
  <button
    type="button"
    tabIndex={-1}
    onClick={(e) => e.preventDefault()}
    className="cell-houses m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-xs tracking-[-1px]"
  >
    {'🏠'.repeat(space.houses)}
  </button>
)}
{space.houses === MAX_HOUSES && (
  <button
    type="button"
    tabIndex={-1}
    onClick={(e) => e.preventDefault()}
    className="cell-houses m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-base"
  >
    🏨
  </button>
)}
```

Do NOT add the class to the mortgage `M` badge button (it is absolutely positioned and must stay horizontal).

- [ ] **Step 3: Add the CSS**

In `src/index.css`, after the `#root` block, add:

```css
[data-testid^="board-cell-"] .cell-houses {
  font-size: clamp(8px, min(2.2vw, 2vh), 12px);
  line-height: 1.1;
  letter-spacing: 0;
}

@media (orientation: portrait) {
  [data-testid^="board-cell-"] {
    flex-direction: row;
  }
  [data-testid^="board-cell-"] .cell-name {
    writing-mode: vertical-rl;
    white-space: nowrap;
    font-size: clamp(6px, min(2.6vw, 1.05vh), 14px);
  }
  [data-testid^="board-cell-"] .cell-houses {
    writing-mode: vertical-rl;
    font-size: 9px;
    line-height: 1.15;
    letter-spacing: 0;
  }
}
```

Notes:
- The portrait `.cell-name` rule must override the Tailwind `text-[clamp(7px,...)]` utility — unlayered CSS in `index.css` beats layered utilities, so this works without `!important`.
- Do NOT tune `1.05vh` upward: the real e2e Chromium measured "Power Company" (13 glyphs) at 78px in a 73px cell at `1.15vh`; `1.05vh` gives ~72px. The +1px tolerance in the e2e assertion depends on this headroom.
- Verify empirically in the e2e context (Task 2), not just the dev browser.

- [ ] **Step 4: Verify build + portrait rendering**

Run: `npm run build` (must pass). Then run the dev/e2e server and confirm at 390×844 that `.cell-name` computed `writing-mode` is `vertical-rl` and no name overflows its cell (name rect inside cell rect). Also check landscape 844×390: `horizontal-tb`, one line.

- [ ] **Step 5: Commit**

```bash
git add src/components/BoardGrid.tsx src/index.css
git commit -m "feat: rotate board cell names in portrait orientation"
```

---

### Task 2: Rewrite e2e regression spec for rotation + no clipping

**Files:**
- Modify: `e2e/board-responsive.spec.ts` (replace the wrap-based version)
- Test: `e2e/board-responsive.spec.ts`

**Interfaces:**
- Consumes: `serverUrl` fixture from `./fixtures`; `seedWaitingGame` from `./helpers/seed`; `Browser`, `Page` types from `@playwright/test`.
- Produces: a spec with two tests — portrait asserts all 40 `.cell-name`s are `vertical-rl` and unclipped; landscape asserts all 40 are `horizontal-tb` and unclipped.

- [ ] **Step 1: Write the spec**

Replace `e2e/board-responsive.spec.ts`:

```ts
import { test, expect } from './fixtures'
import type { Browser, Page } from '@playwright/test'
import { seedWaitingGame } from './helpers/seed'

async function seedGamePage(browser: Browser, serverUrl: string, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()
  const code = (await codeLocator.innerText()).trim()

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
  })

  await expect(page.locator('[data-testid="board-cell-1"]')).toBeVisible({ timeout: 5000 })
  return page
}

function cellMetrics(page: Page) {
  return page.$$eval('[data-testid^="board-cell-"] .cell-name', (names) =>
    names.map((el) => {
      const name = el as HTMLElement
      const cell = name.closest('[data-testid^="board-cell-"]') as HTMLElement
      const style = getComputedStyle(name)
      return {
        text: name.textContent,
        fontSize: style.fontSize,
        writingMode: style.writingMode,
        hOverflow: name.scrollWidth > cell.clientWidth + 1,
        vOverflow: name.scrollHeight > cell.clientHeight + 1,
      }
    }),
  )
}

test('portrait: board city names rotate vertically and are never clipped', async ({ browser, serverUrl }) => {
  const page = await seedGamePage(browser, serverUrl, 390, 844)

  const results = await cellMetrics(page)

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])

  const rotated = results.filter((r) => r.writingMode === 'vertical-rl')
  expect(rotated.length).toBe(40)

  const sizes = results.map((r) => parseFloat(r.fontSize)).filter((n) => !Number.isNaN(n))
  expect(sizes.length).toBe(40)
  expect(Math.max(...sizes)).toBeLessThan(12)
})

test('landscape: board city names stay horizontal and are never clipped', async ({ browser, serverUrl }) => {
  const page = await seedGamePage(browser, serverUrl, 844, 390)

  const results = await cellMetrics(page)

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])

  const horizontal = results.filter((r) => r.writingMode === 'horizontal-tb')
  expect(horizontal.length).toBe(40)
})
```

- [ ] **Step 2: Run the spec**

Run: `npm run build && npm run test:e2e -- e2e/board-responsive.spec.ts`
Expected: PASS — 2 tests; portrait shows `vertical-rl` ×40 with no clipped names; landscape shows `horizontal-tb` ×40 with no clipped names.

- [ ] **Step 3: Commit**

```bash
git add e2e/board-responsive.spec.ts
git commit -m "test: e2e for rotated portrait and horizontal landscape board names"
```

---

### Task 3: Full verification pass

**Files:**
- Test: all specs

**Interfaces:**
- Consumes: everything from Tasks 1–2.

- [ ] **Step 1: Run the full test suite**

Run: `npm run build && npm run lint && npm run test:unit`
Expected: build OK, lint clean, unit tests pass (especially `src/components/__tests__/BoardGrid.test.tsx`).

- [ ] **Step 2: Run board-related + full e2e**

Run: `npm run test:e2e -- e2e/board-naming.spec.ts e2e/board-responsive.spec.ts`, then `npm run test:e2e`
Expected: all pass (full suite includes `e2e/monopoly.spec.ts` board interactions).

- [ ] **Step 3: Verify branch state and summarize**

Run: `git log --oneline -4`
Expected: docs + implementation commits. Do NOT merge to `main`; leave the branch for manual review.

## Self-Review

- **Spec coverage:** Goal (no clipping, orientation-aware) → Task 1 + Task 2. Testing requirement (regression at phone viewport) → Task 2. Verify commands → Task 3. All spec sections covered.
- **Placeholder scan:** No TBDs; every step has concrete code/commands.
- **Type consistency:** No new types/signatures introduced; `seedWaitingGame` signature matches its existing usage; `serverUrl`/`browser` come from the existing `./fixtures` export; `Browser`/`Page` imported as types from `@playwright/test` (satisfies `verbatimModuleSyntax`).
