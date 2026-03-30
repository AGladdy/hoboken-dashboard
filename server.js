import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { XMLParser } from "fast-xml-parser";

const app = express();
app.use(cors());

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

  res.json({ timestamp: new Date().toISOString(), dataFetchedAt: lastFetch, station: "Hoboken", toNY, toNJ });
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

app.get("/api/stocks", async (req, res) => {
  const now = Date.now();
  if (cachedStocks && now - lastStockFetch < 300000) return res.json(cachedStocks);

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

    if (result.length > 0) {
      cachedStocks = result;
      lastStockFetch = now;
    }
    res.json(cachedStocks || []);
  } catch (e) {
    console.error("Stock fetch failed:", e.message);
    res.json(cachedStocks || []);
  }
});

const FOURSQUARE_KEY = process.env.FOURSQUARE_KEY;
const RESTAURANT_LOCATIONS = [
  { label: "Hoboken", ll: "40.7440,-74.0324", radius: 1500 },
  { label: "Manhattan", ll: "40.7549,-73.9840", radius: 2000 },
  { label: "Brooklyn", ll: "40.6892,-73.9442", radius: 2000 },
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
    if (events.length > 0) {
      cachedEvents = events;
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

app.get("/api/path/all", async (req, res) => {
  const data = await fetchPathData();
  res.json(data);
});

const RSS_FEEDS = [
  { name: "Reuters", url: "https://feeds.reuters.com/reuters/topNews" },
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "NY Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
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
      const items = parsed?.rss?.channel?.item || [];
      for (const item of (Array.isArray(items) ? items : [items]).slice(0, 8)) {
        allItems.push({
          title: item.title?.toString().replace(/<[^>]*>/g, "").trim() || "",
          link: item.link || item.guid || "",
          source: feed.name,
          pubDate: item.pubDate || null,
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", source: "panynj.gov", time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`PATH proxy running on http://localhost:${PORT}`);
  console.log(`  Source: ${PANYNJ_API}`);
  console.log(`  Hoboken: http://localhost:${PORT}/api/path/hoboken`);
});
