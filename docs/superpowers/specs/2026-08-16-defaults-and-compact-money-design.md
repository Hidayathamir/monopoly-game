# Monopoly — English/USD Defaults & Compact Money Display

**Date**: 2026-08-16
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server

## Goal

Change the product defaults so first-run players get **English** and **USD**, and change money display to use **compact notation** (max ~3 digits, e.g. `$1.5K`, `Rp 1,5 M`) everywhere in both currencies.

This supersedes the earlier default decision (ID/IDR) in `2026-08-15-ux-pov-fixes-and-defaults-design.md` (#9).

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Default language | `DEFAULT_LANGUAGE = 'en'` in `src/i18n/index.ts` |
| 2 | Default currency | `DEFAULT_CURRENCY = 'USD'` in `src/data/currency.ts` |
| 3 | Money display | `formatMoney` uses `Intl.NumberFormat` with `notation: 'compact'` + `maximumFractionDigits: 1`; applies to all call sites in both currencies |

## Change details

### 1 — Default language English

`src/i18n/index.ts:7` — `DEFAULT_LANGUAGE = 'en'`. Used for first-run language, fallback language, and the value returned when `localStorage` has nothing saved. Saved user preference (`monopoly-language`) still overrides.

### 2 — Default currency USD

`src/data/currency.ts:15` — `DEFAULT_CURRENCY: Currency = 'USD'`. Used when no currency is saved in `localStorage` (`monopoly-currency`). Saved preference still overrides.

### 3 — Compact money formatting

`formatMoney` in `src/data/currency.ts:17-26` currently:

```ts
new Intl.NumberFormat(def.locale, {
  style: 'currency',
  currency: def.currency,
  maximumFractionDigits: 0,
})
```

Add `notation: 'compact'` and change `maximumFractionDigits` to `1`:

```ts
new Intl.NumberFormat(def.locale, {
  style: 'currency',
  currency: def.currency,
  notation: 'compact',
  maximumFractionDigits: 1,
})
```

Native `Intl` output (verified):

| locale | value | formatted |
|--------|-------|-----------|
| en-US | 60 | `$60` |
| en-US | 1500 | `$1.5K` |
| en-US | 2000 | `$2K` |
| en-US | 1.5e9 | `$1.5B` |
| id-ID | 6e7 (60 × 1e6) | `Rp 60 jt` |
| id-ID | 1.5e9 (1500 × 1e6) | `Rp 1,5 M` |
| id-ID | 2e9 (2000 × 1e6) | `Rp 2 M` |

Because the IDR multiplier (1e6) is applied before formatting, IDR values stay in Indonesian million/billion range and compact suffixes render naturally. The single `formatMoney` function is used by all consumers (`useCurrency`, `PlayerCard`, `ActionSection`, `PropertyTooltip`, modals, `EventLog`) — no call-site changes needed.

## Files summary

| File | Change |
|------|--------|
| `src/i18n/index.ts` | `DEFAULT_LANGUAGE = 'en'` |
| `src/data/currency.ts` | `DEFAULT_CURRENCY = 'USD'`; `formatMoney` → `notation: 'compact'`, `maximumFractionDigits: 1` |
| `src/data/__tests__/currency.test.ts` | Update expectations: default USD; compact formats (`$1.5K`, `$2K`); IDR compact (`Rp 1,5 M`); undefined → `$0` |

## Testing

- Unit: update `src/data/__tests__/currency.test.ts` — `DEFAULT_CURRENCY` is `USD`; USD compact (`$1.5K`, `$2K`); IDR compact (`Rp 1,5 M` for 1500 units); `undefined` → `$0`.
- E2E: `e2e/*.spec.ts` set `monopoly-language=en` + `monopoly-currency=USD` in `addInitScript` already; they pin the preference so behavior is unchanged. No e2e updates expected, but run the suite to confirm nothing asserts full-precision money strings.

## Out of scope

- New currency options or locales.
- Changing the IDR multiplier.
- Any change to game rules or board data.
