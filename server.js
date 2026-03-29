import express from "express";
import cors from "cors";

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

app.get("/api/path/all", async (req, res) => {
  const data = await fetchPathData();
  res.json(data);
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
