import { useState, useEffect, useCallback } from "react";

// ========== CONFIG ==========
// Add your API keys here if you have them
const CONFIG = {
  PATH_API: "https://hoboken-dashboard-production.up.railway.app/api/path/hoboken",
  STOCKS_API: "https://hoboken-dashboard-production.up.railway.app/api/stocks",
  RESTAURANTS_API: "https://hoboken-dashboard-production.up.railway.app/api/restaurants",
  EVENTS_API: "https://hoboken-dashboard-production.up.railway.app/api/events",
  BRIEFING_API: "https://hoboken-dashboard-production.up.railway.app/api/briefing",
  // Open-Meteo: free, no key needed
  WEATHER_API: "https://api.open-meteo.com/v1/forecast?latitude=40.744&longitude=-74.032&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,windspeed_10m_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/New_York&forecast_days=5",
  REFRESH_INTERVAL: 300000, // 5 minutes
};

// ========== SCHEDULE DATA ==========
const PATH_SCHEDULES = {
  "33rd Street": {
    color: "#4D92FB", routeName: "Hoboken - 33rd Street",
    weekend: { start: 360, end: 1380, interval: 20, offset: 0 },
    weekday: { start: 370, end: 1365, interval: 10, offset: 0 }
  },
  "World Trade Center": {
    color: "#65C100", routeName: "Hoboken - World Trade Center",
    weekend: { start: 360, end: 1380, interval: 20, offset: 5 },
    weekday: { start: 360, end: 1380, interval: 10, offset: 5 }
  }
};

const FERRY_SCHEDULES = {
  midtown: {
    name: "Midtown / W 39th St", from: "Hoboken 14th St", to: "W 39th St → Hoboken 14th St", tripTime: 12,
    weekend: ["10:02 AM","10:22 AM","10:42 AM","11:02 AM","11:22 AM","11:42 AM","12:02 PM","12:22 PM","12:42 PM","1:02 PM","1:22 PM","1:42 PM","2:02 PM","2:22 PM","2:42 PM","3:02 PM","3:22 PM","3:42 PM","4:02 PM","4:22 PM","4:42 PM","5:02 PM","5:22 PM","5:42 PM","6:02 PM","6:22 PM","6:42 PM","7:02 PM","7:22 PM","7:42 PM","8:02 PM","8:22 PM","8:42 PM","9:02 PM","9:22 PM"],
    weekday: ["6:40 AM","7:00 AM","7:20 AM","7:40 AM","8:00 AM","8:20 AM","8:40 AM","9:00 AM","9:18 AM","9:38 AM","9:58 AM","10:18 AM","10:38 AM","10:58 AM","11:18 AM","11:38 AM","11:58 AM","12:18 PM","12:38 PM","12:58 PM","1:18 PM","1:38 PM","1:58 PM","2:18 PM","2:38 PM","2:58 PM","3:18 PM","3:38 PM","3:58 PM","4:18 PM","4:38 PM","4:58 PM","5:18 PM","5:38 PM","5:58 PM","6:18 PM","6:38 PM","6:58 PM","7:18 PM","7:38 PM","7:58 PM","8:18 PM","8:38 PM","8:58 PM","9:18 PM"],
    returnWeekend: ["10:20 AM","10:40 AM","11:00 AM","11:20 AM","11:40 AM","12:00 PM","12:20 PM","12:40 PM","1:00 PM","1:20 PM","1:40 PM","2:00 PM","2:20 PM","2:40 PM","3:00 PM","3:20 PM","3:40 PM","4:00 PM","4:20 PM","4:40 PM","5:00 PM","5:20 PM","5:40 PM","6:00 PM","6:20 PM","6:40 PM","7:00 PM","7:20 PM","7:40 PM","8:00 PM","8:20 PM","8:40 PM","9:00 PM","9:20 PM","9:40 PM"],
    returnWeekday: ["7:18 AM","7:38 AM","7:58 AM","8:18 AM","8:38 AM","8:58 AM","9:18 AM","9:38 AM","9:58 AM","10:18 AM","10:58 AM","11:38 AM","12:18 PM","12:58 PM","1:38 PM","2:18 PM","2:58 PM","3:38 PM","3:58 PM","4:18 PM","4:38 PM","4:58 PM","5:18 PM","5:38 PM","5:58 PM","6:18 PM","6:38 PM","6:58 PM","7:18 PM","7:58 PM","8:38 PM","9:18 PM","9:58 PM"]
  },
  downtown: {
    name: "Brookfield Place", from: "Hoboken NJT Terminal", to: "Brookfield Place → Hoboken NJT", tripTime: 10,
    weekend: ["10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:20 PM","7:50 PM"],
    weekday: ["6:05 AM","6:25 AM","6:45 AM","7:05 AM","7:25 AM","7:45 AM","8:05 AM","8:25 AM","8:45 AM","9:05 AM","9:25 AM","9:45 AM","10:05 AM","10:25 AM","10:45 AM","11:05 AM","11:25 AM","11:45 AM","12:05 PM","12:25 PM","12:45 PM","1:05 PM","1:25 PM","1:45 PM","2:05 PM","2:25 PM","2:45 PM","3:05 PM","3:25 PM","3:45 PM","4:05 PM","4:25 PM","4:45 PM","5:05 PM","5:25 PM","5:45 PM","6:05 PM","6:25 PM","6:45 PM","7:00 PM"],
    returnWeekend: ["10:20 AM","10:50 AM","11:20 AM","11:50 AM","12:20 PM","12:50 PM","1:20 PM","1:50 PM","2:20 PM","2:50 PM","3:20 PM","3:50 PM","4:20 PM","4:50 PM","5:20 PM","5:50 PM","6:20 PM","6:50 PM","7:20 PM","7:40 PM","8:10 PM"],
    returnWeekday: ["6:45 AM","7:05 AM","7:25 AM","7:45 AM","8:05 AM","8:25 AM","8:45 AM","9:05 AM","9:25 AM","9:45 AM","10:05 AM","10:45 AM","11:25 AM","12:05 PM","12:45 PM","1:25 PM","2:05 PM","2:45 PM","3:25 PM","3:45 PM","4:05 PM","4:25 PM","4:45 PM","5:05 PM","5:25 PM","5:45 PM","6:05 PM","6:25 PM","6:45 PM","7:20 PM"]
  }
};

const BUS_126 = {
  name: "Port Authority / 42nd St", from: "Hoboken Terminal", tripTime: 22,
  weekday: ["5:10 AM","5:35 AM","5:55 AM","6:10 AM","6:20 AM","6:30 AM","6:40 AM","6:50 AM","7:00 AM","7:10 AM","7:20 AM","7:30 AM","7:40 AM","7:50 AM","8:00 AM","8:10 AM","8:20 AM","8:30 AM","8:40 AM","8:50 AM","9:00 AM","9:10 AM","9:20 AM","9:30 AM","9:40 AM","9:55 AM","10:10 AM","10:25 AM","10:40 AM","10:55 AM","11:10 AM","11:25 AM","11:40 AM","11:55 AM","12:10 PM","12:25 PM","12:40 PM","12:55 PM","1:10 PM","1:25 PM","1:40 PM","1:55 PM","2:10 PM","2:25 PM","2:40 PM","2:55 PM","3:10 PM","3:25 PM","3:40 PM","3:55 PM","4:10 PM","4:25 PM","4:40 PM","4:55 PM","5:10 PM","5:25 PM","5:40 PM","5:55 PM","6:10 PM","6:25 PM","6:40 PM","6:55 PM","7:10 PM","7:25 PM","7:40 PM","8:00 PM","8:20 PM","8:40 PM","9:00 PM","9:20 PM","9:40 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM"],
  weekend: ["6:00 AM","6:30 AM","7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM","12:30 AM","1:00 AM"],
  returnName: "Hoboken Terminal", returnFrom: "Port Authority / 42nd St",
  returnWeekday: ["6:00 AM","6:30 AM","7:00 AM","7:15 AM","7:30 AM","7:45 AM","8:00 AM","8:15 AM","8:30 AM","8:45 AM","9:00 AM","9:15 AM","9:30 AM","9:45 AM","10:00 AM","10:20 AM","10:40 AM","11:00 AM","11:20 AM","11:40 AM","12:00 PM","12:20 PM","12:40 PM","1:00 PM","1:20 PM","1:40 PM","2:00 PM","2:20 PM","2:40 PM","3:00 PM","3:20 PM","3:40 PM","4:00 PM","4:20 PM","4:40 PM","5:00 PM","5:15 PM","5:30 PM","5:45 PM","6:00 PM","6:15 PM","6:30 PM","6:45 PM","7:00 PM","7:20 PM","7:40 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM"],
  returnWeekend: ["7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM","12:30 AM","1:30 AM"]
};

// ========== UTILITIES ==========
function parseTimeStr(str) {
  const [time, period] = str.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function minsToTimeStr(totalMins) {
  let h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function getNextScheduled(route, nowDate, count = 3, returnTrip = false) {
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isWeekend = nowDate.getDay() === 0 || nowDate.getDay() === 6;
  const schedule = returnTrip
    ? (isWeekend ? route.returnWeekend : route.returnWeekday)
    : (isWeekend ? route.weekend : route.weekday);
  const upcoming = [];
  for (const t of schedule) {
    const diff = parseTimeStr(t) - nowMin;
    if (diff > -2) {
      upcoming.push({ time: t, minsAway: Math.max(0, diff) });
    }
    if (upcoming.length >= count) break;
  }
  return upcoming;
}

function getEstimatedPathTrains(nowDate, count = 6) {
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isWeekend = nowDate.getDay() === 0 || nowDate.getDay() === 6;
  const results = [];
  for (const [headsign, cfg] of Object.entries(PATH_SCHEDULES)) {
    const sched = isWeekend ? cfg.weekend : cfg.weekday;
    let t = sched.start + sched.offset;
    while (t <= sched.end && results.length < 20) {
      const diff = t - nowMin;
      if (diff >= -1) results.push({ headsign, color: cfg.color, routeName: cfg.routeName, minsAway: Math.max(0, diff), timeStr: minsToTimeStr(t) });
      t += sched.interval;
    }
  }
  results.sort((a, b) => a.minsAway - b.minsAway);
  return results.slice(0, count);
}

function fmtCountdown(m) { return m <= 0 ? "Now" : m === 1 ? "1 min" : `${m} min`; }

const WMO_CODES = {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",95:"Thunderstorm"};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ========== SPARKLINE ==========
function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return <svg width={80} height={28} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 28, pad = 2;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    pad + (1 - (v - min) / range) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pts[0][0]},${h} ${line} ${pts[pts.length - 1][0]},${h}`;
  const color = positive ? "#22c55e" : "#ef4444";
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polygon points={area} fill={color} opacity={0.15} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ========== COLORS (dark theme) ==========
const C = {
  bg: "#0a0a0a", surface: "#161616", border: "#262626", borderLight: "#333",
  text: "#e5e5e5", text2: "#999", text3: "#666",
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6", amber: "#f59e0b",
  purple: "#8b5cf6", teal: "#14b8a6", coral: "#f97316",
};

// ========== MAIN COMPONENT ==========
export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [pathTrains, setPathTrains] = useState({ toNY: [], toNJ: [], fetchedAt: null });
  const [pathLive, setPathLive] = useState(false);
  const [pathUpdated, setPathUpdated] = useState(null);
  const [weather, setWeather] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [stockPage, setStockPage] = useState(0);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantIdx, setRestaurantIdx] = useState(0);
  const [events, setEvents] = useState([]);
  const [eventPage, setEventPage] = useState(0);
  const [briefing, setBriefing] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Clock tick every second
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);

  // PATH: poll every 15s via PANYNJ official JSON
  const fetchPath = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.PATH_API + "?t=" + Date.now());
      if (!res.ok) throw new Error();
      const data = await res.json();
      const toNY = data.toNY || [];
      const toNJ = data.toNJ || [];
      if (toNY.length > 0 || toNJ.length > 0) {
        setPathTrains({ toNY, toNJ, fetchedAt: data.dataFetchedAt || Date.now() });
        setPathLive(true);
        setPathUpdated(new Date());
      } else {
        setPathLive(false);
      }
    } catch { setPathLive(false); }
  }, []);
  useEffect(() => { fetchPath(); const iv = setInterval(fetchPath, 20000); return () => clearInterval(iv); }, [fetchPath]);

  // Weather: fetch on mount + every 5 min
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.WEATHER_API);
      const data = await res.json();
      setWeather({
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weathercode,
        wind: Math.round(data.current.windspeed_10m),
        daily: data.daily.time.slice(1, 5).map((d, i) => ({
          day: DAYS[new Date(d + "T12:00:00").getDay()],
          hi: Math.round(data.daily.temperature_2m_max[i + 1]),
          lo: Math.round(data.daily.temperature_2m_min[i + 1]),
          rain: data.daily.precipitation_probability_max[i + 1],
          wind: Math.round(data.daily.windspeed_10m_max[i + 1]),
          code: data.daily.weathercode[i + 1],
        }))
      });
    } catch (e) { console.error("Weather fetch failed:", e); }
  }, []);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.STOCKS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setStocks(data);
    } catch (e) { console.error("Stock fetch failed:", e); }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.RESTAURANTS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) {
        setRestaurants(data);
        // Pick today's suggestion based on day of year
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setRestaurantIdx(dayOfYear % data.length);
      }
    } catch (e) { console.error("Restaurant fetch failed:", e); }
  }, []);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.BRIEFING_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setBriefing(data);
    } catch (e) { console.error("Briefing fetch failed:", e); }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.EVENTS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setEvents(data);
    } catch (e) { console.error("Events fetch failed:", e); }
  }, []);

  // Initial fetch + refresh interval
  useEffect(() => {
    fetchWeather();
    fetchStocks();
    fetchRestaurants();
    fetchEvents();
    fetchBriefing();
    const iv = setInterval(() => {
      fetchWeather();
      fetchStocks();
      setRefreshCount(c => c + 1);
    }, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchWeather, fetchStocks, fetchRestaurants, fetchEvents, fetchBriefing]);

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const estTrains = getEstimatedPathTrains(now, 6);
  const midFerries = getNextScheduled(FERRY_SCHEDULES.midtown, now);
  const dnFerries = getNextScheduled(FERRY_SCHEDULES.downtown, now);
  const midFerriesReturn = getNextScheduled(FERRY_SCHEDULES.midtown, now, 3, true);
  const dnFerriesReturn = getNextScheduled(FERRY_SCHEDULES.downtown, now, 3, true);
  const busDeps = getNextScheduled(BUS_126, now, 4);
  const busReturn = getNextScheduled(BUS_126, now, 4, true);

  const sectionLabel = { fontSize: 13, color: C.text2, marginBottom: 8, fontWeight: 500 };
  const divider = { border: "none", borderTop: `1px solid ${C.border}`, margin: "0 0 20px 0" };
  const card = { background: C.surface, borderRadius: 8, padding: 12 };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Hoboken dashboard</span>
        <span style={{ fontSize: 14, color: C.text2, fontFamily: "monospace" }}>
          {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* DAILY BRIEFING */}
      {briefing && (
        <div style={{ background: "#0f0f1a", border: `1px solid #2d2554`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ background: "#2d2554", color: "#a78bfa", fontWeight: 600, fontSize: 12, padding: "3px 9px", borderRadius: 6 }}>AI</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Daily Briefing</span>
            <span style={{ fontSize: 11, color: C.text3, marginLeft: "auto" }}>{new Date(briefing.generatedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
          </div>
          <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>{briefing.text}</div>
        </div>
      )}

      {/* WEATHER */}
      <div style={sectionLabel}>Hoboken, NJ</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ ...card, padding: "12px 16px", minWidth: 150 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: C.text }}>{weather ? `${weather.temp}°F` : "..."}</div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>{weather ? (WMO_CODES[weather.code] || "Unknown") : "Loading..."}</div>
          {weather?.wind != null && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>Wind {weather.wind} mph</div>}
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>Now</div>
        </div>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          {(weather?.daily || [{},{},{},{}]).map((d, i) => (
            <div key={i} style={{ ...card, flex: 1, textAlign: "center", padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>{d.day || "..."}</div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>{d.code != null ? (WMO_CODES[d.code] || "Clear") : ""}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{d.hi != null ? `${d.hi}°` : "..."}</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 1 }}>{d.lo != null ? `${d.lo}°` : ""}</div>
              <div style={{ fontSize: 11, color: C.blue, marginTop: 4 }}>{d.rain != null ? `${d.rain}% rain` : ""}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{d.wind != null ? `${d.wind} mph` : ""}</div>
            </div>
          ))}
        </div>
      </div>
      <hr style={divider} />

      {/* PATH */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#2d2554", color: "#a78bfa", fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>PATH</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Hoboken to NYC</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 500, background: pathLive ? "#14532d" : "#422006", color: pathLive ? "#4ade80" : "#fbbf24" }}>
            {pathLive ? "live" : "estimated"}
          </span>
        </div>
        {pathUpdated && pathLive && <span style={{ fontSize: 11, color: C.text3 }}>Updated {pathUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
      </div>

      {pathLive && (pathTrains.toNY.length > 0 || pathTrains.toNJ.length > 0) ? (
        <div style={{ marginBottom: 16 }}>
          {[{ label: "To NYC", trains: pathTrains.toNY, key: "ny" }, { label: "To NJ", trains: pathTrains.toNJ, key: "nj" }].map(({ label, trains, key }) =>
            trains.length === 0 ? null : (
              <div key={key}>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4, marginTop: key === "nj" ? 12 : 0 }}>{label}</div>
                {trains.map((t, i) => {
                  const elapsed = pathTrains.fetchedAt ? (now - pathTrains.fetchedAt) / 1000 : 0;
                  const liveSecs = Math.max(0, t.secondsAway - elapsed);
                  const liveMins = Math.floor(liveSecs / 60);
                  const display = liveSecs < 30 ? "Arriving" : liveMins === 0 ? "< 1 min" : liveMins === 1 ? "1 min" : `${liveMins} min`;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < trains.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ width: 4, height: 30, borderRadius: 2, background: t.lineColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{t.headsign}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 500, background: "#14532d", color: "#4ade80" }}>Live</span>
                      <div style={{ fontSize: liveMins <= 5 ? 18 : 16, fontWeight: 600, minWidth: 56, textAlign: "right", color: liveMins <= 3 ? C.red : C.text }}>{display}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      ) : estTrains.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < estTrains.length - 1 ? `1px solid ${C.border}` : "none" }}>
          <div style={{ width: 4, height: 30, borderRadius: 2, background: t.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{t.headsign}</div>
            <div style={{ fontSize: 12, color: C.text2 }}>{t.routeName}</div>
          </div>
          <span style={{ fontSize: 12, color: C.text3 }}>{t.timeStr}</span>
          <div style={{ fontSize: t.minsAway <= 5 ? 18 : 16, fontWeight: 600, minWidth: 56, textAlign: "right", color: t.minsAway <= 3 ? C.red : C.text }}>~{fmtCountdown(t.minsAway)}</div>
        </div>
      ))}

      {/* FERRY */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 12px" }}>
        <span style={{ background: "#0c2d48", color: "#60a5fa", fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>Ferry</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>NY Waterway</span>
        <span style={{ fontSize: 12, color: C.text3 }}>{isWeekend ? "weekend" : "weekday"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { route: FERRY_SCHEDULES.midtown, toData: midFerries, fromData: midFerriesReturn },
          { route: FERRY_SCHEDULES.downtown, toData: dnFerries, fromData: dnFerriesReturn }
        ].map(({ route, toData, fromData }, ri) => (
          <div key={ri} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 10 }}>{route.name}</div>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>→ NYC · from {route.from} · ~{route.tripTime} min</div>
            {toData.length === 0 ? <div style={{ fontSize: 13, color: C.text2, padding: "4px 0 8px" }}>No more today</div> : toData.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < toData.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.text2 }}>{f.time}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: f.minsAway <= 10 ? C.blue : C.text }}>{fmtCountdown(f.minsAway)}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: C.text3, margin: "10px 0 4px" }}>→ Hoboken · from {route.to?.split("→")[0].trim()}</div>
            {fromData.length === 0 ? <div style={{ fontSize: 13, color: C.text2, padding: "4px 0" }}>No more today</div> : fromData.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < fromData.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.text2 }}>{f.time}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: f.minsAway <= 10 ? C.blue : C.text }}>{fmtCountdown(f.minsAway)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* BUS 126 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ background: "#431407", color: "#fb923c", fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>126</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>NJ Transit Bus to 42nd St</span>
        <span style={{ fontSize: 12, color: C.text3 }}>{isWeekend ? "weekend" : "weekday"}</span>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>→ NYC · from {BUS_126.from} · ~{BUS_126.tripTime} min</div>
            {busDeps.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < busDeps.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.text2 }}>{b.time}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: b.minsAway <= 10 ? C.coral : C.text }}>{fmtCountdown(b.minsAway)}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>→ Hoboken · from {BUS_126.returnFrom}</div>
            {busReturn.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < busReturn.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 13, color: C.text2 }}>{b.time}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: b.minsAway <= 10 ? C.coral : C.text }}>{fmtCountdown(b.minsAway)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <hr style={divider} />

      
      {/* STOCKS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={sectionLabel}>Top 100 Stocks</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.text3 }}>Page {stockPage + 1} / {Math.ceil(stocks.length / 10) || 10}</span>
          <button onClick={() => setStockPage(p => Math.max(0, p - 1))} disabled={stockPage === 0}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 13 }}>‹</button>
          <button onClick={() => setStockPage(p => Math.min(Math.ceil(stocks.length / 10) - 1, p + 1))} disabled={stockPage >= Math.ceil(stocks.length / 10) - 1}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 13 }}>›</button>
        </div>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 64px 1fr 90px 100px 80px", gap: "0 12px", padding: "6px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.text3, fontWeight: 500 }}>
          <span>#</span><span>Symbol</span><span></span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Change</span><span style={{ textAlign: "right" }}>5d</span>
        </div>
        {stocks.length === 0
          ? <div style={{ padding: "20px 14px", color: C.text3, fontSize: 13 }}>Loading...</div>
          : stocks.slice(stockPage * 10, stockPage * 10 + 10).map((s) => {
            const pos = s.pct >= 0;
            return (
              <div key={s.symbol} style={{ display: "grid", gridTemplateColumns: "32px 64px 1fr 90px 100px 80px", gap: "0 12px", padding: "7px 14px", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.text3 }}>{s.rank}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.symbol}</span>
                <span></span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text, textAlign: "right" }}>${s.price.toFixed(2)}</span>
                <span style={{ fontSize: 12, color: pos ? C.green : C.red, textAlign: "right" }}>
                  {pos ? "+" : ""}{s.pct.toFixed(2)}%
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Sparkline data={s.sparkline} positive={pos} />
                </div>
              </div>
            );
          })
        }
      </div>
      <hr style={divider} />

      {/* RESTAURANT OF THE DAY */}
      {restaurants.length > 0 && (() => {
        const r = restaurants[restaurantIdx];
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#2d1a0e", color: C.coral, fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>Eat</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Restaurant of the Day</span>
              </div>
              <button onClick={() => setRestaurantIdx(i => (i + 1) % restaurants.length)}
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12 }}>Next →</button>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", display: "flex" }}>
              {r.photo && <img src={r.photo} alt={r.name} style={{ width: 120, height: 100, objectFit: "cover", flexShrink: 0 }} />}
              <div style={{ padding: "12px 16px", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{r.name}</span>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: C.surface, border: `1px solid ${C.border}`, color: C.text3 }}>{r.area}</span>
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 6 }}>{r.category}{r.price ? " · " + "$".repeat(r.price) : ""}{r.rating ? ` · ★ ${r.rating.toFixed(1)}` : ""}</div>
                <div style={{ fontSize: 12, color: C.text2 }}>{r.address}</div>
                {r.website && <a href={r.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue, marginTop: 4, display: "inline-block" }}>Website →</a>}
              </div>
            </div>
          </div>
        );
      })()}
      <hr style={divider} />

      {/* NYC EVENTS */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#1a0a2e", color: "#a78bfa", fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>Events</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>NYC This Week</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.text3 }}>Page {eventPage + 1} / {Math.ceil(events.length / 10) || 1}</span>
          <button onClick={() => setEventPage(p => Math.max(0, p - 1))} disabled={eventPage === 0}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 13 }}>‹</button>
          <button onClick={() => setEventPage(p => Math.min(Math.ceil(events.length / 10) - 1, p + 1))} disabled={eventPage >= Math.ceil(events.length / 10) - 1}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 13 }}>›</button>
        </div>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
        {events.length === 0
          ? <div style={{ padding: "16px 14px", color: C.text3, fontSize: 13 }}>Loading...</div>
          : events.slice(eventPage * 10, eventPage * 10 + 10).map((e, i) => {
            const dateStr = e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
            const timeStr = e.time ? new Date("1970-01-01T" + e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < Math.min(10, events.length - eventPage * 10) - 1 ? `1px solid ${C.border}` : "none" }}>
                {e.image && <img src={e.image} alt="" style={{ width: 56, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{e.venue}{e.genre && e.genre !== "Undefined" ? ` · ${e.genre}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: C.text2 }}>{dateStr}</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{timeStr}</div>
                  {e.priceMin && <div style={{ fontSize: 11, color: C.green }}>from ${Math.round(e.priceMin)}</div>}
                </div>
                {e.url && <a href={e.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.blue, flexShrink: 0 }}>→</a>}
              </div>
            );
          })
        }
      </div>
      <hr style={divider} />

      {/* FOOTER */}
      <div style={{ fontSize: 11, color: C.text3, display: "flex", justifyContent: "space-between" }}>
        <span>
          PATH: {pathLive ? "live 20s (PANYNJ)" : "schedule est."} · Weather: live 5m · Stocks: top 100, live 5m · Transit: schedule
        </span>
        <span>Refreshed {refreshCount}x</span>
      </div>
    </div>
  );
}
