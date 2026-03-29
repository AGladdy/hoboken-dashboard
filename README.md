# Hoboken Dashboard

A personal real-time dashboard showing stocks, weather, transit, and sports — built for living in Hoboken, NJ.

## What's in it

- **Stocks** — SOFI, NVDA, AMD, PLTR with live prices (via Alpha Vantage)
- **Weather** — Current conditions + 4-day forecast (via Open-Meteo, free, no key)
- **PATH trains** — Real-time arrivals from Hoboken to NYC (via Razza API, free, no key)
- **NY Waterway ferry** — Schedule-based departures to Midtown & Brookfield Place
- **NJ Transit Bus 126** — Schedule-based departures to Port Authority / 42nd St
- **Live clock** — Ticks every second, all countdowns update in real-time

## Quick start

```bash
# Clone or download this folder, then:
npm install
npm run dev
```

Opens at `http://localhost:3000`

## Deploy to Vercel (free, recommended)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click "New Project" → import your repo
4. Vercel auto-detects Vite — just click Deploy
5. Done. You get a URL like `hoboken-dashboard.vercel.app`

## Deploy to Netlify (free, alternative)

1. Push to GitHub
2. Go to [netlify.com](https://netlify.com), sign in
3. "Add new site" → "Import from Git" → select repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Deploy

## Run on a Raspberry Pi / always-on display

```bash
# On your Pi:
git clone <your-repo-url>
cd hoboken-dashboard
npm install
npm run build
npx serve dist -l 3000

# Then open http://<pi-ip>:3000 in a browser
# Use Chromium in kiosk mode for a dedicated display:
chromium-browser --kiosk http://localhost:3000
```

## API keys & configuration

Edit the `CONFIG` object at the top of `src/Dashboard.jsx`:

### Stocks (Alpha Vantage)
- Free key at [alphavantage.co](https://www.alphavantage.co/support/#api-key)
- 5 calls/min, 500/day on free tier — plenty for a personal dashboard
- Replace `"demo"` with your key:
  ```js
  ALPHA_VANTAGE_KEY: "YOUR_KEY_HERE",
  ```

### Weather (Open-Meteo)
- Completely free, no key needed
- Already configured for Hoboken coordinates

### PATH trains (Razza API)
- Free, no key needed
- Returns real-time arrival data from the RidePATH system
- Falls back to estimated schedule times if API is unreachable

### NJ Transit Bus 126
- Currently using hardcoded schedule estimates
- To upgrade: register at [developer.njtransit.com](https://developer.njtransit.com) for GTFS data
- Download the bus GTFS zip → parse `stop_times.txt` for route 126 from Hoboken Terminal
- If they provide GTFS-RT, you can add real-time bus tracking

### Sports scores (future)
- Add [ESPN](https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard) or [SportRadar](https://developer.sportradar.com/) for live scores
- ESPN's public endpoint works without a key for basic scores

## Adding sports scores

ESPN has an unofficial public API. Add this to your dashboard:

```js
// MLB scores
const MLB_API = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";
// NBA scores  
const NBA_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

const res = await fetch(MLB_API);
const data = await res.json();
// data.events contains all games with scores
```

## Customization ideas

- Add more stocks to the `STOCKS` array
- Change coordinates in `WEATHER_API` for a different location
- Add NJ Transit rail, light rail, or other bus routes
- Add a news feed section
- Add Spotify now-playing widget
- Style it with your own color scheme

## Tech

- React 18 + Vite
- No external UI libraries — pure inline styles
- Dark theme by default
- All transit countdowns tick every second
- PATH API polled every 30 seconds
- Weather + stocks refresh every 5 minutes
