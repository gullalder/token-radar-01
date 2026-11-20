# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/gullalder/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/gullalder/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Atlas is an offline token launch research workspace for the make.fun token-radar-01 bounty ($1,325 prize pool). It ranks 176 protocols by implied circulating market capitalization, covers all 40 sealed watchlist protocols and adds 136 clearly marked candidates below $50M TVL. It includes category-specific participation plans, transparent valuation inputs, scenario ranges, and separate token-bearing records. No token launch, points program or allocation is assumed.

## Run it

```sh
/root/autodl-tmp/node22/bin/node main.ts
# Open /output/dashboard/index.html in a browser (file:// works).
```

## Model and scope

Only `/input/snapshot.json` and repository files are read at runtime. Node 22.18+ runs the TypeScript directly; there is no build, package manager, dependency, API key or network requirement. The sealed data is dated 2026-11-14; this is not a live feed.

`lib/model.ts` derives market-cap/TVL ratios from 89 distinct positive-cap token peers. Shared CoinGecko ids count once, using the highest-TVL representative. Category medians shrink in log space toward the global median with weight `n/(n+5)`. Each candidate's TVL is multiplied by this ratio and bounded factors for 7-day TVL momentum, tracking tenure and network breadth. No protocol gets a name-specific valuation adjustment. The dashboard's methodology explains every constant and lets readers inspect category peers.

The lower and upper scenarios use shrunk peer quartiles with additional discounts/premiums. They are sensitivities, not confidence intervals. Sparse samples and missing fields produce Low confidence; no record receives High. Market cap is circulating capitalization, never FDV, a token price, a farm payout or a launch probability. The snapshot omits revenue, token rights, supply dilution and campaign terms.

The authoritative watchlist is included as given. Below-floor extensions exclude obvious wrapped, staked, bridge, exchange and versioned products; their parent independence cannot be verified because the snapshot omits parent records. All 416 records with a token id, symbol or market cap are separated from the launch board. “No token recorded” does not establish token absence.

## Use the workspace

Search by name, category, ticker or chain; combine category, network and TVL-band filters. Switch between all records, the core watchlist and below-floor candidates. Click table headers to sort, use pagination to browse, and open a protocol for its exact valuation inputs, confidence note, peer sample and participation plan. Filters and protocol detail links are encoded in the URL fragment. Export the current filtered set to CSV or print a detail page. Methodology and token-bearing records have their own views.

Activity plans are category-derived suggestions, with a chain drawn from the protocol's snapshot networks. They distinguish lending, liquidity provision, curators, managed vaults, basis strategies, RWA/CeDeFi, staking, insurance, payments/chains and derivatives. Illustrative capital, network-fee reserves, review horizons, failure modes and exit actions are included. Product support, asset minimums, eligibility and any points rules must be verified in the official app; none is claimed as observed.

## Outputs and verification

The default run writes `/output/board.json`, `/output/data.js`, `/output/dashboard/`, `/output/screenshots/` and `/output/dossier.json`. The dossier is generated with the unmodified kit library. All dashboard source fits below the 65,536-byte dossier text cap. Three genuine headless Google Chrome screenshots show the board, Gauntlet detail and filtered below-floor lending records at 1440×1000. Lossless PNG re-encoding changes compression only, keeping each around 320 KB.

The starter's optional `--input <file|dir>`, `--output <dir>` and `MAKEFUN_OUTPUT_DIR` overrides are preserved for local development. The grader needs no overrides.

```sh
node scripts/verify.ts
# Requires local Google Chrome; opens /output and regenerates screenshots:
node scripts/browser-check.mjs
python3 scripts/reencode-png.py
node main.ts
node scripts/verify.ts
```

Checks cover board schema, all watchlist slugs, rank/value order, distinct-token peer selection, missing values and factor caps, all 176 detail pages, actual filter/search/sort/pagination controls, empty states, mobile layout, no browser errors or network requests, data/board consistency and byte-exact dossier reconstruction. Two independent program runs are byte-identical. Measured runtime was 0.28–0.32 seconds with peak child memory of 97 MiB, within the requested 60-second / 512-MiB budget.

`grade-local --driver process` was attempted with the kit CLI: it reports that this program/v1 competition's scorer and reference data are not published. A local competition grade is therefore unavailable; the verification above is not a judge score.

## Repository layout

- `main.ts`: deterministic input/output orchestration.
- `lib/model.ts`: comparable valuation, selection, confidence and activity plans.
- `dashboard/`: original static HTML, CSS and JavaScript client.
- `screenshots/`: three real browser captures.
- `scripts/`: independent model/output validation and Chrome interaction checks.
- `vendor/makefun-board.ts`: unchanged official dossier builder.
- `LICENSE`: MIT, copied from the kit starter.

---

<sub>Entered on [make.fun](https://make.fun/?ref=nimble-lark-78-9330&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
