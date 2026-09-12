# F1 Top-10 Position Predictor

A local (or Vercel-deployed) web app for predicting the top‑10 finishing order of F1 races, with a scoring system and a season-long leaderboard of your own scores.

Predictions are stored **on your device** (browser `localStorage`) — no accounts, no database.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

1. **Pick a season** (2020–2026) — each season shows its full race schedule.
2. **Pick a race** — rounds are marked `OPEN` (still editable) or `CLOSED` (started).
3. **Make your prediction** — 10 dropdown rows, P1–P10, built from that season's driver list.
    - No driver can be used twice (picked drivers are grayed out elsewhere).
    - Assign exactly **one 2x** and **one 3x** multiplier; the other 8 slots stay 1x.
    - Save anytime, edit as often as you like.
4. **Deadline** — the form locks automatically at the race's scheduled start time. The UTC start time from the schedule is shown in your local timezone, with a live countdown. Predictions saved for a closed race are rejected.
5. **Scoring** — once results are published, each slot scores against the driver's **actual classified position** from the full race classification (not just the top 10):
    - Exact match (`actual == slot`) → **10 base points**
    - Off by one (`actual == slot ± 1`) → **5 base points**
    - Anything else, or DNF/DSQ/DNS → **0 base points**
    - Base points × slot multiplier (1x/2x/3x) = slot points; race total is the sum.
    - Lapped drivers _are_ classified (they finished), retirees/DSQs are not.
6. **Leaderboard** — per-race points and max, plus a running season total.

### Example

- VER predicted P1, 3x, finished P1 → `10 × 3 = 30 pts`
- NOR predicted P4, 1x, finished P3 → `5 × 1 = 5 pts`
- PIA predicted P7, 2x, finished P9 → `0 × 2 = 0 pts`

## Data source

[**Jolpica-F1**](https://www.jolpi.ca) (`https://api.jolpi.ca/ergast/f1/`) — the free, open-source, Ergast-compatible API. No API key required.

- `GET /{year}.json` → season schedule
- `GET /{year}/drivers.json` → season driver list
- `GET /{year}/{round}/results.json` → full race classification

Requests are made **server-side** with a custom `User-Agent` (`F1Predictor/1.0`), since browsers forbid setting that header from JavaScript. Responses are cached through Next.js's data cache (`next: { revalidate }`), which keeps usage comfortably under the unauthenticated rate limit (~200 requests/hour). Recent results refresh hourly; the cache persists on Vercel too.

## Architecture

| Layer       | Location                                              | Notes                                                     |
| ----------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Race data   | `lib/jolpica.ts`, `app/api/season`, `app/api/results` | Server-side fetches with User-Agent + revalidation        |
| Scoring     | `lib/score.ts`, `app/api/scores`                      | Pure scoring engine; `scripts/check-score.ts` sanity test |
| Predictions | `lib/local.ts`                                        | `localStorage`, keyed per season/round                    |
| UI          | `app/page.tsx`, `components/F1App.tsx`                | Single-page client app, dark dashboard theme              |

- `GET /api/season?year=2026` → schedule (with start timestamps + lock state) and drivers
- `GET /api/results?year=2026&round=13` → full classification for a race
- `POST /api/scores` → batch-scoring for locked rounds ({year, predictions})

Run the scoring sanity check:

```bash
npm run build          # type-checks everything
node scripts/check-score.ts
```

## Deploy on Vercel

The app is already Vercel-ready — no disk writes, no env vars needed.

```bash
npm run build
git remote add origin <your-repo>
git push
```

Then import the repo at [vercel.com/new](https://vercel.com/new). Or push to a connected git remote and Vercel auto-deploys.

> Predictions live in your browser, so each device has its own leaderboard.

## Notes & tradeoffs

- **Single-user, no accounts** — scores/predictions never leave your browser, so open the app on a new device and you start fresh.
- **Deadline enforcement is client-side** — since predictions are stored locally, the "backend" can't gate writes; the UI re-checks the clock at save time and refuses late saves.
- **Cutoff = scheduled start** — if a race is delayed in real life, the lock stays at the date/time the schedule endpoint reports.
- **Started mid-season?** Only races you predict from then on will appear in the leaderboard (this device has no retroactive history).
