# MEGATRON ANALYSIS TOOL

A complete frontend prototype for a futuristic market-analysis platform built with **HTML5, CSS3 and Vanilla JavaScript**.

## Included

- Premium responsive landing page
- Dashboard
- Market browser
- Analyzer with animated analysis flow
- Deep Algorithmic Analysis UI
- Live-market-feed UI (demo mode)
- Trading Patterns
- Digit Probability
- AI Analysis
- Signals
- Interactive chart workspace
- Analysis history with localStorage
- Watchlist-ready architecture
- Profile
- Settings
- Admin dashboard
- 3D/glassmorphism effects
- Mobile bottom navigation
- API-ready JavaScript data-service layer

## Run

Open `index.html` in a browser, or serve the folder with any static web server.

Example:

```bash
npx serve .
```

or use VS Code Live Server.

## Backend (production-ready layer)

A complete backend now lives in `backend/` — Node.js/Express, MongoDB
(Mongoose), a persistent Deriv WebSocket connection, a real analysis engine
(digit distribution, pattern scoring, signal generation from live ticks),
JWT authentication, persistent watchlists/history/preferences, and an admin
API (user management, analysis monitoring, system status, logs, platform
stats). See `backend/README.md` for setup and the full API reference.

`js/api.js` now talks to this backend (`/api/...`) instead of only being
API-ready. Pages still fall back to their bundled demo state (`js/app.js`)
if a page hasn't been wired up to call `MegatronAPI` yet — see
"Frontend wiring status" below.

## Important: Demo vs Live Data

This build intentionally uses **DEMO** market values in `js/app.js`. It does not pretend that sample values are live Deriv data. With the backend running, `MegatronAPI` (`js/api.js`) can fetch real values from `/api/markets`, `/api/analysis/digits`, `/api/analysis/patterns`, and `POST /api/analysis` instead.

Remaining steps for a full production cutover:

1. Run the backend (`backend/README.md`) with a real MongoDB Atlas cluster and your own Deriv `app_id`.
2. Wire each page's script to call `MegatronAPI` instead of (or in addition to) the demo `MEGATRON` object in `js/app.js` — the digit chart, pattern list, market table, and analyzer are the main candidates.
3. Test the analysis logic against historical data before describing confidence scores as meaningful, and keep the existing "Risk/accuracy" framing below in front of users.

### Frontend wiring status

`js/api.js` exposes every backend endpoint (auth, markets, analysis, watchlist,
history, preferences, admin). The page scripts in `js/app.js` still render the
original demo data by default so the UI keeps working standalone; hook the
pages you want live (e.g. `pages/analyzer.html`, `pages/dashboard.html`) up to
`MegatronAPI` calls as you adopt the backend.

## Risk/accuracy

Megatron is an analysis/decision-support interface. It does not guarantee market direction, profit, or trading success. Confidence values in the prototype are illustrative UI values and should not be presented as verified accuracy.

## Structure

- `index.html` — landing page
- `pages/` — application pages
- `css/` — styles
- `js/app.js` — frontend interactions/demo state
- `js/api.js` — data-service layer, calls the backend API
- `assets/` — assets directory
- `backend/` — Node.js/Express/MongoDB backend, Deriv integration, analysis engine, auth, admin API (see `backend/README.md`)
