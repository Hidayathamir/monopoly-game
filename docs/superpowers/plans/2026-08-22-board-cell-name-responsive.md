# Responsive Board Cell Name Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 40 board city names never clip and scale fluidly with the screen, with phone portrait as the priority.

**Architecture:** A pure-CSS change in `BoardGrid.tsx`: the `.cell-name` button stops being a shrink-proof flex item (`w-full min-w-0` + `break-words`) so names wrap inside narrow cells, and the fixed `text-xs` becomes a fluid `clamp(9px,min(2.6vw,2.4vh),14px)` so typography tracks the smaller viewport dimension. A new Playwright spec seeds a waiting game and asserts no cell-name overflows its cell at a phone viewport. No data, i18n, or wire-contract changes.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (arbitrary-value utilities), Vitest, Playwright (worker-scoped `serverUrl` fixture). Must run `npm run build` before server-backed e2e.

## Global Constraints

- No TS enums; `verbatimModuleSyntax: true` → `import type` for type-only imports. `noUnusedLocals`/`noUnusedParameters` on.
- Enum-like string constants via `const` objects + derived unions (not relevant here — no new types).
- i18n: every UI string in both `en`/`id` locales (no new strings here — names come from existing `t('board.space.' + id)`).
- Board is 11×11 grid filling the viewport; cells = `(viewport − 16px)/11`. Keep this layout; do NOT restructure it.
- Semicolons: `BoardGrid.tsx` omits them; match the file.
- Playwright server-backed specs require `dist/` → run `npm run build` first.
- Work on branch `feat/board-cell-name-responsive` (already created); commit after each task.

---

### Task 1: Fix the cell-name button so names wrap and scale fluidly

**Files:**
- Modify: `src/components/BoardGrid.tsx:184-191` (the `.cell-name` button)

**Interfaces:**
- Consumes: nothing new — existing `t('board.space.' + space.id)` and the `cell-name` class (used by Chance/Community color overrides via `[&_.cell-name]`).
- Produces: a `.cell-name` button whose computed font-size is `clamp(9px, min(2.6vw, 2.4vh), 14px)`, takes full cell width, and wraps overflow text. No new props or types.

- [ ] **Step 1: Edit the `.cell-name` button className**

In `src/components/BoardGrid.tsx`, find the name button (currently around line 184):

```tsx
<button
  type="button"
  tabIndex={-1}
  onClick={(e) => e.preventDefault()}
  className="cell-name m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-xs text-center font-semibold leading-tight text-text-dim"
>
  {t('board.space.' + space.id)}
</button>
```

Replace the `text-xs` token with fluid classes, keeping everything else identical:

```tsx
className="cell-name m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none w-full min-w-0 break-words text-balance text-center font-semibold leading-tight text-text-dim text-[clamp(9px,min(2.6vw,2.4vh),14px)]"
```

Notes:
- `w-full min-w-0` — `w-full` makes the button take the cell's content width (cell has `p-0.5`) so text wraps inside the cell instead of overflowing; `min-w-0` is retained as a defensive guard for the flex min-size rule.
- `break-words` = `overflow-wrap: break-word` — breaks long tokens ("Water Company") on the narrowest cells.
- `text-balance` = `text-wrap: balance` — evens out wrapped lines; harmless no-op fallback in older browsers.
- `text-[clamp(9px,min(2.6vw,2.4vh),14px)]` — Tailwind v4 arbitrary value; commas are fine inside arbitrary values, no spaces allowed (there are none).

- [ ] **Step 2: Verify it compiles and renders**

Run: `npm run build`
Expected: succeeds (typecheck + vite build).

- [ ] **Step 3: Commit**

```bash
git add src/components/BoardGrid.tsx
git commit -m "feat: fluid responsive board cell name typography"
```

---

### Task 2: Add e2e regression test for name clipping at phone viewport

**Files:**
- Create: `e2e/board-responsive.spec.ts`
- Test: `e2e/board-responsive.spec.ts`

**Interfaces:**
- Consumes: `serverUrl` fixture from `./fixtures` (worker-scoped, spawns `tsx server/main.ts` serving `dist/`); `seedWaitingGame` from `./helpers/seed`.
- Produces: a Playwright spec that fails if any board cell's `.cell-name` overflows its cell at 390×844.

- [ ] **Step 1: Write the failing spec**

Create `e2e/board-responsive.spec.ts`:

```ts
import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test('board city names are not clipped at phone viewport', async ({ browser, serverUrl }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
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

  const results = await page.$$eval('[data-testid^="board-cell-"] .cell-name', (names) =>
    names.map((el) => {
      const name = el as HTMLElement
      const cell = name.closest('[data-testid^="board-cell-"]') as HTMLElement
      const style = getComputedStyle(name)
      const cellStyle = getComputedStyle(cell)
      return {
        text: name.textContent,
        fontSize: style.fontSize,
        hOverflow: name.scrollWidth > cell.clientWidth + 1,
        vOverflow: name.scrollHeight > cell.clientHeight + 1,
      }
    }),
  )

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])
})
```

- [ ] **Step 2: Verify the test fails on the pre-fix code (Task 1 not applied)**

Run: `npm run test:e2e -- e2e/board-responsive.spec.ts`
Expected: `clipped` contains overflow entries (e.g. "Manchester", "Water Company") and the test FAILS. If it passes, something is wrong (fix the assertion before proceeding).

- [ ] **Step 3: Verify the test passes with Task 1 applied**

Apply Task 1's edit if not already done, rebuild (`npm run build`), then:
Run: `npm run test:e2e -- e2e/board-responsive.spec.ts`
Expected: PASS — 40 cells, no clipped names, font-size ≈ `10.14px` at 390×844.

- [ ] **Step 4: Commit**

```bash
git add e2e/board-responsive.spec.ts
git commit -m "test: e2e regression for responsive board cell names"
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

- [ ] **Step 2: Run the board-related e2e specs**

Run: `npm run test:e2e -- e2e/board-naming.spec.ts e2e/board-responsive.spec.ts`
Expected: both PASS.

- [ ] **Step 3: Verify branch state and summarize**

Run: `git log --oneline -4`
Expected: three commits (`docs:` spec, `feat:` typography, `test:` regression). Do NOT merge to `main`; leave the branch for manual review.

## Self-Review

- **Spec coverage:** Goal (no clipping, ≤3 lines, fluid size) → Task 1 + Task 2. Testing requirement (regression at phone viewport) → Task 2. Verify commands → Task 3. All spec sections covered.
- **Placeholder scan:** No TBDs; every step has concrete code/commands.
- **Type consistency:** No new types/signatures introduced; `seedWaitingGame` signature matches its existing usage in `e2e/board-naming.spec.ts`; `serverUrl`/`browser` come from the existing `./fixtures` export.
