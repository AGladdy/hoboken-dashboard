# Personal Dashboard

A real-time personal dashboard built with React + Vite (frontend) and Express (backend). Displays live transit, weather, stocks, news, sports, fitness, events, and restaurants — all in one place. Fully configurable via a settings panel.

---

## Features

- **Transit** — Live PATH train arrivals, NY Waterway ferry schedules, NJ Transit bus times
- **Weather** — Current conditions + 5-day forecast with emoji icons (Open-Meteo)
- **Stocks** — Top 100 S&P stocks with sortable table and 1D/1W/1M/1Y sparklines (Yahoo Finance)
- **News** — Top headlines by category (World, Business, Tech, NYC) via RSS
- **Sports** — NBA/NFL/MLB standings and news (ESPN)
- **Fitness** — Strava activity feed with calories, pace, bar chart, pagination
- **Events** — Upcoming NYC events (Ticketmaster)
- **Restaurants** — Top-rated nearby restaurants (Foursquare)
- **AI Search Bar** — Ask anything with full dashboard context + web search (Claude Sonnet)
- **Drag-to-reorder** sections with cross-column support, persisted to localStorage
- **Dark/light mode**
- **PWA-ready** with favicon and web manifest
- **Settings panel** — configure name, location, PIN lock, visible sections

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Mantine v8, @dnd-kit, Recharts |
| Backend | Express (ESM), Node 18+ |
| Database | PostgreSQL |
| AI | Anthropic Claude Sonnet + web search tool |
| Hosting | Railway (backend), AWS Amplify (frontend) |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/AGladdy/hoboken-dashboard.git
cd hoboken-dashboard
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root:

```env
# Required — AI search bar
ANTHROPIC_API_KEY=sk-ant-...

# Required — Strava fitness section
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REFRESH_TOKEN=

# Required — events section
TICKETMASTER_KEY=

# Required — restaurants section
FOURSQUARE_KEY=

# Required — database persistence
DATABASE_URL=postgresql://...

# Optional — defaults to 3002
PORT=3002
```

### 3. Set up PostgreSQL

The app uses Postgres to persist Strava activities, stocks, restaurants, events, sports data, and user config across server restarts. All tables are created automatically on first boot.

**Option A — Railway (recommended):**
1. In your Railway project, click **+ New → Database → PostgreSQL**
2. Go to your server service → **Variables** → **Add Reference** → select `DATABASE_URL`

**Option B — Local:**
```bash
createdb dashboard
DATABASE_URL=postgresql://localhost/dashboard npm run server
```

### 4. Run locally

```bash
npm run dev
```

Starts both the Vite dev server (port 5173) and Express backend (port 3002) concurrently.

### 5. Configure your dashboard

On first launch, click **⚙** in the top-right header to open Settings:

- **Profile** — Set your name and dashboard title
- **Location** — Set your city, lat/lng, and address (used for weather and AI prompts)
- **PIN** — Optionally set a 4-digit lock PIN
- **Sections** — Toggle which sections are visible

---

## API Keys

### Anthropic (AI search bar)
1. Go to [console.anthropic.com](https://console.anthropic.com) → create an API key
2. Set as `ANTHROPIC_API_KEY`

### Strava (fitness)
1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) → create an app
2. Set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`
3. Complete the OAuth flow to get a refresh token → set as `STRAVA_REFRESH_TOKEN`
   - See [Strava's getting started guide](https://developers.strava.com/docs/getting-started/)

### Ticketmaster (events)
1. Go to [developer.ticketmaster.com](https://developer.ticketmaster.com) → create an app
2. Set the API key as `TICKETMASTER_KEY`

### Foursquare (restaurants)
1. Go to [foursquare.com/developers](https://foursquare.com/developers) → create an app
2. Set the Places API key as `FOURSQUARE_KEY`

---

## Deploying

### Backend — Railway

1. Push your repo to GitHub
2. Railway → **New Project** → **Deploy from GitHub repo** → select your repo
3. Add all environment variables from the list above
4. Add the PostgreSQL plugin and link `DATABASE_URL` as a reference variable
5. Railway auto-detects `npm start` → runs `node server.js`

### Frontend — AWS Amplify

1. AWS Amplify → **New App** → **Host web app** → connect your GitHub repo
2. Use these build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
3. Add environment variable: `VITE_API_BASE=https://your-railway-app.up.railway.app`

---

## Project Structure

```
hoboken-dashboard/
├── server.js              # Express backend — all API routes
├── src/
│   ├── main.jsx           # App entry point, PIN lock screen
│   ├── Dashboard.jsx      # Main dashboard component
│   ├── ConfigContext.jsx  # Config state + save/load API wrapper
│   └── SettingsModal.jsx  # Settings UI (profile, location, PIN, sections)
├── public/                # Favicon, web manifest
├── index.html
└── vite.config.js
```

---

## Customization

### Change the default location

Open Settings → Location in the dashboard UI, or update the DB directly:

```sql
UPDATE user_config
SET value = '{"city":"Brooklyn, NY","lat":40.6782,"lon":-73.9442,"address":"Brooklyn, NY"}'::jsonb
WHERE key = 'location';
```

### Change the stock watchlist

Edit the `TOP_100` array near the top of `server.js`. Any Yahoo Finance ticker symbol works.

### Toggle sections

Use Settings → Sections to show/hide any section. The `visible_sections` array is stored in the DB and takes effect immediately.

### Transit schedules

Ferry and bus schedules are currently hardcoded to Hoboken Terminal routes in `src/Dashboard.jsx` (`FERRY_SCHEDULES`, `BUS_126`). If you're not in Hoboken, disable those sections via Settings → Sections. Custom schedule support is planned.

---

## License

MIT
