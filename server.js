import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { XMLParser } from "fast-xml-parser";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// ========== POSTGRES ==========
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS strava_activities (
      id BIGINT PRIMARY KEY,
      name TEXT, type TEXT, emoji TEXT, date TEXT, distance TEXT,
      duration TEXT, pace TEXT, elevation INT, heartrate INT,
      calories INT, moving_time INT, start_date TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      name TEXT, area TEXT, rating REAL, price INT, category TEXT,
      address TEXT, photo TEXT, website TEXT,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (name, area)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      name TEXT PRIMARY KEY,
      date TEXT, time TEXT, venue TEXT, category TEXT, genre TEXT,
      image TEXT, url TEXT, price_min REAL, price_max REAL,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sports (
      id TEXT PRIMARY KEY,
      data JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stocks (
      symbol TEXT, range_key TEXT,
      rank INT, price REAL, change_val REAL, pct REAL, sparkline JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (symbol, range_key)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Additive migrations — safe to run repeatedly
  await pool.query(`ALTER TABLE user_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`);
  await pool.query(`ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`);
  // Seed defaults (won't overwrite existing)
  const defaults = [
    ['display_name', '"User"'],
    ['app_title', '"My Dashboard"'],
    ['pin_hash', '""'],
    ['location', '{"city":"Hoboken, NJ","lat":40.744,"lon":-74.032,"address":"The White House, 1600 Pennsylvania Ave NW, Washington, DC"}'],
    ['visible_sections', '["weather","strava","path","ferry","bus","news","stocks","sports","events","restaurants"]'],
  ];
  for (const [key, val] of defaults) {
    await pool.query("INSERT INTO user_config (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING", [key, val]);
  }

  // Warm caches from DB on startup
  try {
    const rr = await pool.query("SELECT * FROM restaurants");
    if (rr.rows.length > 0) { cachedRestaurants = rr.rows; lastRestaurantFetch = Date.now(); }
  } catch {}
  try {
    const er = await pool.query("SELECT * FROM events WHERE date >= $1 ORDER BY date ASC", [new Date().toISOString().split("T")[0]]);
    if (er.rows.length > 0) {
      cachedEvents = er.rows.map(r => ({ name: r.name, date: r.date, time: r.time, venue: r.venue, category: r.category, genre: r.genre, image: r.image, url: r.url, priceMin: r.price_min, priceMax: r.price_max }));
      lastEventFetch = Date.now();
    }
  } catch {}
  try {
    const sr = await pool.query("SELECT data FROM sports WHERE id = 'all'");
    if (sr.rows.length > 0) { cachedSports = sr.rows[0].data; lastSportsFetch = Date.now(); }
  } catch {}
  try {
    for (const rangeKey of ['1d','5d','1mo','1y']) {
      const stockr = await pool.query("SELECT *, MAX(fetched_at) OVER (PARTITION BY range_key) as latest_fetch FROM stocks WHERE range_key = $1 ORDER BY rank ASC", [rangeKey]);
      if (stockr.rows.length > 0) {
        cachedStocksMap[rangeKey] = stockr.rows.map(r => ({ rank: r.rank, symbol: r.symbol, price: r.price, change: r.change_val, pct: r.pct, sparkline: r.sparkline }));
        lastStockFetchMap[rangeKey] = new Date(stockr.rows[0].latest_fetch).getTime();
      }
    }
  } catch {}
}
initDb()
  .then(() => {
    // After DB is ready and cache is warmed, start background refresh jobs
    // Fetch all 4 stock ranges every 15 minutes
    setInterval(async () => {
      for (const rangeKey of ['1d', '5d', '1mo', '1y']) {
        await fetchAndCacheStocks(rangeKey);
        await new Promise(r => setTimeout(r, 2000)); // stagger to avoid rate limits
      }
    }, 900000); // 15 min

    // Pre-warm on startup for any ranges not already in cache
    setTimeout(async () => {
      for (const rangeKey of ['1d', '5d', '1mo', '1y']) {
        if (!cachedStocksMap[rangeKey]) {
          await fetchAndCacheStocks(rangeKey);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }, 5000); // 5s after startup
  })
  .catch(e => console.error("DB init failed:", e.message));

// ========== USER CONFIG ==========
let cachedConfig = null;

const DEFAULT_CONFIG = {
  display_name: "User",
  app_title: "My Dashboard",
  pin_hash: "",
  location: { city: "Hoboken, NJ", lat: 40.744, lon: -74.032, address: "The White House, 1600 Pennsylvania Ave NW, Washington, DC" },
  visible_sections: ["weather","strava","path","ferry","bus","news","stocks","sports","events","restaurants"],
};

async function getConfig() {
  if (cachedConfig) return cachedConfig;
  if (!pool) return { ...DEFAULT_CONFIG };
  try {
    const { rows } = await pool.query("SELECT key, value FROM user_config");
    cachedConfig = { ...DEFAULT_CONFIG, ...Object.fromEntries(rows.map(r => [r.key, r.value])) };
    return cachedConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

app.get("/api/config", async (req, res) => {
  const cfg = await getConfig();
  const { pin_hash, ...safe } = cfg;
  safe.pin_hash_set = Boolean(pin_hash);
  res.json(safe);
});

app.post("/api/config", async (req, res) => {
  const patch = req.body || {};
  const updates = { ...patch };
  if (updates.pin !== undefined) {
    updates.pin_hash = updates.pin ? await bcrypt.hash(String(updates.pin), 10) : "";
    delete updates.pin;
  }
  if (pool) {
    try {
      for (const [key, value] of Object.entries(updates)) {
        await pool.query(
          "INSERT INTO user_config (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()",
          [key, JSON.stringify(value)]
        );
      }
    } catch (e) { console.error("Config write failed:", e.message); }
  }
  cachedConfig = null; // invalidate
  const cfg = await getConfig();
  const { pin_hash, ...safe } = cfg;
  res.json(safe);
});

app.post("/api/config/verify-pin", async (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.json({ valid: false });
  const cfg = await getConfig();
  if (!cfg.pin_hash) return res.json({ valid: true }); // no PIN set
  const valid = await bcrypt.compare(String(pin), cfg.pin_hash);
  res.json({ valid });
});

// ========== AUTH ==========
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
  if (!pool) return res.status(503).json({ error: "database unavailable" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email.toLowerCase().trim(), hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "email already registered" });
    console.error("Signup failed:", e.message);
    res.status(500).json({ error: "signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (!pool) return res.status(503).json({ error: "database unavailable" });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (result.rows.length === 0) return res.status(401).json({ error: "invalid credentials" });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "invalid credentials" });
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error("Login failed:", e.message);
    res.status(500).json({ error: "login failed" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ userId: req.user.userId, email: req.user.email });
});


const PANYNJ_API = "https://www.panynj.gov/bin/portauthority/ridepath.json";

let cachedData = null;
let lastFetch = 0;

async function fetchPathData() {
  const now = Date.now();
  if (cachedData && now - lastFetch < 15000) return cachedData;

  try {
    const url = `${PANYNJ_API}?timeStamp=${now}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    cachedData = data;
    lastFetch = now;
    return data;
  } catch (err) {
    console.error("Error fetching PATH data:", err.message);
    return cachedData || { results: [] };
  }
}

app.get("/api/path/hoboken", async (req, res) => {
  const data = await fetchPathData();
  const hob = (data.results || []).find(s => s.consideredStation === "HOB");
  if (!hob) return res.json({ timestamp: new Date().toISOString(), toNY: [], toNJ: [] });

  const parse = (msgs) => (msgs || []).map(m => ({
    headsign: m.headSign,
    secondsAway: parseInt(m.secondsToArrival, 10),
    minsAway: Math.max(0, Math.round(parseInt(m.secondsToArrival, 10) / 60)),
    arrivalTimeMessage: m.arrivalTimeMessage,
    lineColor: "#" + m.lineColor.split(",")[0],
    lineColors: m.lineColor.split(",").map(c => "#" + c),
    lastUpdated: m.lastUpdated,
    target: m.target,
  }));

  const toNY = parse(hob.destinations?.find(d => d.label === "ToNY")?.messages);
  const toNJ = parse(hob.destinations?.find(d => d.label === "ToNJ")?.messages);

  // 33rd St has live ToNJ data that HOB lacks
  const s33 = (data.results || []).find(s => s.consideredStation === "33S");
  const toNJFrom33S = parse(s33?.destinations?.find(d => d.label === "ToNJ")?.messages);

  res.json({ timestamp: new Date().toISOString(), dataFetchedAt: lastFetch, station: "Hoboken", toNY, toNJ, toNJFrom33S });
});

const TOP_100 = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","BRK-B","TSLA","AVGO","JPM",
  "LLY","V","UNH","XOM","MA","COST","PG","JNJ","ABBV","WMT",
  "HD","BAC","MRK","CVX","ORCL","CRM","KO","NFLX","AMD","PEP",
  "TMO","ACN","MCD","CSCO","IBM","ABT","LIN","WFC","DIS","GE",
  "PM","ADBE","TXN","VZ","AMGN","MS","GS","INTC","CAT","RTX",
  "INTU","BKNG","ISRG","SPGI","BLK","QCOM","T","DHR","NOW","AMAT",
  "PLD","SYK","AXP","ETN","PANW","LOW","NEE","UNP","HON","VRTX",
  "TJX","BSX","GILD","MDT","DE","MU","BMY","SCHW","MMC","LRCX",
  "C","ADI","ELV","TMUS","PGR","CB","SO","DUK","AMT","AON",
  "ICE","USB","SBUX","CME","WM","PH","GD","NOC","HCA","SOFI","PLTR",
];

const STOCK_RANGE_CONFIG = {
  '1d':  { interval: '5m',  range: '1d' },
  '5d':  { interval: '1h',  range: '5d' },
  '1mo': { interval: '1d',  range: '1mo' },
  '1y':  { interval: '1wk', range: '1y' },
};
const cachedStocksMap = {};
const lastStockFetchMap = {};

async function fetchBatch(symbols, interval, range) {
  return Promise.all(symbols.map(sym =>
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`, { headers: { "User-Agent": "Mozilla/5.0" } })
      .then(r => r.json())
      .catch(() => null)
  ));
}

async function fetchAndCacheStocks(rangeKey = '1mo') {
  const cfg = STOCK_RANGE_CONFIG[rangeKey] || STOCK_RANGE_CONFIG['1mo'];
  const now = Date.now();
  if (cachedStocksMap[rangeKey] && now - (lastStockFetchMap[rangeKey] || 0) < 900000) return;
  try {
    const all = [];
    const batchSize = 10;
    for (let i = 0; i < TOP_100.length; i += batchSize) {
      const batch = await fetchBatch(TOP_100.slice(i, i + batchSize), cfg.interval, cfg.range);
      all.push(...batch);
      if (i + batchSize < TOP_100.length) await new Promise(r => setTimeout(r, 150));
    }
    const result = all.map((data, idx) => {
      const meta = data?.chart?.result?.[0]?.meta;
      const closes = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
      if (!meta?.regularMarketPrice) return null;
      const prev = meta.chartPreviousClose || closes[closes.length - 2] || meta.regularMarketPrice;
      return {
        rank: idx + 1,
        symbol: meta.symbol,
        price: meta.regularMarketPrice,
        change: meta.regularMarketPrice - prev,
        pct: ((meta.regularMarketPrice - prev) / prev) * 100,
        sparkline: closes,
      };
    }).filter(Boolean);
    if (result.length > 0) {
      cachedStocksMap[rangeKey] = result;
      lastStockFetchMap[rangeKey] = now;
      if (pool) {
        try {
          await pool.query("DELETE FROM stocks WHERE range_key = $1", [rangeKey]);
          for (const s of result) {
            await pool.query(
              "INSERT INTO stocks (symbol, range_key, rank, price, change_val, pct, sparkline) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (symbol, range_key) DO UPDATE SET rank=$3, price=$4, change_val=$5, pct=$6, sparkline=$7, fetched_at=NOW()",
              [s.symbol, rangeKey, s.rank, s.price, s.change, s.pct, JSON.stringify(s.sparkline)]
            );
          }
        } catch (e) { console.error("Stocks DB write failed:", e.message); }
      }
    }
  } catch (e) {
    console.error("Stock fetch failed:", e.message);
  }
}

app.get("/api/stocks", async (req, res) => {
  const rangeKey = req.query.range || '1mo';
  await fetchAndCacheStocks(rangeKey);
  res.json(cachedStocksMap[rangeKey] || []);
});

const FOURSQUARE_KEY = process.env.FOURSQUARE_KEY;
const DEFAULT_RESTAURANT_LOCATIONS = [
  { label: "Hoboken", ll: "40.7440,-74.0324", radius: 1500 },
  { label: "Manhattan", ll: "40.7549,-73.9840", radius: 2000 },
];

let cachedRestaurants = null;
let lastRestaurantFetch = 0;

app.get("/api/restaurants", async (req, res) => {
  const now = Date.now();
  if (cachedRestaurants && now - lastRestaurantFetch < 3600000) return res.json(cachedRestaurants);

  try {
    const cfg = await getConfig();
    const locations = cfg.restaurant_locations || DEFAULT_RESTAURANT_LOCATIONS;
    const all = [];
    for (const loc of locations) {
      const url = `https://places-api.foursquare.com/places/search?ll=${loc.ll}&radius=${loc.radius}&categories=13065,13031,13236,13064&sort=RATING&limit=50&fields=name,rating,price,categories,location,photos,website,tel`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${FOURSQUARE_KEY}`, Accept: "application/json", "X-Places-Api-Version": "2025-06-17" } });
      if (!r.ok) throw new Error(`Foursquare HTTP ${r.status}`);
      const data = await r.json();
      const NON_RESTAURANT = /bar|pub|brewery|lounge|nightclub|club|cafe|coffee|bakery|dessert|ice cream|juice|smoothie|food truck|market|grocery|deli|bodega|convenience/i;
      for (const place of data.results || []) {
        const cat = place.categories?.[0]?.name || "";
        if (NON_RESTAURANT.test(cat)) continue;
        all.push({
          name: place.name,
          area: loc.label,
          rating: place.rating || null,
          price: place.price || null,
          category: cat || "Restaurant",
          address: place.location?.formatted_address || place.location?.address || "",
          photo: place.photos?.[0] ? `${place.photos[0].prefix}300x200${place.photos[0].suffix}` : null,
          website: place.website || null,
        });
      }
    }
    if (all.length > 0) {
      cachedRestaurants = all;
      lastRestaurantFetch = now;
      if (pool) {
        try {
          await pool.query("DELETE FROM restaurants");
          for (const r of all) {
            await pool.query(
              "INSERT INTO restaurants (name, area, rating, price, category, address, photo, website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (name, area) DO UPDATE SET rating=$3, price=$4, category=$5, address=$6, photo=$7, website=$8, fetched_at=NOW()",
              [r.name, r.area, r.rating, r.price, r.category, r.address, r.photo, r.website]
            );
          }
        } catch (e) { console.error("Restaurants DB write failed:", e.message); }
      }
    }
    res.json(cachedRestaurants || []);
  } catch (e) {
    console.error("Restaurant fetch failed:", e.message);
    res.json(cachedRestaurants || []);
  }
});

const TICKETMASTER_KEY = process.env.TICKETMASTER_KEY;
let cachedEvents = null;
let lastEventFetch = 0;

app.get("/api/events", async (req, res) => {
  const now = Date.now();
  if (cachedEvents && now - lastEventFetch < 3600000) return res.json(cachedEvents);

  try {
    const start = new Date().toISOString().split(".")[0] + "Z";
    const end = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().split(".")[0] + "Z";
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?city=New+York&countryCode=US&startDateTime=${start}&endDateTime=${end}&size=50&sort=date,asc&apikey=${TICKETMASTER_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Ticketmaster HTTP ${r.status}`);
    const data = await r.json();
    const events = (data._embedded?.events || []).map(e => ({
      name: e.name,
      date: e.dates?.start?.localDate,
      time: e.dates?.start?.localTime || null,
      venue: e._embedded?.venues?.[0]?.name || null,
      category: e.classifications?.[0]?.segment?.name || "Event",
      genre: e.classifications?.[0]?.genre?.name || null,
      image: e.images?.find(i => i.ratio === "16_9" && i.width > 300)?.url || e.images?.[0]?.url || null,
      url: e.url || null,
      priceMin: e.priceRanges?.[0]?.min || null,
      priceMax: e.priceRanges?.[0]?.max || null,
    }));
    // Deduplicate by name — keep the earliest occurrence
    const seen = new Set();
    const deduped = events.filter(e => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });
    if (deduped.length > 0) {
      cachedEvents = deduped;
      lastEventFetch = now;
      if (pool) {
        try {
          await pool.query("DELETE FROM events");
          for (const e of deduped) {
            await pool.query(
              "INSERT INTO events (name, date, time, venue, category, genre, image, url, price_min, price_max) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (name) DO UPDATE SET date=$2, time=$3, venue=$4, category=$5, genre=$6, image=$7, url=$8, price_min=$9, price_max=$10, fetched_at=NOW()",
              [e.name, e.date, e.time, e.venue, e.category, e.genre, e.image, e.url, e.priceMin, e.priceMax]
            );
          }
        } catch (e) { console.error("Events DB write failed:", e.message); }
      }
    }
    res.json(cachedEvents || []);
  } catch (e) {
    console.error("Events fetch failed:", e.message);
    res.json(cachedEvents || []);
  }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let cachedBriefing = null;
let lastBriefingPeriod = null;

function getTimePeriod() {
  const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

app.get("/api/briefing", async (req, res) => {
  const period = `${new Date().toDateString()}-${getTimePeriod()}`;
  if (cachedBriefing && lastBriefingPeriod === period) return res.json(cachedBriefing);

  try {
    const cfg = await getConfig();
    const name = cfg.display_name || "User";
    const { lat = 40.744, lon = -74.032, city = "Hoboken, NJ" } = cfg.location || {};
    // Gather context from cached data and external APIs
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=2`).then(r => r.json()).catch(() => ({})),
    ]);

    const hob = (pathData.results || []).find(s => s.consideredStation === "HOB");
    const toNYMsgs = hob?.destinations?.find(d => d.label === "ToNY")?.messages || [];
    const pathRes = { toNY: toNYMsgs.map(m => ({ headsign: m.headSign, secondsAway: parseInt(m.secondsToArrival, 10) })) };
    const stocksRes = cachedStocksMap['1mo'] || [];
    const eventsRes = cachedEvents || [];

    const temp = weatherRes?.current?.temperature_2m;
    const wind = weatherRes?.current?.windspeed_10m;
    const rainChance = weatherRes?.daily?.precipitation_probability_max?.[0];
    const hiTemp = weatherRes?.daily?.temperature_2m_max?.[0];
    const loTemp = weatherRes?.daily?.temperature_2m_min?.[0];
    const topStocks = (stocksRes || []).slice(0, 5).map(s => `${s.symbol} ${s.pct >= 0 ? "+" : ""}${s.pct?.toFixed(1)}%`).join(", ");
    const todayEvents = (eventsRes || []).filter(e => e.date === new Date().toISOString().split("T")[0]).slice(0, 3).map(e => e.name).join(", ");
    const nextTrains = (pathRes?.toNY || []).slice(0, 2).map(t => `${t.headsign} in ${Math.round(t.secondsAway / 60)}min`).join(", ");
    const topHeadlines = (cachedNews || []).slice(0, 5).map(n => n.title).join("; ");

    const timePeriod = getTimePeriod();
    const greeting = timePeriod === "morning" ? "Good morning" : timePeriod === "afternoon" ? "Good afternoon" : "Good evening";
    const prompt = `You are a friendly ${timePeriod} assistant for ${name}, who lives in ${city} and commutes to NYC.

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} (${timePeriod}). Start the briefing with "${greeting}, ${name}!".

Current conditions:
- Weather: ${temp}°F, high ${hiTemp}°F / low ${loTemp}°F, wind ${wind} mph, ${rainChance}% chance of rain
- Next PATH trains to NYC: ${nextTrains || "no data"}
- Market snapshot: ${topStocks || "no data"}
- Events in NYC today: ${todayEvents || "none found"}
- Top news headlines: ${topHeadlines || "none available"}

Write a short, upbeat ${timePeriod} briefing in 3-4 sentences. For morning: cover weather, commute, and the day ahead. For afternoon: check in on the day, weather, and any evening plans. For evening: wrap up the day, tomorrow's weather outlook, and a wind-down note. Be conversational and concise. End with one short motivational or witty line. Do not use markdown, headers, or bullet points — plain text only.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    cachedBriefing = {
      text: message.content[0].text.replace(/^#+\s*/gm, "").trim(),
      generatedAt: new Date().toISOString(),
    };
    lastBriefingPeriod = period;
    res.json(cachedBriefing);
  } catch (e) {
    console.error("Briefing failed:", e.message);
    res.json({ text: "Good morning! Have a great day.", generatedAt: new Date().toISOString(), error: e.message });
  }
});

let cachedWeatherNarrative = null;
let lastWeatherNarrativeFetch = 0;

app.get("/api/weather-narrative", async (req, res) => {
  const now = Date.now();
  if (cachedWeatherNarrative && now - lastWeatherNarrativeFetch < 1800000) return res.json(cachedWeatherNarrative);

  try {
    const { lat = 40.744, lon = -74.032 } = req.query;
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=2`
    );
    const w = await weatherRes.json();
    const cur = w.current;
    const today = { hi: w.daily?.temperature_2m_max?.[0], lo: w.daily?.temperature_2m_min?.[0], rain: w.daily?.precipitation_probability_max?.[0], code: w.daily?.weathercode?.[0] };
    const tomorrow = { hi: w.daily?.temperature_2m_max?.[1], lo: w.daily?.temperature_2m_min?.[1], rain: w.daily?.precipitation_probability_max?.[1] };

    const prompt = `You are a concise weather assistant. Write a single, punchy 1-2 sentence weather narrative for right now. Focus on what matters: how it feels outside, whether to grab an umbrella, and any notable condition. Be direct and conversational — no fluff.

Current: ${cur.temperature_2m}°F, feels like ${cur.apparent_temperature}°F, wind ${cur.windspeed_10m} mph
Today: high ${today.hi}°F / low ${today.lo}°F, ${today.rain}% rain chance
Tomorrow: high ${tomorrow.hi}°F / low ${tomorrow.lo}°F, ${tomorrow.rain}% rain chance

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    cachedWeatherNarrative = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastWeatherNarrativeFetch = now;
    res.json(cachedWeatherNarrative);
  } catch (e) {
    console.error("Weather narrative failed:", e.message);
    res.json(cachedWeatherNarrative || { text: "", generatedAt: new Date().toISOString() });
  }
});

let cachedStockDigest = null;
let lastStockDigestFetch = 0;

app.get("/api/stock-digest", async (req, res) => {
  const now = Date.now();
  if (cachedStockDigest && now - lastStockDigestFetch < 1800000) return res.json(cachedStockDigest);

  if (!cachedStocksMap['1mo'] || cachedStocksMap['1mo'].length === 0) await fetchAndCacheStocks('1mo');
  const stocks = cachedStocksMap['1mo'];
  if (!stocks || stocks.length === 0) return res.json({ text: "", generatedAt: new Date().toISOString() });

  try {
    const sorted = [...stocks].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const topMovers = sorted.slice(0, 8).map(s => `${s.symbol} ${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(1)}%`).join(", ");
    const gainers = stocks.filter(s => s.pct > 0).length;
    const losers = stocks.filter(s => s.pct < 0).length;

    const prompt = `You are a terse market analyst. Write a single 1-2 sentence stock digest covering today's top movers and overall market tone. Be specific and punchy — name the biggest mover and say why if it's obvious from the move size.

Top movers (by % change): ${topMovers}
Breadth: ${gainers} gainers, ${losers} decliners out of ${stocks.length} tracked

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    cachedStockDigest = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastStockDigestFetch = now;
    res.json(cachedStockDigest);
  } catch (e) {
    console.error("Stock digest failed:", e.message);
    res.json(cachedStockDigest || { text: "", generatedAt: new Date().toISOString() });
  }
});

app.get("/api/path/all", async (req, res) => {
  const data = await fetchPathData();
  res.json(data);
});

const RSS_FEEDS = [
  { name: "Reuters",    category: "World",    url: "https://feeds.reuters.com/reuters/topNews" },
  { name: "AP News",    category: "World",    url: "https://feeds.apnews.com/rss/topnews" },
  { name: "NY Times",   category: "World",    url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
  { name: "CNBC",       category: "Business", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "WSJ Markets",category: "Business", url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines" },
  { name: "NYT Tech",   category: "Tech",     url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml" },
  { name: "The Verge",  category: "Tech",     url: "https://www.theverge.com/rss/index.xml" },
  { name: "NY Times",   category: "NYC",      url: "https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml" },
  { name: "Gothamist",  category: "NYC",      url: "https://gothamist.com/feed" },
];

let cachedNews = null;
let lastNewsFetch = 0;

app.get("/api/news", async (req, res) => {
  const now = Date.now();
  if (cachedNews && now - lastNewsFetch < 1800000) return res.json(cachedNews);

  const parser = new XMLParser({ ignoreAttributes: false });
  const allItems = [];

  for (const feed of RSS_FEEDS) {
    try {
      const r = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = await r.text();
      const parsed = parser.parse(xml);
      const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      for (const item of (Array.isArray(items) ? items : [items]).slice(0, 6)) {
        const title = item.title?.["#text"] || item.title?.toString().replace(/<[^>]*>/g, "").trim() || "";
        if (!title) continue;
        allItems.push({
          title,
          link: item.link?.["@_href"] || item.link || item.guid?.["#text"] || item.guid || "",
          source: feed.name,
          category: feed.category,
          pubDate: item.pubDate || item.updated || item.published || null,
        });
      }
    } catch (e) {
      console.error(`RSS fetch failed for ${feed.name}:`, e.message);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  if (allItems.length > 0) {
    cachedNews = allItems;
    lastNewsFetch = now;
  }
  res.json(cachedNews || []);
});

const SPORTS = [
  { key: "nba", sport: "basketball", league: "nba", label: "NBA" },
  { key: "nfl", sport: "football",   league: "nfl", label: "NFL" },
  { key: "mlb", sport: "baseball",   league: "mlb", label: "MLB" },
];

let cachedSports = null;
let lastSportsFetch = 0;

app.get("/api/sports", async (req, res) => {
  const now = Date.now();
  if (cachedSports && now - lastSportsFetch < 1800000) return res.json(cachedSports);

  const fetchLeague = async ({ key, sport, league, label }) => {
    try {
      const base = `https://site.api.espn.com/apis/v2/sports/${sport}/${league}`;
      const [standRes, newsRes] = await Promise.all([
        fetch(`${base}/standings`, { headers: { "User-Agent": "Mozilla/5.0" } }),
        fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/news?limit=5`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      ]);
      const standData = await standRes.json();
      const newsData = await newsRes.json();

      const teams = [];
      for (const group of (standData.children || [])) {
        for (const div of (group.children || group.standings ? [group] : [])) {
          for (const entry of (div.standings?.entries || [])) {
            const stats = {};
            for (const s of (entry.stats || [])) stats[s.name] = s.displayValue;
            teams.push({
              name: entry.team?.shortDisplayName || entry.team?.displayName,
              abbr: entry.team?.abbreviation,
              logo: entry.team?.logos?.[0]?.href,
              wins: stats.wins || stats.W || "0",
              losses: stats.losses || stats.L || "0",
              pct: stats.winPercent || stats.PCT || "",
              gb: stats.gamesBehind || stats.GB || "",
              group: group.name || "",
            });
          }
        }
      }

      const news = (newsData.articles || []).slice(0, 5).map(a => ({
        headline: a.headline,
        link: a.links?.web?.href || "",
        date: a.published,
      }));

      return [key, { label, teams, news }];
    } catch (e) {
      console.error(`Sports fetch failed for ${key}:`, e.message);
      return [key, { label, teams: [], news: [] }];
    }
  };

  const entries = await Promise.all(SPORTS.map(fetchLeague));
  const result = Object.fromEntries(entries);

  if (Object.values(result).some(r => r.teams.length > 0)) {
    cachedSports = result;
    lastSportsFetch = now;
    if (pool) {
      try {
        await pool.query(
          "INSERT INTO sports (id, data) VALUES ('all', $1) ON CONFLICT (id) DO UPDATE SET data=$1, fetched_at=NOW()",
          [JSON.stringify(result)]
        );
      } catch (e) { console.error("Sports DB write failed:", e.message); }
    }
  }
  res.json(cachedSports || {});
});

let cachedCommuteAdvice = null;
let lastCommuteAdviceFetch = 0;

app.get("/api/commute-advice", async (req, res) => {
  const now = Date.now();
  if (cachedCommuteAdvice && now - lastCommuteAdviceFetch < 300000) return res.json(cachedCommuteAdvice);

  try {
    const cfg = await getConfig();
    const { lat = 40.744, lon = -74.032, city = "Hoboken, NJ" } = cfg.location || {};
    const name = cfg.display_name || "User";
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,precipitation&hourly=precipitation_probability&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`).then(r => r.json()).catch(() => ({})),
    ]);

    const hob = (pathData.results || []).find(s => s.consideredStation === "HOB");
    const toNYMsgs = hob?.destinations?.find(d => d.label === "ToNY")?.messages || [];
    const next3Path = toNYMsgs.slice(0, 3).map(m => ({
      headsign: m.headSign,
      minsAway: Math.max(0, Math.round(parseInt(m.secondsToArrival, 10) / 60)),
      arrivalTimeMessage: m.arrivalTimeMessage,
    }));

    const currentHour = new Date().getHours();
    const nextFewHoursPrecip = (weatherRes?.hourly?.precipitation_probability || []).slice(currentHour, currentHour + 3);
    const rainSoon = nextFewHoursPrecip.some(p => p > 40);
    const currentTemp = weatherRes?.current?.temperature_2m;

    const pathSummary = next3Path.length > 0
      ? next3Path.map(t => `${t.headsign} in ${t.minsAway} min`).join(", ")
      : "no PATH data";

    const prompt = `You are a commute assistant for ${name} in ${city}. Give a single-sentence commute recommendation.

Next PATH trains to NYC: ${pathSummary}
Current temp: ${currentTemp != null ? currentTemp + "°F" : "unknown"}
Rain expected soon: ${rainSoon ? "yes" : "no"}

Write one concise sentence recommending the best way to commute right now. Example: "Take the 8:12 PATH to 33rd — ferry isn't for another 18 minutes and rain is expected by 9am." Plain text only.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [{ role: "user", content: prompt }],
    });

    cachedCommuteAdvice = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastCommuteAdviceFetch = now;
    res.json(cachedCommuteAdvice);
  } catch (e) {
    console.error("Commute advice failed:", e.message);
    res.json(cachedCommuteAdvice || { text: "", generatedAt: new Date().toISOString() });
  }
});

let cachedSportsRecap = null;
let lastSportsRecapFetch = 0;

app.get("/api/sports-recap", async (req, res) => {
  const now = Date.now();
  if (cachedSportsRecap && now - lastSportsRecapFetch < 3600000) return res.json(cachedSportsRecap);

  try {
    const [nbaRes, nflRes, mlbRes] = await Promise.all([
      fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.json()).catch(() => ({})),
      fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.json()).catch(() => ({})),
      fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.json()).catch(() => ({})),
    ]);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const extractGames = (data, leagueLabel) => {
      return (data.events || [])
        .filter(e => {
          if (!e.status?.type?.completed) return false;
          const d = new Date(e.date || e.competitions?.[0]?.date);
          return !isNaN(d) && d.getTime() >= thirtyDaysAgo;
        })
        .map(e => {
          const comps = e.competitions?.[0]?.competitors || [];
          const home = comps.find(c => c.homeAway === "home");
          const away = comps.find(c => c.homeAway === "away");
          const dateStr = new Date(e.date || e.competitions?.[0]?.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `${leagueLabel} (${dateStr}): ${away?.team?.shortDisplayName || "?"} ${away?.score || "?"} @ ${home?.team?.shortDisplayName || "?"} ${home?.score || "?"}`;
        });
    };

    const allGames = [
      ...extractGames(nbaRes, "NBA"),
      ...extractGames(nflRes, "NFL"),
      ...extractGames(mlbRes, "MLB"),
    ];

    if (allGames.length === 0) return res.json({ text: "" });

    const prompt = `You are a sports analyst. Write exactly 2 sentences summarizing the most notable results below. Be concise — do not exceed 2 sentences. Only reference these specific games.

Completed games (last 30 days):
${allGames.slice(0, 10).join("\n")}

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    cachedSportsRecap = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastSportsRecapFetch = now;
    res.json(cachedSportsRecap);
  } catch (e) {
    console.error("Sports recap failed:", e.message);
    res.json(cachedSportsRecap || { text: "", generatedAt: new Date().toISOString() });
  }
});

let cachedRestaurantPick = null;
let lastRestaurantPickFetch = 0;

app.get("/api/restaurant-pick", async (req, res) => {
  const now = Date.now();
  if (cachedRestaurantPick && now - lastRestaurantPickFetch < 10800000) return res.json(cachedRestaurantPick);
  if (!cachedRestaurants || cachedRestaurants.length === 0) return res.json({ text: "" });

  try {
    const hour = new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
    const timeOfDay = parseInt(hour) < 12 ? "morning" : parseInt(hour) < 17 ? "afternoon" : "evening";
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.744&longitude=-74.032&current=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=America/New_York").then(r => r.json()).catch(() => ({}));
    const temp = weatherRes?.current?.temperature_2m;

    const picks = cachedRestaurants
      .filter(r => r.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20)
      .map(r => `${r.name} | ${r.area} | ${r.category} | ${r.price ? "$".repeat(r.price) : "?"} | ★${r.rating?.toFixed(1)}`);

    const prompt = `You are a local food expert. Based on the time of day and weather, recommend 1 specific restaurant from the list below in a single enthusiastic sentence. Include the restaurant name and why it fits right now.

Time: ${timeOfDay}, ${temp != null ? temp + "°F" : "unknown temp"}
Restaurants (name | area | category | price | rating):
${picks.join("\n")}

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    cachedRestaurantPick = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastRestaurantPickFetch = now;
    res.json(cachedRestaurantPick);
  } catch (e) {
    console.error("Restaurant pick failed:", e.message);
    res.json(cachedRestaurantPick || { text: "" });
  }
});

let cachedEventPicks = null;
let lastEventPicksFetch = 0;

app.get("/api/event-picks", async (req, res) => {
  const now = Date.now();
  if (cachedEventPicks && now - lastEventPicksFetch < 10800000) return res.json(cachedEventPicks);

  if (!cachedEvents || cachedEvents.length === 0) return res.json({ text: "" });

  try {
    const today = new Date();
    const weekOut = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const upcoming = cachedEvents
      .filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date + "T12:00:00");
        return d >= today && d <= weekOut;
      })
      .slice(0, 15)
      .map(e => `${e.name} | ${e.date} | ${e.venue || "TBD"} | ${e.genre || e.category || ""}`);

    if (upcoming.length === 0) return res.json({ text: "" });

    const prompt = `You are an event curator. Recommend 1-2 of the events below that best match my preferences. Write 1-2 sentences max with specific event names, dates, and venues. Do not ask questions or request more info — only use the events listed.

My preferences: I like live music, food events, comedy, and unique NYC experiences. I'm less interested in sports events.

Upcoming events (name | date | venue | genre):
${upcoming.join("\n")}

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    cachedEventPicks = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastEventPicksFetch = now;
    res.json(cachedEventPicks);
  } catch (e) {
    console.error("Event picks failed:", e.message);
    res.json(cachedEventPicks || { text: "", generatedAt: new Date().toISOString() });
  }
});

let cachedNewsDigest = null;
let lastNewsDigestFetch = 0;

app.get("/api/news-digest", async (req, res) => {
  const now = Date.now();
  if (cachedNewsDigest && now - lastNewsDigestFetch < 1800000) return res.json(cachedNewsDigest);

  if (!cachedNews || cachedNews.length === 0) return res.json({ text: "" });

  try {
    const headlines = cachedNews.slice(0, 10).map(n => `[${n.source}] ${n.title}`).join("\n");

    const prompt = `You are a news analyst. Write 2 sentences summarizing what's happening today based on these top headlines.

Headlines:
${headlines}

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });

    cachedNewsDigest = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastNewsDigestFetch = now;
    res.json(cachedNewsDigest);
  } catch (e) {
    console.error("News digest failed:", e.message);
    res.json(cachedNewsDigest || { text: "", generatedAt: new Date().toISOString() });
  }
});

let cachedDayPlan = null;
let lastDayPlanPeriod = null;

app.get("/api/day-plan", async (req, res) => {
  const period = `${new Date().toDateString()}-${getTimePeriod()}`;
  if (cachedDayPlan && lastDayPlanPeriod === period) return res.json(cachedDayPlan);

  try {
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=40.744&longitude=-74.032&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America/New_York&forecast_days=1").then(r => r.json()).catch(() => ({})),
    ]);

    const hob = (pathData.results || []).find(s => s.consideredStation === "HOB");
    const toNYMsgs = hob?.destinations?.find(d => d.label === "ToNY")?.messages || [];
    const nextTrain = toNYMsgs[0]
      ? `${toNYMsgs[0].headSign} in ${Math.round(parseInt(toNYMsgs[0].secondsToArrival, 10) / 60)} min`
      : "no PATH data";

    const temp = weatherRes?.current?.temperature_2m;
    const hiTemp = weatherRes?.daily?.temperature_2m_max?.[0];
    const loTemp = weatherRes?.daily?.temperature_2m_min?.[0];

    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = (cachedEvents || [])
      .filter(e => e.date === todayStr)
      .slice(0, 5)
      .map(e => `${e.name}${e.time ? " at " + e.time : ""}${e.venue ? " @ " + e.venue : ""}`);

    const topRestaurants = (cachedRestaurants || [])
      .filter(r => r.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3)
      .map(r => `${r.name} (${r.category}, ${r.area}${r.rating ? ", ★" + r.rating.toFixed(1) : ""})`);

    const prompt = `You are a friendly life assistant for someone in Hoboken, NJ. Based on the data below, suggest a fun, practical plan for today in 2-3 sentences. Include a specific transit option, a meal or activity suggestion, and something to look forward to. Be warm and specific.

Current weather: ${temp != null ? temp + "°F" : "unknown"}, high ${hiTemp != null ? hiTemp + "°F" : "unknown"} / low ${loTemp != null ? loTemp + "°F" : "unknown"}
Next PATH train: ${nextTrain}
Top events today: ${todayEvents.length > 0 ? todayEvents.join("; ") : "none found"}
Top restaurant picks: ${topRestaurants.length > 0 ? topRestaurants.join("; ") : "none available"}

Plain text only, no markdown.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    cachedDayPlan = { text: message.content[0].text.trim(), generatedAt: new Date().toISOString() };
    lastDayPlanPeriod = period;
    res.json(cachedDayPlan);
  } catch (e) {
    console.error("Day plan failed:", e.message);
    res.json(cachedDayPlan || { text: "", generatedAt: new Date().toISOString() });
  }
});

app.post("/api/ask", async (req, res) => {
  const { query, history = [] } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: "query required" });

  try {
    const cfg = await getConfig();
    const name = cfg.display_name || "User";
    const { lat = 40.744, lon = -74.032, address = "Hoboken, NJ", city = "Hoboken, NJ" } = cfg.location || {};
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`).then(r => r.json()).catch(() => ({})),
    ]);

    // PATH trains
    const hob = (pathData.results || []).find(s => s.consideredStation === "HOB");
    const toNYMsgs = hob?.destinations?.find(d => d.label === "ToNY")?.messages || [];
    const toNJMsgs = hob?.destinations?.find(d => d.label === "ToNJ")?.messages || [];
    const pathToNY = toNYMsgs.slice(0, 3).map(m => `${m.headSign} in ${Math.round(parseInt(m.secondsToArrival, 10) / 60)} min`).join("; ") || "none";
    const pathToNJ = toNJMsgs.slice(0, 2).map(m => `${m.headSign} in ${Math.round(parseInt(m.secondsToArrival, 10) / 60)} min`).join("; ") || "none";

    // Weather
    const temp = weatherRes?.current?.temperature_2m;
    const wind = weatherRes?.current?.windspeed_10m;
    const hiTemp = weatherRes?.daily?.temperature_2m_max?.[0];
    const loTemp = weatherRes?.daily?.temperature_2m_min?.[0];
    const rainPct = weatherRes?.daily?.precipitation_probability_max?.[0];
    const tomorrowHi = weatherRes?.daily?.temperature_2m_max?.[1];
    const tomorrowRain = weatherRes?.daily?.precipitation_probability_max?.[1];

    // Stocks
    const stocks1mo = cachedStocksMap['1mo'] || [];
    const topMovers = [...stocks1mo].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 10)
      .map(s => `${s.symbol} ${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(1)}%`).join(", ");
    const topGainers = [...stocks1mo].sort((a, b) => b.pct - a.pct).slice(0, 5)
      .map(s => `${s.symbol} +${s.pct.toFixed(1)}%`).join(", ");
    const topLosers = [...stocks1mo].sort((a, b) => a.pct - b.pct).slice(0, 5)
      .map(s => `${s.symbol} ${s.pct.toFixed(1)}%`).join(", ");

    // Events
    const todayStr = new Date().toISOString().split("T")[0];
    const upcomingEvents = (cachedEvents || [])
      .filter(e => e.date >= todayStr)
      .slice(0, 10)
      .map(e => `${e.name} on ${e.date}${e.time ? " at " + e.time : ""}${e.venue ? " @ " + e.venue : ""}${e.priceMin ? " from $" + Math.round(e.priceMin) : ""}`);

    // Restaurants
    const restaurants = (cachedRestaurants || [])
      .filter(r => r.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10)
      .map(r => `${r.name} (${r.category}, ${r.location}, ${r.rating}★)`);

    // News
    const newsHeadlines = (cachedNews || []).slice(0, 15)
      .map(n => `[${n.category}] ${n.title} (${n.source})`);

    // Sports
    const sportsCtx = Object.entries(cachedSports || {}).map(([key, data]) => {
      const top5 = data.teams.slice(0, 5).map(t => `${t.name} ${t.wins}-${t.losses}`).join(", ");
      const headlines = (data.news || []).slice(0, 2).map(h => h.headline).join("; ");
      return `${data.label}: ${top5}${headlines ? " | News: " + headlines : ""}`;
    }).join("\n");

    // Strava
    const stravaCtx = cachedStrava ? (() => {
      const recent = (cachedStrava.activities || []).slice(0, 5)
        .map(a => `${a.name} (${a.type}, ${(a.distance / 1000).toFixed(1)}km, ${Math.round(a.moving_time / 60)}min${a.calories ? ", " + a.calories + "cal" : ""})`).join("; ");
      const totalCal = (cachedStrava.activities || []).reduce((s, a) => s + (a.calories || 0), 0);
      return `Weekly workouts: ${cachedStrava.weeklyCount} | Recent: ${recent}${totalCal ? " | Total calories: " + totalCal : ""}`;
    })() : "no data";

    const systemPrompt = `You are ${name}'s personal assistant. ${name} lives at ${address}. Be helpful and thorough — 5-10 sentences when useful, shorter for simple questions. Use web search for anything needing current information. Reference the dashboard data below directly when relevant.

=== LIVE DASHBOARD DATA ===

WEATHER (${city}):
- Now: ${temp != null ? temp + "°F" : "unknown"}, wind ${wind != null ? wind + " mph" : "unknown"}
- Today: High ${hiTemp != null ? hiTemp + "°F" : "?"} / Low ${loTemp != null ? loTemp + "°F" : "?"}, rain ${rainPct != null ? rainPct + "%" : "?"}
- Tomorrow: High ${tomorrowHi != null ? tomorrowHi + "°F" : "?"}, rain ${tomorrowRain != null ? tomorrowRain + "%" : "?"}

PATH TRAINS (Hoboken Terminal):
- To NYC: ${pathToNY}
- To NJ: ${pathToNJ}

STOCKS (top movers): ${topMovers || "no data"}
- Gainers: ${topGainers}
- Losers: ${topLosers}

UPCOMING EVENTS:
${upcomingEvents.length > 0 ? upcomingEvents.join("\n") : "none found"}

RESTAURANTS (top-rated nearby):
${restaurants.length > 0 ? restaurants.join("\n") : "none available"}

NEWS HEADLINES:
${newsHeadlines.length > 0 ? newsHeadlines.join("\n") : "no news loaded"}

SPORTS STANDINGS:
${sportsCtx || "no data"}

FITNESS (Strava): ${stravaCtx}`;

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: query },
    ];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    const textBlock = message.content.filter(b => b.type === "text").pop();
    res.json({ answer: textBlock?.text?.trim() || "" });
  } catch (e) {
    console.error("Ask failed:", e.message);
    res.status(500).json({ error: e.message });
  }
});

let stravaAccessToken = null;
let stravaTokenExpiry = 0;
let cachedStrava = null;
let lastStravaFetch = 0;

async function getStravaAccessToken() {
  if (stravaAccessToken && Date.now() < stravaTokenExpiry - 60000) return stravaAccessToken;
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  stravaAccessToken = data.access_token;
  stravaTokenExpiry = data.expires_at * 1000;
  return stravaAccessToken;
}

const fmt = (meters) => (meters / 1609.34).toFixed(2);
const fmtPace = (metersPerSec) => {
  const secsPerMile = 1609.34 / metersPerSec;
  const m = Math.floor(secsPerMile / 60);
  const s = Math.round(secsPerMile % 60).toString().padStart(2, "0");
  return `${m}:${s}/mi`;
};
const fmtDuration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const typeEmoji = { Run: "🏃", Ride: "🚴", Swim: "🏊", Walk: "🚶", Hike: "🥾", Workout: "💪" };

function buildStravaResponse(rows) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyCount = rows.filter(a => new Date(a.date + "T00:00:00") >= sevenDaysAgo).length;
  const chartDays = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    const dayActivities = rows.filter(a => a.date === dateStr);
    const mins = dayActivities.reduce((sum, a) => {
      const parts = a.duration?.match(/(\d+)h\s*(\d+)m|(\d+)m/);
      if (!parts) return sum;
      return sum + (parts[1] ? parseInt(parts[1]) * 60 + parseInt(parts[2]) : parseInt(parts[3]));
    }, 0);
    const cal = dayActivities.reduce((sum, a) => sum + (a.calories || 0), 0);
    chartDays.push({ day: label, mins: mins || null, cal: cal || null });
  }
  return { activities: rows, weeklyCount, chartData: chartDays, fetchedAt: new Date().toISOString() };
}

app.get("/api/strava", async (req, res) => {
  const now = Date.now();
  if (cachedStrava && now - lastStravaFetch < 3600000) return res.json(cachedStrava);

  // No DB available — fall back to full direct fetch
  if (!pool) return fetchStravaDirectly(res, now);

  try {
    const latestRow = await pool.query("SELECT start_date FROM strava_activities ORDER BY start_date DESC LIMIT 1");
    const afterTs = latestRow.rows[0]?.start_date
      ? Math.floor(new Date(latestRow.rows[0].start_date).getTime() / 1000)
      : 0;

    const token = await getStravaAccessToken();
    const url = afterTs > 0
      ? `https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${afterTs}`
      : `https://www.strava.com/api/v3/athlete/activities?per_page=50`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const newActivities = await r.json().catch(() => []);
    const fetched = Array.isArray(newActivities) ? newActivities : [];

    if (fetched.length > 0) {
      const details = await Promise.all(fetched.map(a =>
        fetch(`https://www.strava.com/api/v3/activities/${a.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).catch(() => ({}))
      ));
      for (let i = 0; i < fetched.length; i++) {
        const a = fetched[i];
        const detail = details[i] || {};
        const type = a.sport_type || a.type;
        await pool.query(`
          INSERT INTO strava_activities (id, name, type, emoji, date, distance, duration, pace, elevation, heartrate, calories, moving_time, start_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET calories = EXCLUDED.calories, name = EXCLUDED.name
        `, [
          a.id, a.name, type, typeEmoji[type] || "🏅",
          a.start_date_local?.split("T")[0],
          a.distance > 0 ? fmt(a.distance) : null,
          fmtDuration(a.moving_time),
          a.average_speed > 0 && type === "Run" ? fmtPace(a.average_speed) : null,
          a.total_elevation_gain > 0 ? Math.round(a.total_elevation_gain * 3.281) : null,
          a.average_heartrate ? Math.round(a.average_heartrate) : null,
          detail.calories ? Math.round(detail.calories) : (a.kilojoules ? Math.round(a.kilojoules / 4.184) : null),
          a.moving_time, a.start_date,
        ]);
      }
    }

    const { rows } = await pool.query("SELECT * FROM strava_activities ORDER BY start_date DESC LIMIT 50");
    cachedStrava = buildStravaResponse(rows);
    lastStravaFetch = now;
    res.json(cachedStrava);
  } catch (e) {
    console.error("Strava/DB failed:", e.message);
    try {
      const { rows } = await pool.query("SELECT * FROM strava_activities ORDER BY start_date DESC LIMIT 50");
      if (rows.length > 0) { cachedStrava = buildStravaResponse(rows); return res.json(cachedStrava); }
    } catch {}
    return fetchStravaDirectly(res, now);
  }
});

async function fetchStravaDirectly(res, now) {
  try {
    const token = await getStravaAccessToken();
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activities = await r.json();
    const allActivities = Array.isArray(activities) ? activities : [];
    const top20 = allActivities.slice(0, 20);
    const details = await Promise.all(top20.map(a =>
      fetch(`https://www.strava.com/api/v3/activities/${a.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).catch(() => ({}))
    ));
    const result = allActivities.map((a, i) => {
      const detail = details[i] || {};
      const type = a.sport_type || a.type;
      return {
        id: a.id, name: a.name, type, emoji: typeEmoji[type] || "🏅",
        date: a.start_date_local?.split("T")[0],
        distance: a.distance > 0 ? fmt(a.distance) : null,
        duration: fmtDuration(a.moving_time),
        pace: a.average_speed > 0 && type === "Run" ? fmtPace(a.average_speed) : null,
        elevation: a.total_elevation_gain > 0 ? Math.round(a.total_elevation_gain * 3.281) : null,
        heartrate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        calories: detail.calories ? Math.round(detail.calories) : (a.kilojoules ? Math.round(a.kilojoules / 4.184) : null),
      };
    });
    cachedStrava = buildStravaResponse(result);
    lastStravaFetch = now;
    res.json(cachedStrava);
  } catch (e) {
    console.error("Strava direct fetch failed:", e.message);
    res.json(cachedStrava || { activities: [], weeklyCount: 0, chartData: [] });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", source: "panynj.gov", time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`PATH proxy running on http://localhost:${PORT}`);
  console.log(`  Source: ${PANYNJ_API}`);
  console.log(`  Hoboken: http://localhost:${PORT}/api/path/hoboken`);
});
