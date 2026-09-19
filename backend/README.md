# Megatron Backend

Production backend for the Megatron Analysis Tool: Node.js + Express + MongoDB,
a live Deriv WebSocket connection, a real analysis engine, JWT auth, and an
admin API.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI, JWT secrets, DERIV_APP_ID, etc.
npm run seed:admin   # creates/promotes the admin account from .env
npm start            # or: npm run dev (nodemon)
```

The server also statically serves the existing frontend (`index.html`,
`pages/`, `css/`, `js/`) from one origin, so in production you can point a
single domain at this server and both the site and the API work from it.
For local development you can instead keep using a separate static server
(Live Server, `npx serve`) for the frontend and set `CORS_ORIGIN` in `.env`
to that origin.

### Getting a Deriv app_id

Market-data endpoints (`ticks`, `ticks_history`) work with Deriv's default
demo `app_id=1089`, but for anything beyond local testing, register your own
app at https://api.deriv.com (free) and put it in `DERIV_APP_ID`. No user
API token is required for public tick data.

## Architecture

```
backend/
  server.js              Express app wiring, security middleware, static hosting
  config/db.js            Mongoose connection + status helper
  services/derivService.js   Persistent Deriv WebSocket client, per-symbol tick buffers
  services/analysisEngine.js Digit distribution, pattern scoring, signal generation
  models/                  User, Watchlist, AnalysisResult, SystemLog (Mongoose schemas)
  middleware/auth.js        JWT issue/verify, requireAuth, requireAdmin, optionalAuth
  middleware/errorHandler.js Centralized error responses
  controllers/, routes/     REST endpoints, grouped by resource
  utils/seedAdmin.js        One-time admin bootstrap script
```

Data flow for live analysis: `derivService` holds one WebSocket connection
to Deriv per server process, subscribed to the symbols in `DERIV_SYMBOLS`,
and keeps the last `TICK_BUFFER_SIZE` ticks per symbol in memory.
`analysisEngine` computes statistics directly from that buffer on request —
digit frequency, even/odd and over/under splits, streaks, and heuristic
pattern scores. `POST /api/analysis` combines these into a signal +
confidence estimate and stores the result in MongoDB when a user is logged
in (or when `save` isn't set to `false`).

## API reference

All routes are under `/api`. Authenticated routes expect
`Authorization: Bearer <accessToken>`.

### Auth — `/api/auth`
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/register` | – | `{ name, email, password }` |
| POST | `/login` | – | `{ email, password }` |
| POST | `/refresh` | – | `{ refreshToken }` |
| POST | `/logout` | ✓ | – |
| GET  | `/me` | ✓ | – |

### Markets — `/api/markets`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | List of tracked symbols with live price/change/volatility |
| GET | `/quote?symbol=R_10` | Latest tick for one symbol |
| GET | `/status` | Deriv connection status + buffered tick counts |

### Analysis — `/api/analysis`
| Method | Path | Notes |
|---|---|---|
| GET | `/digits?symbol=R_10` | Last-digit distribution (0-9) + even/odd split |
| GET | `/patterns?symbol=R_10` | Heuristic pattern scores + current streaks |
| POST | `/` | `{ symbol, strategy, barrier?, targetDigit?, barrierPrice?, save? }` → signal + confidence. Attaches to history if logged in. |

`strategy` is one of `Even/Odd`, `Over/Under`, `Matches/Differs`,
`Rise/Fall`, `Higher/Lower` (matches the frontend's strategy list).

### Watchlist — `/api/watchlist` (auth required)
`GET /`, `POST /` (`{ symbol, label?, note? }`), `DELETE /:id`

### History — `/api/history` (auth required)
`GET /?limit=&page=&symbol=&strategy=`, `DELETE /` (clear all), `DELETE /:id`

### Preferences — `/api/preferences` (auth required)
`GET /`, `PUT /` (`{ theme?, defaultMarket?, defaultStrategy?, notifications?, riskWarningsAcknowledged? }`),
`PUT /profile` (`{ name }`)

### Admin — `/api/admin` (auth + admin role required)
`GET /users?q=&page=&limit=`, `PATCH /users/:id/status`, `PATCH /users/:id/role`,
`DELETE /users/:id`, `GET /analyses?limit=`, `GET /status`, `GET /logs?level=&category=`,
`GET /stats`

## Security notes

- Passwords are hashed with bcrypt (12 rounds); plaintext is never stored or logged.
- Access tokens are short-lived (15m default); refresh tokens are versioned per-user
  so `logout` (or an admin suspending an account) invalidates all outstanding sessions.
- `helmet`, `express-mongo-sanitize`, and per-route rate limiting are enabled by default.
- Deriv credentials/app_id stay server-side; the browser never talks to Deriv directly.
- Rotate `ADMIN_SEED_PASSWORD` (or remove it from `.env`) immediately after running `seed:admin`.

## Honesty about signals

Per the frontend README's existing "Risk/accuracy" note: confidence values
here are descriptive statistics about recently observed frequency/streaks in
live tick data, not a predictive guarantee. Nothing in this backend should be
presented to end users as a guarantee of trading outcomes.
