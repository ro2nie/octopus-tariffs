# Octopus Energy — Live Price Kiosk

A sleek, single-page dashboard that plots today's electricity unit rates for your region —
**Intelligent Octopus Go**, **Octopus Go** and **Agile Octopus** (import) — shows the price
that applies **right now**, and is designed to be left running on an always-on kiosk display.

Built with **SvelteKit 2 (Svelte 5 runes)** and deployed as a static client-rendered app to
**Cloudflare Pages**.

## Features

- **Tariff family toggle** — switch between **Intelligent Octopus Go** (fixed 23:30–05:30
  off-peak window), **Octopus Go** (fixed 00:30–05:30 off-peak window) and **Agile Octopus**
  (half-hourly wholesale prices that change daily). Each family has its own product picker.
- **Agile Outgoing export** — on Agile, the **Agile Outgoing** export price is shown with its
  own "right now" card and day stats beneath the import ones, and its curve is plotted in a
  separate amber chart underneath the import chart, with a toggle to show/hide it.
- **Postcode → region lookup** using Octopus's public grid supply point endpoint. Your
  postcode is stored only in your browser's `localStorage` and is never sent anywhere except
  Octopus.
- **Live current price** in large, legible type with an **OFF-PEAK / PEAK** badge and a
  countdown to the next rate change.
- **Whole-day price curve** as a step-area chart (LayerChart + D3), with the off-peak window
  shaded and a marker at the current time.
- **Tariff picker** — choose between the currently available tariffs for the selected family
  (e.g. on Intelligent Go, the standard plan and the "EV Saver" variant).
- **Auto-refresh every 10 minutes**, plus an immediate refresh when the tab becomes visible
  again.
- **Kiosk friendly** — screen wake lock, fullscreen toggle, and an idle cursor that hides
  itself.
- **Resilient** — the last successful snapshot is cached locally so the dashboard paints
  instantly on reload, with retry/backoff on transient API failures.
- **Dark, modern, futuristic** visual design with an accessible, responsive layout.

## How it works

All data comes from the public, unauthenticated [Octopus Energy REST API](https://docs.octopus.energy/rest/guides/endpoints/):

1. **Postcode → region**: `GET /v1/industry/grid-supply-points/?postcode=SY1 1AA` returns a
   GSP group such as `_C`, whose letter matches the region suffix of an Octopus tariff code.
2. **Tariff discovery**: `GET /v1/products/?brand=OCTOPUS_ENERGY` is filtered per selected
   family — domestic "Intelligent Octopus Go", "Octopus Go" or "Agile Octopus" import products
   — so you can select the exact tariff you're on. Export products such as Agile Outgoing are
   excluded, as are the "Intelligent" and "Go Faster" variants of a plain Octopus Go search.
3. **Rates**: the product document is fetched to resolve the region-specific tariff code and
   standing charge, then the day's half-hourly unit rates are fetched from
   `standard-unit-rates`, following the API's pagination links. Newer four-rate Intelligent Go
   products that only publish flat day/night rates fall back to the family's published
   overnight window.
4. **Normalisation**: rates are turned into 48 half-hour slots for the `Europe/London` day
   (46 or 50 on DST transition days), always VAT-inclusive (`value_inc_vat`).
5. **Off-peak**: Intelligent Go marks the fixed **23:30–05:30** window as off-peak, and
   Octopus Go the fixed **00:30–05:30** window. Agile has no fixed window, so each half-hour is
   compared against the day's average price (cheaper half-hours are highlighted).
6. **Export**: for Agile, the matching **Agile Outgoing** product is discovered and its
   half-hourly export rates are fetched the same way, then rendered as a second chart beneath
   the import curve.

The Octopus API is CORS-enabled (`Access-Control-Allow-Origin: *`), so everything runs in the
browser — there is no backend and no API key required.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev) (runes)
- [LayerChart](https://layerchart.com) (D3-based) for the chart
- TypeScript, Vitest + Testing Library, ESLint + Prettier
- [`@sveltejs/adapter-cloudflare`](https://svelte.dev/docs/kit/adapter-cloudflare)

## Getting started

This project uses [pnpm](https://pnpm.io) (pinned via the `packageManager` field).

```bash
pnpm install
pnpm dev      # start the dev server
```

Then open the printed URL and enter a UK postcode.

> **Note:** `esbuild` and `workerd` (a dependency of `wrangler`) need to run their install
> scripts. This is pre-approved in `pnpm-workspace.yaml` via `allowBuilds`, so a fresh
> `pnpm install` builds them automatically — no `pnpm approve-builds` prompt.

## Scripts

| Script               | Description                               |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Start the Vite dev server                 |
| `pnpm build`         | Production build (Cloudflare output)      |
| `pnpm preview`       | Preview the production build              |
| `pnpm check`         | Type-check with `svelte-check`            |
| `pnpm test`          | Run the unit and component tests (Vitest) |
| `pnpm test:watch`    | Run tests in watch mode                   |
| `pnpm test:coverage` | Run tests with a coverage report          |
| `pnpm lint`          | Prettier check + ESLint                   |
| `pnpm format`        | Format with Prettier                      |

## Deployment (Cloudflare Pages)

This project uses `@sveltejs/adapter-cloudflare`, so it deploys to Cloudflare Pages via git
integration. Cloudflare detects pnpm from `pnpm-lock.yaml`.

1. Push this repository to GitHub/GitLab.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and use these build settings:

   | Setting                | Value                    |
   | ---------------------- | ------------------------ |
   | Framework preset       | SvelteKit                |
   | Build command          | `pnpm run build`         |
   | Build output directory | `.svelte-kit/cloudflare` |
   | Node version           | `22` (see `.nvmrc`)      |

4. Save and deploy. Every push to the production branch triggers a new deployment.

## Project structure

```
src/
├── app.css                     # design tokens & global styles
├── app.html
├── lib/
│   ├── octopus/                # pure domain layer (fetch + normalise Octopus data)
│   │   ├── client.ts           # typed fetch wrapper w/ retry
│   │   ├── postcode.ts         # validate / normalise UK postcodes
│   │   ├── region.ts           # postcode → region letter
│   │   ├── families.ts         # tariff families (Intelligent Go, Go, Agile)
│   │   ├── product.ts          # discover products per tariff family
│   │   ├── prices.ts           # day prices (schedule + derived fallback)
│   │   ├── schedule.ts         # off-peak rules, half-hour slots, current slot
│   │   └── types.ts
│   ├── state/
│   │   ├── tariff.svelte.ts    # reactive store: postcode, product, prices, refresh
│   │   └── serialization.ts    # localStorage (de)serialisation
│   ├── utils/                  # timezone + formatting helpers
│   └── components/             # StatusBar, FamilyToggle, CurrentPriceCard, PriceChart, …
├── routes/
│   ├── +layout.ts              # ssr = false, prerender = true
│   ├── +layout.svelte
│   └── +page.svelte            # the single-page dashboard
└── test/                       # shared test helpers & setup
```

The domain layer (`src/lib/octopus`, `src/lib/utils`) is deliberately kept free of Svelte and
browser-only APIs so it can be unit-tested with plain Vitest and mocked `fetch`.

## Disclaimer

Not affiliated with, endorsed by, or connected to Octopus Energy. Prices are provided for
information only and are not a substitute for your bill.
