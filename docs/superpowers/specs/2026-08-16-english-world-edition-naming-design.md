# English Board Naming — World Edition

**Date**: 2026-08-16
**Status**: Approved
**Stack**: i18n translation files only (`react-i18next`)

## Goal

Rename the English board space names to match the Monopoly World Edition board (global cities grouped by country, airport railroads, Treasure/Surprise card spaces, Vacation, In Prison, Go to Prison, Earnings/Premium Tax). Indonesian names are unchanged. No layout, game logic, or data changes.

## Scope

- Modify: `src/i18n/locales/en/translation.json` — the `board.space.*` keys (0–39) and four card texts referencing renamed spaces.
- Nothing else. Layout, prices, and `board-data.json` are untouched; names render through `t('board.space.' + space.id)` (BoardGrid, PropertyTooltip, PlayerCard, ActionSection, BuyPropertyModal, TradeModal, log.ts) so a translation-only change propagates everywhere.

## Space mapping

Current position → new English name:

| pos | name | pos | name |
|---|---|---|---|
| 0 | START | 20 | Vacation |
| 1 | Salvador | 21 | Shenzhen |
| 2 | Treasure | 22 | Surprise |
| 3 | Rio | 23 | Beijing |
| 4 | Earnings Tax | 24 | Shanghai |
| 5 | TLV Airport | 25 | CDG Airport |
| 6 | Tel Aviv | 26 | Lyon |
| 7 | Surprise | 27 | Toulouse |
| 8 | Haifa | 28 | Water Company |
| 9 | Jerusalem | 29 | Paris |
| 10 | In Prison | 30 | Go to Prison |
| 11 | Venice | 31 | Liverpool |
| 12 | Power Company | 32 | Manchester |
| 13 | Milan | 33 | Treasure |
| 14 | Rome | 34 | London |
| 15 | MUC Airport | 35 | JFK Airport |
| 16 | Frankfurt | 36 | Surprise |
| 17 | Treasure | 37 | San Francisco |
| 18 | Munich | 38 | Premium Tax |
| 19 | Berlin | 39 | New York |

Mapping notes:
- Card spaces: Chance → "Surprise", Community Chest → "Treasure".
- Railroads → airports (TLV, MUC, CDG, JFK).
- Utilities → Power Company / Water Company.
- Taxes → "Earnings Tax" (income, pos 4) / "Premium Tax" (luxury, pos 38).
- Corners → START, In Prison (jail), Vacation (free parking), Go to Prison (go to jail).
- Final stretch: the image's US pair (New York, San Francisco) maps to the current dark-blue slots (39, 37) and the UK trio (Liverpool, Manchester, London) to the current green slots (31, 32, 34), ordered by price (cheapest → most expensive).

## Card texts (English only)

Cards reference renamed spaces by hardcoded English text, so update them for consistency:

- `card.chance.1`: "Advance to GO." → "Advance to START."
- `card.chance.2`: "Advance to Park Place." → "Advance to San Francisco." (space 37)
- `card.chance.3`: "Advance to Boardwalk." → "Advance to New York." (space 39)
- `card.chance.4`: "Advance to Reading Railroad." → "Advance to TLV Airport." (space 5)

All other card texts and the Indonesian locale are untouched.

## Testing

- Run `npm run test:unit` — no tests assert English space names, so this should stay green.
- Run `npm run typecheck` and `npm run lint`.
- Manual check: switch app to English, confirm board shows World Edition names and the Chance cards display the updated destination text.

## Out of scope

- Indonesian locale, board layout, prices, rules, currency, and all game logic.
- Indonesian card texts.
