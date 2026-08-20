# Enum-Candidate Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single catalog document listing every enum-like candidate (string/number/boolean/other) in production code that could be converted to the repo's `const`-object enum convention — no conversions performed.

**Architecture:** A verified throwaway Node scan script harvests literal-set patterns across `src/` + `server/` (script has a known small blind spot for multi-line `Record` key maps, which curation greps cover). Parallel curation subagents verify each raw hit against live code and fill in proposed const names + confidence. One assembly step merges the curated sections into the final catalog at `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md`.

**Tech Stack:** Node 26 (`node`), TypeScript, the repo's existing const-object convention. No new dependencies, no framework code.

## Global Constraints

- **Convention**: "enum" = `const` object + derived union type (`src/types/game.ts` style). Never introduce TS `enum` (`erasableSyntaxOnly: true`).
- **No conversions this session**: no `src/` or `server/` files may be edited by any task. Only `docs/` and `/tmp` artifacts.
- **Wire values are a contract**: never propose changing an existing string value; proposed consts must preserve values byte-identically.
- **Over-include, tag confidence**: false-positive candidates are fine; every entry must carry High/Medium/Low confidence. Free-form strings (names, messages, CSS classes, space `color`s) and plain two-state booleans that are not discriminators are NOT candidates — if uncertain, include with Low confidence rather than drop.
- **Already-converted sets** (SpaceType, CardType, CardActionType, TaxType, GamePhase, PendingActionType, GameActionType, LogEventKey in `src/types/game.ts`; ConnectionStatus, ClientMessageType, ServerMessageType in `src/types/net.ts`; Currency in `src/data/currency.ts`; SoundId in `src/audio/soundEngine.ts`; MpAction in `src/components/GameSetup.tsx`; TOTALS in `src/logic/controlledDice.ts`) appear ONLY in the reference section — never re-listed as candidates.
- Working directory for all commands: repo root `/home/hidayat/data-d/myrepo/monopoly-game`.

---

### Task 1: Raw candidate dump

**Files:**
- Create (throwaway, NOT committed): `/tmp/opencode/enum-scan.cjs`
- Create (throwaway, NOT committed): `/tmp/opencode/enum-dump.txt`

**Interfaces:**
- Consumes: the repo's `src/` and `server/` trees.
- Produces: `/tmp/opencode/enum-dump.txt` — a text report grouped by category (`string-union`, `as-const`, `compare-string`, `string-set`, `literal-map`, `bool-discriminator`, `compare-number`) with `file:line` and the matched literal set. Later curation tasks read this dump.

- [ ] **Step 1: Write the scan script**

Write `/tmp/opencode/enum-scan.cjs` with this exact content (verified working — it scans `src/` + `server/`, excludes `__tests__`/`e2e`/`.test.`/`.spec.`/`dist`/`locales`):

```js
const fs = require('fs')
const path = require('path')

const ROOTS = ['src', 'server']
const EXCLUDE = /(__tests__|e2e|\.test\.|\.spec\.|\.d\.ts|dist|locales)/

const files = []
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(ent.name) && !EXCLUDE.test(p)) files.push(p)
  }
}
ROOTS.forEach(walk)

const hits = []
function add(file, line, category, text, set) {
  hits.push({ file, line, category, text: text.trim(), set })
}

for (const file of files.sort()) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = i + 1
    let m = raw.match(/:\s*((?:'[^']*'\s*\|\s*)+'[^']*')([^;]*)/)
    if (m && !raw.includes('//') && !raw.includes('* ')) {
      add(file, line, 'string-union', raw, m[1]); continue
    }
    if (raw.includes('as const')) { add(file, line, 'as-const', raw); continue }
    m = raw.match(/(===|!==)\s*'([^']+)'/)
    if (m && !raw.includes('//') && !raw.trim().startsWith('//')) {
      add(file, line, 'compare-string', raw, `'${m[2]}'`); continue
    }
    m = raw.match(/new Set\(\s*\[((?:'[^']*'\s*,?\s*)+)\]\)/)
    if (m) { add(file, line, 'string-set', raw, m[1]); continue }
    m = raw.match(/^\s*(['"]?[A-Za-z0-9]+['"]?)\s*:\s*\{/)
    if (m && /Record<|const [A-Z_]+: /.test(raw)) { add(file, line, 'literal-map', raw); continue }
    m = raw.match(/(Record<(string|number|\S+),|Map<|: Record<|const [A-Z_][A-Z0-9_]*\s*:\s*Record<|const [A-Z_][A-Z0-9_]*\s*=\s*\{)/)
    if (m) { add(file, line, 'literal-map', raw); continue }
    m = raw.match(/^\s*(['"]?\d+['"]?|['"][a-zA-Z-]+['"])\s*:/)
    if (m && /^\s*\d+\s*:/.test(raw)) { add(file, line, 'literal-map', raw); continue }
    if (/\{\s*ok\s*:\s*true\s*\}.{0,80}\{\s*ok\s*:\s*false\s*;/.test(raw)) {
      add(file, line, 'bool-discriminator', raw); continue
    }
    m = raw.match(/(===|!==)\s*(-?\d+)/)
    if (m && !raw.includes('//')) { add(file, line, 'compare-number', raw, m[2]); continue }
  }
}

const byCat = {}
for (const h of hits) { ;(byCat[h.category] ??= []).push(h) }
for (const cat of Object.keys(byCat).sort()) {
  console.log(`\n===== ${cat} (${byCat[cat].length}) =====`)
  for (const h of byCat[cat]) console.log(`${h.file}:${h.line}${h.set ? `  [${h.set}]` : ''}  ::  ${h.text}`)
}
console.log(`\nTOTAL FILES ${files.length}  TOTAL HITS ${hits.length}`)
```

- [ ] **Step 2: Run the scan and capture the dump**

Run: `node /tmp/opencode/enum-scan.cjs > /tmp/opencode/enum-dump.txt 2>&1`
Expected: exit 0; `/tmp/opencode/enum-dump.txt` contains all category sections and a `TOTAL FILES 65  TOTAL HITS ...` line (~96 hits).

- [ ] **Step 3: Sanity-check the dump**

Run: `grep -c "TOTAL HITS" /tmp/opencode/enum-dump.txt && grep -n "string-union\|bool-discriminator\|compare-string\|string-set" /tmp/opencode/enum-dump.txt | head`
Expected: at least one line per listed category; the known `SetBotControl` union (`src/types/game.ts:258`), the `ValidationResult` discriminator (`src/logic/seed.ts:97`), and `MONEY_PARAM_KEYS` (`src/i18n/log.ts:4`) present.

- [ ] **Step 4: Commit**

Nothing to commit (dump is throwaway). Confirm `git status --short` shows no changes: run `git status --short`; Expected: empty output.

---

### Task 2: Curation — Category A (string unions & string vocabularies)

**Files:**
- Create (throwaway, NOT committed): `/tmp/opencode/curation-A.md`

**Interfaces:**
- Consumes: `/tmp/opencode/enum-dump.txt` (Task 1) — filter it to categories `string-union`, `compare-string`, `string-set`; plus targeted greps below.
- Produces: `/tmp/opencode/curation-A.md` — catalog entries for every string-vocabulary candidate, each conforming to the catalog schema in Task 5. Later merged by Task 5.

- [ ] **Step 1: Pull the raw string hits**

Run:
```bash
node /tmp/opencode/enum-scan.cjs 2>&1 | sed -n '/string-union/,/bool-discriminator/p' > /tmp/opencode/raw-A.txt
grep -nE "(===|!==)\s*'|new Set\(\[|\.key ===|e\.key|typeof .* === '" src server --include="*.ts" --include="*.tsx" -r 2>/dev/null | grep -v __tests__ | head -60
```

- [ ] **Step 2: Add coverage greps for the script's blind spots**

Run (these catch what the regex scan misses):
```bash
grep -rn "'monopoly-\|STORAGE_KEY\|const KEY" src --include="*.ts" --include="*.tsx" | grep -v __tests__
grep -rn "DEFAULT_LANGUAGE\|option value=\|changeLanguage\|i18n.language" src --include="*.ts" --include="*.tsx" | grep -v __tests__
grep -rn "pathname ===\|'/config'\|'/seed'\|'/rooms'\|'/ws'\|url.pathname" server src --include="*.ts" --include="*.tsx" | grep -v __tests__
grep -rn "'true'\|VITE_ID_IDR\|TRADES_ENABLED\|E2E_SEED_ENABLED" src server --include="*.ts" | grep -v __tests__
grep -rn "'Escape'\|'Enter'\|' '" src --include="*.tsx" --include="*.ts" | grep -v __tests__
grep -rn "wss\|'ws'\|https:" src server --include="*.ts" --include="*.tsx" | grep -v __tests__
```

- [ ] **Step 3: Verify each hit against live code**

For every raw hit + grep hit above, open the file with the Read tool and classify:
- **Candidate** → record the exact value set, the declaration/usage `file:line`, and any production usages.
- **Not candidate** → skip silently UNLESS it was flagged in the design seed table (see Global Constraints / design doc) — then record it with `Confidence: Low / Likely-No` and a one-line reason.
- **Excluded by definition** (free-form strings, DOM APIs like `AudioContext.state`/`OscillatorType`/`KeyboardEvent.key`/`Intl` locales, `typeof x === 'string'` checks) → drop.

Minimum expected entries: `SetBotControl.reason` (High), language codes `en`/`id` (Medium), the three `monopoly-*` storage keys (Medium), LogEntry param keys `bot`/`spaceId`/`cardId` + money keys (Medium), HTTP paths `/config`/`/seed`/`/rooms`/`/ws` (Low), env `'true'` (Low), keyboard keys (Low/Likely-No), URL protocols (Low/Likely-No), Button/HoldToConfirmButton variant+size, RoomExit variant, LoadScenarioPanel `kind` (Low design tokens).

- [ ] **Step 4: Write the curated section**

Append to `/tmp/opencode/curation-A.md` entries in this exact schema:

```md
### A##-<slug>
- **Location**: `<file>:<line>` (+ usage sites)
- **Value set**: `<exact literals>`
- **Proposed const**: `<Name> = { K: 'v', ... } as const` + `type <Name> = (typeof <Name>)[keyof typeof <Name>]`
- **Confidence**: <High|Medium|Low|Low / Likely-No> — <one-line rationale>
```

- [ ] **Step 5: Verify no production files changed**

Run: `git status --short`
Expected: empty (only `/tmp` artifacts were created).

---

### Task 3: Curation — Category B (number sets)

**Files:**
- Create (throwaway, NOT committed): `/tmp/opencode/curation-B.md`

**Interfaces:**
- Consumes: `/tmp/opencode/enum-dump.txt` (Task 1) — filter to categories `literal-map` and `compare-number` (numeric entries only); plus targeted greps below.
- Produces: `/tmp/opencode/curation-B.md` — catalog entries for every number-set candidate. Merged by Task 5.

- [ ] **Step 1: Pull the raw numeric hits**

Run:
```bash
node /tmp/opencode/enum-scan.cjs 2>&1 | sed -n '/literal-map/,/bool-discriminator/p' > /tmp/opencode/raw-B.txt
grep -rn "MAX_PLAYERS\|MIN_PLAYERS\|MAX_JAIL\|BOARD_SIZE\|MAX_SLOTS\|for (let [a-z] = 1; [a-z] <= 6\|for (let [a-z] = 1; [a-z] <= [0-9]" src server --include="*.ts" --include="*.tsx" | grep -v __tests__ | head -40
```

- [ ] **Step 2: Add coverage greps for bounded numeric domains**

Run:
```bash
grep -rn "houses === \|houses >= \|houses < \|space.houses === [0-9]" src --include="*.ts" --include="*.tsx" | grep -v __tests__
grep -rn "player.position === 10\|position === 10\|jailTurns" src --include="*.ts" | grep -v __tests__
grep -rn "PIPS\|STANDARD_COUNTS\|PEAK_WEIGHTS\|POSITIONS\|PLAYER_OFFSETS\|TOTALS" src --include="*.ts" --include="*.tsx" | grep -v __tests__
```

- [ ] **Step 3: Verify each hit against live code**

Open files with Read. For each numeric map or bounded range decide:
- **Candidate** (dice faces `1..6`, house levels `0..5`, jail turns `0..3`, board spaces `0..39`, player slots `0..5`) → record with confidence.
- **Data lookup map** whose keys are a numeric domain (`PIPS`, `STANDARD_COUNTS`, `PEAK_WEIGHTS`, `POSITIONS`, `PLAYER_OFFSETS`) → record with Low confidence (data map, likely not worth a const) unless it overlaps a domain candidate (then cross-reference).
- **Already const** (`TOTALS` in `controlledDice.ts`) → skip (it's in the reference section).
- **Arbitrary/comparison-only numbers** (`index === -1`, `houses === 0`, `e.button !== 0`, `gridColumn === 1`) → drop (not a fixed vocabulary).

- [ ] **Step 4: Write the curated section**

Append to `/tmp/opencode/curation-B.md` using the same schema as Task 2 Step 4, but for number sets:

```md
### B##-<slug>
- **Location**: `<file>:<line>` (+ usage sites)
- **Value set**: `<range or enumerated keys>`
- **Proposed const**: `<Name> = [...] as const` / `<Name> = { 1: ..., ... }` — or "none (data map)" if not worth converting
- **Confidence**: <High|Medium|Low> — <one-line rationale>
```

- [ ] **Step 5: Verify no production files changed**

Run: `git status --short`
Expected: empty.

---

### Task 4: Curation — Category C (boolean discriminators) + D (reference list)

**Files:**
- Create (throwaway, NOT committed): `/tmp/opencode/curation-C.md`

**Interfaces:**
- Consumes: `/tmp/opencode/enum-dump.txt` (Task 1) — category `bool-discriminator`; plus targeted greps below.
- Produces: `/tmp/opencode/curation-C.md` — boolean-discriminator candidates + a verified already-converted reference list. Merged by Task 5.

- [ ] **Step 1: Pull the raw boolean hits**

Run:
```bash
node /tmp/opencode/enum-scan.cjs 2>&1 | sed -n '/bool-discriminator/,/compare-number/p' > /tmp/opencode/raw-C.txt
grep -rnE "\{\s*\w+\s*:\s*true\s*\}|\|\s*\{\s*\w+\s*:\s*false\s*;?\s*\}" src --include="*.ts" --include="*.tsx" | grep -v __tests__ | head -30
```

- [ ] **Step 2: Verify the discriminated-union candidates**

Open `src/logic/seed.ts` (ValidationResult) and any other `ok: true | false`-shaped unions found. Classify:
- **Candidate** (boolean used as a discriminant to narrow a union) → record, confidence Medium/Low.
- **Plain flag** (single boolean property not used to narrow a union) → drop.

- [ ] **Step 3: Build the verified reference (Category D) list**

Run:
```bash
grep -rn "export const \(SpaceType\|CardType\|CardActionType\|TaxType\|GamePhase\|PendingActionType\|GameActionType\|LogEventKey\|ConnectionStatus\|ClientMessageType\|ServerMessageType\|Currency\|SoundId\|MpAction\)" src --include="*.ts" --include="*.tsx"
grep -rn "export const TOTALS" src/logic/controlledDice.ts
```
Expected: all 15 consts found (14 named + `TOTALS`). Record the exact `file:line` for each in the output.

- [ ] **Step 4: Write the curated section**

Append to `/tmp/opencode/curation-C.md`:
- The boolean-discriminator candidates using the Task 2 schema.
- A `### D-reference` section listing each already-converted const with its `file:line`, prefixed `NOT a candidate`.

- [ ] **Step 5: Verify no production files changed**

Run: `git status --short`
Expected: empty.

---

### Task 5: Assemble the catalog + final verification

**Files:**
- Create: `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` (the deliverable; committed)
- Consumes: `/tmp/opencode/curation-A.md`, `curation-B.md`, `curation-C.md` (Tasks 2-4)

**Interfaces:**
- Produces: the final catalog at the repo path above — one section per category (A strings, B numbers, C booleans, D reference), entries in the curated schema, plus a summary table grouped by confidence.

- [ ] **Step 1: Merge the curated sections**

Read `/tmp/opencode/curation-A.md`, `curation-B.md`, `curation-C.md`. Verify the union of entries is non-empty and every candidate from the design seed table is present (A1-A13, B1-B10, C1). Re-number IDs sequentially as `C-01`, `C-02`, ... across the whole catalog.

- [ ] **Step 2: Write the catalog**

Create `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` with this structure:
1. Frontmatter: title, date, one-line purpose ("Survey only — no conversions"), link to the design doc.
2. **Summary table**: all entries grouped by confidence (High / Medium / Low / Low-Likely-No), columns `ID | Candidate | Value set | Location`.
3. **Category A — strings**: full entries (Task 2 schema).
4. **Category B — numbers**: full entries (Task 3 schema).
5. **Category C — boolean discriminators**: full entries.
6. **Category D — reference (already converted)**: the 15 consts with `file:line`, labeled "NOT candidates".

- [ ] **Step 3: Cross-check the catalog**

Run:
```bash
grep -c "Confidence: High" docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md
grep -c "NOT a candidate" docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md
grep -c "Confidence: Low / Likely-No" docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md
```
Expected: ≥1 High, ≥13 "NOT a candidate" (15 reference consts; count may be split), ≥3 Low/Likely-No (design-token/API/browser cases). Also run `npm run typecheck` and `npm run lint` — both must pass (proves no accidental `src/`/`server/` edits).

- [ ] **Step 4: Verify only docs changed**

Run: `git status --short`
Expected: only `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` (new) and any `docs/` plan/design files are untracked/modified. No `src/` or `server/` paths.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md
git commit -m "docs: catalog of enum-like conversion candidates"
```
