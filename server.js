import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { XMLParser } from "fast-xml-parser";

const app = express();
app.use(cors());
app.use(express.json());

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

let cachedStocks = null;
let lastStockFetch = 0;

async function fetchBatch(symbols) {
  return Promise.all(symbols.map(sym =>
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`, { headers: { "User-Agent": "Mozilla/5.0" } })
      .then(r => r.json())
      .catch(() => null)
  ));
}

async function fetchAndCacheStocks() {
  const now = Date.now();
  if (cachedStocks && now - lastStockFetch < 300000) return;
  try {
    const all = [];
    const batchSize = 10;
    for (let i = 0; i < TOP_100.length; i += batchSize) {
      const batch = await fetchBatch(TOP_100.slice(i, i + batchSize));
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
    if (result.length > 0) { cachedStocks = result; lastStockFetch = now; }
  } catch (e) {
    console.error("Stock fetch failed:", e.message);
  }
}

app.get("/api/stocks", async (req, res) => {
  await fetchAndCacheStocks();
  res.json(cachedStocks || []);
});

const FOURSQUARE_KEY = process.env.FOURSQUARE_KEY;
const RESTAURANT_LOCATIONS = [
  { label: "Hoboken", ll: "40.7440,-74.0324", radius: 1500 },
  { label: "Manhattan", ll: "40.7549,-73.9840", radius: 2000 },
];

let cachedRestaurants = null;
let lastRestaurantFetch = 0;

app.get("/api/restaurants", async (req, res) => {
  const now = Date.now();
  if (cachedRestaurants && now - lastRestaurantFetch < 3600000) return res.json(cachedRestaurants);

  try {
    const all = [];
    for (const loc of RESTAURANT_LOCATIONS) {
      const url = `https://places-api.foursquare.com/places/search?ll=${loc.ll}&radius=${loc.radius}&categories=13065&sort=RATING&limit=30&fields=name,rating,price,categories,location,photos,website,tel`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${FOURSQUARE_KEY}`, Accept: "application/json", "X-Places-Api-Version": "2025-06-17" } });
      if (!r.ok) throw new Error(`Foursquare HTTP ${r.status}`);
      const data = await r.json();
      for (const place of data.results || []) {
        all.push({
          name: place.name,
          area: loc.label,
          rating: place.rating || null,
          price: place.price || null,
          category: place.categories?.[0]?.name || "Restaurant",
          address: place.location?.formatted_address || place.location?.address || "",
          photo: place.photos?.[0] ? `${place.photos[0].prefix}300x200${place.photos[0].suffix}` : null,
          website: place.website || null,
        });
      }
    }
    if (all.length > 0) {
      cachedRestaurants = all;
      lastRestaurantFetch = now;
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
    // Gather context from cached data and external APIs
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=40.744&longitude=-74.032&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/New_York&forecast_days=2").then(r => r.json()).catch(() => ({})),
    ]);

    const hob = (pathData.results || []).find(s => s.consideredStation === "HOB");
    const toNYMsgs = hob?.destinations?.find(d => d.label === "ToNY")?.messages || [];
    const pathRes = { toNY: toNYMsgs.map(m => ({ headsign: m.headSign, secondsAway: parseInt(m.secondsToArrival, 10) })) };
    const stocksRes = cachedStocks || [];
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
    const prompt = `You are a friendly ${timePeriod} assistant for Adam, who lives in Hoboken, NJ and commutes to NYC.

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} (${timePeriod}). Start the briefing with "${greeting}, Adam!".

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

  if (!cachedStocks || cachedStocks.length === 0) await fetchAndCacheStocks();
  const stocks = cachedStocks;
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
  }
  res.json(cachedSports || {});
});

let cachedCommuteAdvice = null;
let lastCommuteAdviceFetch = 0;

app.get("/api/commute-advice", async (req, res) => {
  const now = Date.now();
  if (cachedCommuteAdvice && now - lastCommuteAdviceFetch < 300000) return res.json(cachedCommuteAdvice);

  try {
    const [pathData, weatherRes] = await Promise.all([
      fetchPathData().catch(() => ({ results: [] })),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=40.744&longitude=-74.032&current=temperature_2m,weathercode,precipitation&hourly=precipitation_probability&temperature_unit=fahrenheit&timezone=America/New_York&forecast_days=1").then(r => r.json()).catch(() => ({})),
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

    const prompt = `You are a commute assistant for Adam in Hoboken, NJ. Give a single-sentence commute recommendation.

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

    const prompt = `You are an event curator. Based on the following upcoming NYC events and my preferences, recommend 1-2 events in a short natural sentence.

My preferences: I like live music, food events, comedy, and unique NYC experiences. I'm less interested in sports events.

Upcoming events (name | date | venue | genre):
${upcoming.join("\n")}

Write 1-2 sentences recommending specific events with name, date, and venue. Be enthusiastic but concise. Plain text only.`;

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
  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: "query required" });

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
    const condCode = weatherRes?.current?.weathercode;

    const topStocks = (cachedStocks || [])
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 5)
      .map(s => `${s.symbol} ${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(1)}%`)
      .join(", ");

    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = (cachedEvents || [])
      .filter(e => e.date === todayStr)
      .slice(0, 3)
      .map(e => `${e.name}${e.time ? " at " + e.time : ""}`);

    const topRestaurants = (cachedRestaurants || [])
      .filter(r => r.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3)
      .map(r => `${r.name} (${r.category})`);

    const prompt = `You are a personal assistant for someone in Hoboken, NJ. Answer their question using the real-time data below. Be concise and direct — 1-3 sentences max. If the data doesn't have enough info to answer, say so briefly.

Current data:
- Weather: ${temp != null ? temp + "°F" : "unknown"}, high ${hiTemp != null ? hiTemp + "°F" : "unknown"} / low ${loTemp != null ? loTemp + "°F" : "unknown"}${condCode != null ? ", code " + condCode : ""}
- Next PATH to NYC: ${nextTrain}
- Top stock movers: ${topStocks || "no data"}
- Today's events: ${todayEvents.length > 0 ? todayEvents.join("; ") : "none found"}
- Restaurant picks: ${topRestaurants.length > 0 ? topRestaurants.join("; ") : "none available"}

User question: ${query}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ answer: message.content[0].text.trim() });
  } catch (e) {
    console.error("Ask failed:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", source: "panynj.gov", time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`PATH proxy running on http://localhost:${PORT}`);
  console.log(`  Source: ${PANYNJ_API}`);
  console.log(`  Hoboken: http://localhost:${PORT}/api/path/hoboken`);
});
