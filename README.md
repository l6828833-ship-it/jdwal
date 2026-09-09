# جدول — Live Football Scores

Dark-themed, Arabic (RTL) live football scores app. Next.js App Router + Tailwind v4.

## Quick start (no API, no key)

```bash
# 1. backend
cd path/to/SportScore-main && npm install && npm start    # :4000

# 2. app
cd path/to/jdwal && npm install && npm run dev            # :3000
```

That's it. The backend defaults to `SOURCE=scrape`, which scrapes BBC Sport web
pages — no API, no key, no account, no quota. Switch to `espn` for crests, venues
and match statistics (still no key), or to `apifootball` with a key for
everything. See the table below.

## Data providers

Everything reads through `lib/provider.ts`, never a provider module directly, so
the backend is an env change (`SPORTS_PROVIDER` in `.env.local`).

| Provider | Quota | Why |
| --- | --- | --- |
| `selfhosted` (default) | your own key | Your SportScore instance proxying API-Football. Covers every capability this app renders, from one set of ids. |
| `highlightly` | 100/**day** | Fixtures with league names, grouped standings, match stats, player search. No teams/roster, no leaderboards, no team country. |
| `footballdata` | 1000/month | Good league/team browsing. No referee, no match clock, no leaderboards, 5 leagues on the free tier. |
| `rapidapi` | 100/month | Live clock only; league names not resolvable — not recommended. |

### Why self-hosted is the default

The three hosted providers each had gaps, and the gaps did not overlap. The app
ended up running **three of them at once**: fixtures from one, standings and
player search pinned to Highlightly, leagues and teams pinned to Footballdata.io.

That caused a real, silent bug. None of them number competitions or teams the
same way, so a team link built from a Highlightly standings row resolved against
a Footballdata team page and landed on the wrong club or a 404. Routing
everything through one backend removes that whole class of failure.

Capabilities the self-hosted backend adds over every hosted option:

| Field | Hosted providers | `selfhosted` |
| --- | --- | --- |
| Live match clock | derived from kickoff (an estimate) | **real** (`status.elapsed`) |
| Halftime score | no | **yes** |
| Referee | no | **yes** |
| Venue | detail only, or never | **yes** |
| Goal events | goals only, no own-goal/penalty distinction | **yes, typed** |
| Standings group names | discarded | **kept**, one table per group |
| Top scorers | no endpoint anywhere | **yes** |
| Team country on list rows | null (no flags) | **yes** |
| Competitions | 5–9 | **~1200** |

## The backend has three sources

`SOURCE` in the backend's `.env` decides where its data comes from. All three emit
identical response shapes, so switching needs no change in this app.

| | `scrape` (default) | `espn` | `apifootball` |
| --- | --- | --- | --- |
| API used | **none** | public JSON | API-Football |
| API key | **none** | none | required |
| Quota | none | none | 100/day free |
| Live scores, real clock | yes | yes | yes |
| Goals, cards, half-time scores | yes | yes | yes |
| Standings | 17 competitions | yes | yes |
| Team crests | **no** (initials shown) | yes | yes |
| Venue / referee | **no** | yes | yes |
| Match statistics | **no** (tab hidden) | yes | yes |
| Player search | **no** | yes | yes |
| Top scorers | **no** | **no** | yes |
| Competitions | every one BBC lists | ~48 | ~1200 |

The UI states each gap rather than faking it: crests fall back to initials, the
statistics tab hides itself, and the players and scorers pages say the feature is
unavailable from the active source instead of reporting "no results".

Check which is live:

```bash
curl localhost:4000/health     # look for "source" and "ready": true
```

To switch to API-Football, get a key from
[dashboard.api-football.com](https://dashboard.api-football.com) or
[RapidAPI](https://rapidapi.com/api-sports/api/api-football), then in the
backend's `.env`:

```bash
SOURCE=apifootball
key=your_key
API_PROVIDER=direct        # or `rapidapi`, matching where the key came from
```

`API_PROVIDER` must match the key's origin. The two gateways need different auth
headers, and the wrong pairing does **not** return an auth error — it returns
HTTP 200 with an empty result set, which looks exactly like "no fixtures today".

The key lives in the backend, not here. A misconfigured backend surfaces its own
message rather than this app guessing at an env var in the wrong project.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Matches by day, grouped by league, live polling |
| `/match/[id]` | Match detail: info card, goals, stats tab |
| `/league/[id]` | League standings + top scorers |
| `/team/[id]` | Team profile, upcoming fixtures, recent results |
| `/teams` | Teams browsed by competition |
| `/leagues` | Competitions |
| `/api/matches?date=YYYY-MM-DD` | Server-cached fixtures feed the client polls |
| `/api/match/[id]` | Server-cached match detail |
| `/api/players?q=` | Player name search (min 4 characters) |

## Request budget — read this first

Self-hosting moves the quota, it does not remove it: API-Football's free tier is
**100 requests/day**. The app is built around a tight budget either way.

- `lib/cache.ts` holds one shared server-side cache. Every visitor polling the
  same date shares a single upstream call, so 100 browsers cost the same as one.
- Concurrent cache misses are coalesced into one request.
- A budget guard stops non-live refreshes at 80% and all upstream traffic at 97%,
  serving cached data instead. Under `selfhosted` the numbers come from the
  backend's `/quota` route, so the guard protects a real figure.
- Polling pauses while the tab is hidden, and only runs when a match is actually
  live or about to start — an idle afternoon costs nothing.
- The live minute advances locally between polls at zero request cost.

Per-page cost under `selfhosted`: a day of fixtures is 1 request, the live
overlay is 1 (shared by all readers), and a match detail page is **1** —
API-Football returns events, statistics and lineups inline when a fixture is
requested by id.

Set the cadence with `NEXT_PUBLIC_LIVE_POLL_SECONDS`.

> This cache is in-memory and per instance. On multi-instance serverless the
> effective upstream rate multiplies by instance count — move the cache and the
> counter to Redis before scaling out. The backend's own cache has the same
> property; give it MongoDB (`DB=`) so it survives restarts.

## Honesty rules

These are deliberate and worth preserving if you change providers.

### Scores are never invented

Some providers return `0-0` for fixtures they haven't ingested, which is
indistinguishable from a real goalless draw by value alone. A score is only
trusted when the provider marks the match finished or reports it live
(`Score.confirmed`). Otherwise the UI shows a placeholder and "بانتظار النتيجة".

### The clock says what it knows

`lib/clock.ts` has two paths. When the provider reports a real minute it is
advanced by wall-clock time since the payload was built — correct through a late
kickoff or a long stoppage. Only when the provider has **no** clock is the minute
estimated from kickoff, and it is never presented as official.

### Missing data is stated, not filled

`LeagueScorers.available: false` means the backend has no leaderboard endpoint,
and the league page says so — as opposed to an empty table, which would imply
nobody has scored. Same rule as the score placeholders.

### Broadcast data is editorial

No mainstream football API exposes TV channels or commentators. `lib/broadcast.ts`
is a hand-maintained map you own, marked `source: "editorial"`, and the UI
discloses this under the info card. Empty the map to remove the feature.

## Configuration

- **League priority** — `POPULAR_LEAGUES` in `lib/config.ts`, most-watched first.
  Reorder to change home page ordering. Each entry lists that competition's id
  for every backend, since they all number them differently.
- **Season** — `SELFHOSTED_SEASON`, as its starting year (`2026` = 2026/2027).
  Blank auto-detects, rolling over in July. Keep it equal to the backend's
  `DEFAULT_SEASON`.
- **Timezone** — `NEXT_PUBLIC_DISPLAY_TIMEZONE` (defaults to `Asia/Riyadh`).
- **Date range** — `DATE_RANGE_DAYS` bounds how far the arrows travel, which also
  stops crawlers walking the calendar and draining the quota.
- **League display caps** — `LEAGUE_LIST_LIMIT` and `TEAM_BROWSE_LEAGUE_LIMIT`.
  API-Football covers ~1200 competitions; both surfaces sort pinned leagues first
  and cap rendering. Only display is limited, never the data.
- **Competition filter** — the backend's `LEAGUE_IDS` restricts which
  competitions it serves at all. Blank means everything.

## Adding another provider

`lib/types.ts` is the contract. Add a module exporting the same functions as
`lib/selfhosted.ts` and returning those types, then add a branch in
`lib/provider.ts`. Nothing above the provider layer changes.

Do not reintroduce per-capability pinning across providers — that is what caused
the id-collision bug described above.
