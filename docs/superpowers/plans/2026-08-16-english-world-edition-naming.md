# English World Edition Board Naming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the English board space names to the Monopoly World Edition (global cities, airport railroads, Treasure/Surprise, Vacation, In Prison) and update the four card texts that reference renamed spaces.

**Architecture:** A single source file, `src/i18n/locales/en/translation.json`, holds all English display strings. `board.space.*` keys (0–39) are rendered via `t('board.space.' + space.id)` in six components plus `log.ts`, so changing only the translation propagates everywhere. No layout, data, or logic changes.

**Tech Stack:** TypeScript, `react-i18next`, Vitest, ESLint, Playwright.

## Global Constraints

- Do NOT touch `src/i18n/locales/id/translation.json` — Indonesian names stay as-is.
- Do NOT touch `src/data/*.json`, `src/logic/*`, or any component logic — names come purely from the translation file.
- Every `board.space.N` key 0–39 must remain present (components index by `space.id`); only the English *values* change.
- Card texts that reference a renamed space by name must be updated in the same file to stay consistent.

---

### Task 1: Rename English board spaces + card texts

**Files:**
- Modify: `src/i18n/locales/en/translation.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the renamed English strings consumed by `BoardGrid`, `PropertyTooltip`, `PlayerCard`, `ActionSection`, `BuyPropertyModal`, `TradeModal`, `CardModal`, and `log.ts`. No code depends on the literal English values, so no other file changes.

- [ ] **Step 1: Replace the `board.space.*` values (lines 5–44)**

In `src/i18n/locales/en/translation.json`, change ONLY the values of the `board.space.*` keys. Keep the keys, ordering, commas, and quoting identical. Replace each value with:

```
"board.space.0": "START",
"board.space.1": "Salvador",
"board.space.2": "Treasure",
"board.space.3": "Rio",
"board.space.4": "Earnings Tax",
"board.space.5": "TLV Airport",
"board.space.6": "Tel Aviv",
"board.space.7": "Surprise",
"board.space.8": "Haifa",
"board.space.9": "Jerusalem",
"board.space.10": "In Prison",
"board.space.11": "Venice",
"board.space.12": "Power Company",
"board.space.13": "Milan",
"board.space.14": "Rome",
"board.space.15": "MUC Airport",
"board.space.16": "Frankfurt",
"board.space.17": "Treasure",
"board.space.18": "Munich",
"board.space.19": "Berlin",
"board.space.20": "Vacation",
"board.space.21": "Shenzhen",
"board.space.22": "Surprise",
"board.space.23": "Beijing",
"board.space.24": "Shanghai",
"board.space.25": "CDG Airport",
"board.space.26": "Lyon",
"board.space.27": "Toulouse",
"board.space.28": "Water Company",
"board.space.29": "Paris",
"board.space.30": "Go to Prison",
"board.space.31": "Liverpool",
"board.space.32": "Manchester",
"board.space.33": "Treasure",
"board.space.34": "London",
"board.space.35": "JFK Airport",
"board.space.36": "Surprise",
"board.space.37": "San Francisco",
"board.space.38": "Premium Tax",
"board.space.39": "New York"
```

- [ ] **Step 2: Update the four card texts referencing renamed spaces (lines 46–49)**

Change only the English card texts whose destination names changed:

- `"card.chance.1"`: `"Advance to GO."` → `"Advance to START."`
- `"card.chance.2"`: `"Advance to Park Place."` → `"Advance to San Francisco."`
- `"card.chance.3"`: `"Advance to Boardwalk."` → `"Advance to New York."`
- `"card.chance.4"`: `"Advance to Reading Railroad."` → `"Advance to TLV Airport."`

All other card texts (`card.chance.5`–`.10`, `card.community.*`) stay unchanged.

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en/translation.json','utf8')); console.log('valid')"`
Expected: prints `valid` (no trailing commas, balanced braces).

- [ ] **Step 4: Verify the en/id locale key sets still match**

Run: `node -e "const en=require('./src/i18n/locales/en/translation.json');const id=require('./src/i18n/locales/id/translation.json');const ek=Object.keys(en).sort();const ik=Object.keys(id).sort();console.log('keys equal:', JSON.stringify(ek)===JSON.stringify(ik));if(JSON.stringify(ek)!==JSON.stringify(ik)){console.log('only-en:',ek.filter(k=>!ik.includes(k)));console.log('only-id:',ik.filter(k=>!ek.includes(k)))}"`
Expected: `keys equal: true`

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass (lint may show the 2 pre-existing warnings in `PlayerTokens.tsx`).

- [ ] **Step 6: Run unit tests**

Run: `npm run test:unit`
Expected: all pass. No test asserts the English space names or the four card texts.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales/en/translation.json
git commit -m "feat: rename English board spaces to World Edition naming"
```

---

### Task 2: Verify rendered board via e2e smoke

**Files:**
- Run only (no file changes): `e2e/monopoly.spec.ts`

**Interfaces:**
- Consumes: the renamed strings from Task 1.
- Produces: confirmation the board renders the new names in a real browser.

- [ ] **Step 1: Run the local e2e suite**

Run: `npm run test:e2e`
Expected: all specs pass. The local spec (`e2e/monopoly.spec.ts`) sets `monopoly-language` to `en` via `addInitScript` and renders the board; if any test asserted an old English name it would now fail — none do.

- [ ] **Step 2: Sanity-check the multiplayer spec requires `dist/`**

`e2e/multiplayer.spec.ts` spawns `tsx server/main.ts` serving `dist/`. Since `npm run test:e2e` runs after a clean checkout, `dist/` may be absent — if the multiplayer spec fails with a missing `dist/`, run `npm run build` first, then re-run `npm run test:e2e`. Expected: all green.

- [ ] **Step 3: Commit (only if a fix was needed)**

If the e2e run surfaced a real naming mismatch, fix `en/translation.json` and commit; otherwise no commit in this task.

```bash
git add src/i18n/locales/en/translation.json
git commit -m "fix: correct English board naming per e2e"
```

---

## Self-Review Checklist

- **Spec coverage:** Board space mapping (40 names) → Task 1 Step 1. Card texts → Task 1 Step 2. Verification/tests → Task 1 Steps 3–6 and Task 2.
- **Placeholder scan:** No TBD/TODO; all steps carry exact values.
- **Type consistency:** No types or signatures involved; only string values in one file.
