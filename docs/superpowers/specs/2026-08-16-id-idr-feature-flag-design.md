# ID Language / IDR Currency Feature Flag Design

Date: 2026-08-16

## Problem

The game ships with two languages (English, Indonesian) and two currencies
(USD, IDR), selectable from the language/currency bar. The desired default is
**English + USD only**: Indonesian language and IDR currency should be hidden
unless explicitly enabled at build time. There is currently no mechanism to do
this — the `LanguageCurrencyBar` hardcodes the `ID` and `IDR` options, and saved
preferences in localStorage (e.g. a user who previously picked `id` / `IDR`)
would be honored on load.

## Goals

- A build-time feature flag, **disabled by default**, that hides Indonesian
  language and IDR currency entirely.
- When disabled, only `en` + `USD` exist: the selector bar is hidden, and any
  saved `id` / `IDR` preference is clamped back to `en` / `USD` on load.
- When enabled (opt-in at build time), current behavior is unchanged — the bar
  shows EN/ID and USD/IDR options.
- No server involvement — this is a purely client-side UI preference.
- Existing unit and e2e tests keep working.

## Non-Goals

- No per-room or per-user toggle — the flag is global to a build.
- No removal of the `id` locale file or `IDR` currency definition — the flag
  only gates UI and clamps prefs, so flipping it back on is a rebuild with no
  code edits.
- No changes to the server, the wire contract, or the `Currency` type.

## Design

### 1. Flag definition

New file `src/config/features.ts`:

```ts
export const ID_IDR_ENABLED = import.meta.env.VITE_ID_IDR_ENABLED === 'true'
```

- Unset env var or anything other than the literal `'true'` ⇒ disabled.
- `tsconfig.app.json` already includes `"types": ["vite/client"]`, so
  `import.meta.env` is typed; no `vite-env.d.ts` is required.

### 2. Hide the selector bar when disabled

`src/components/LanguageCurrencyBar.tsx`:

```tsx
if (!ID_IDR_ENABLED) return null
```

The guard must sit **after all hooks** in the component (its `useState`/
`useRef`/`useEffect` calls stay above it) so hook order is unchanged — the
component returns `null` and the panel simply never opens.

### 3. Clamp the saved language

`src/i18n/index.ts` — force English on load regardless of a saved `id`:

```ts
lng: ID_IDR_ENABLED ? readSavedLanguage() : DEFAULT_LANGUAGE,
```

Both `en` and `id` resources stay registered; only the initial language is
clamped. Extract the decision into a small pure function so it can be unit
tested without touching the `i18n` singleton:

```ts
export function resolveInitialLanguage(enabled = ID_IDR_ENABLED): string {
  return enabled ? readSavedLanguage() : DEFAULT_LANGUAGE
}
```

### 4. Clamp the saved currency

`src/i18n/CurrencyContext.tsx`:

- Export `readSavedCurrency(enabled = ID_IDR_ENABLED)` — returns
  `DEFAULT_CURRENCY` (`USD`) when `enabled` is `false`, ignoring a saved `IDR`.
- `setCurrency(c)` coerces to `USD` when `!ID_IDR_ENABLED` (belt-and-suspenders;
  the UI cannot call it when the bar is hidden, but it keeps the invariant that
  only `en`/`USD` are ever active).

### 5. Docs

`AGENTS.md` — add under Commands/Configuration:

```
- `VITE_ID_IDR_ENABLED=true npm run dev` / `npm run build` — enables the
  Indonesian language and IDR currency options (default disabled; anything
  other than the literal `true` leaves only English/USD available)
```

## Testing

- Unit tests deterministically mock the `features` module (`vi.mock`) to
  exercise both paths without relying on env plumbing:
  - `src/components/__tests__/LanguageCurrencyBar.test.tsx` — mock
    `ID_IDR_ENABLED: true`; the existing six tests (toggle open/close, select
    EN/ID, USD/IDR, outside click, Escape) keep passing unchanged.
  - `src/components/__tests__/LanguageCurrencyBar.disabled.test.tsx` — mock
    `ID_IDR_ENABLED: false`; assert the bar renders nothing.
  - i18n clamp test — mock `false`, seed localStorage `monopoly-language` =
    `id`, assert `resolveInitialLanguage()` returns `en`.
  - currency clamp test — mock `false`, seed localStorage `monopoly-currency` =
    `IDR`, assert `readSavedCurrency()` returns `USD`.
- e2e `e2e/i18n.spec.ts` (toggles to `id`/`IDR`): guard both tests with
  `test.skip(process.env.VITE_ID_IDR_ENABLED !== 'true', 'ID/IDR feature disabled by default')`
  so they skip under the default build instead of failing. When the server is
  started with the env var set, they run.

## Verification

- Default build: `npm run build` then `npm run server` — the bar is absent,
  saved `id`/`IDR` prefs load as English/USD.
- Enabled build: `VITE_ID_IDR_ENABLED=true npm run build` — bar appears with
  EN/ID and USD/IDR; switching works as before.
- `npm run typecheck`, `npm run test:unit`, and `npm run lint` all pass.
