Here's what I found so far:

## Baseline
- **Full e2e suite: 2.6 min** (153s wall), 87 passed, 1 flake, 2 skipped
- Serialized test time: **377s** — running on only **9 workers** (16 cores available)
- CI is not set, so `CI=` and worker count defaults apply

## Key findings
1. **Severe load imbalance**: 20 spec files, but each file runs on ONE worker. `trade-positive.spec.ts` (16 tests) monopolized worker 3 for **110s** while worker 8 finished in **9s**. The trade specs alone = 238s (63% of all test time).

2. **Server startup is NOT the bottleneck**: per-worker game server boot is only ~0.9s via `tsx`.

3. **No fixed-wait problem**: `waitForTimeout` calls are minimal (~8 total, <20s across all files).

4. **Config gaps** (playwright.config.ts):
   - No `fullyParallel` → files can't split across workers
   - No `workers` set → defaults to ~9, leaving cores idle
   - Vite dev server on 4173 is barely used — only `i18n.spec.ts` uses relative `goto('/')`; everything else hits the seeded game servers directly. So `webServer` vite could likely be **dropped entirely** and replaced with a static serve (or removed).

## Biggest wins (likely)
- **`fullyParallel: true` + higher `workers`** → splits the heavy trade files across cores (biggest lever, ~2-3x)
- **Remove/replace the unused vite dev server** → saves startup + memory per run
- **E2E_FAST mode or timeout tuning** as secondary

Want me to continue with the brainstorm/design (propose approaches + write spec + implement on a feature branch), or adjust direction first?