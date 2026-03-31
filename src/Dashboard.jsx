import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box, Grid, SimpleGrid, Card, Paper, Group, Stack, Text, Badge,
  Button, Anchor, Table, Divider, SegmentedControl, ActionIcon,
  TextInput,
  useMantineColorScheme, useComputedColorScheme,
} from "@mantine/core";

// ========== CONFIG ==========
const CONFIG = {
  PATH_API: "https://hoboken-dashboard-production.up.railway.app/api/path/hoboken",
  STOCKS_API: "https://hoboken-dashboard-production.up.railway.app/api/stocks",
  RESTAURANTS_API: "https://hoboken-dashboard-production.up.railway.app/api/restaurants",
  EVENTS_API: "https://hoboken-dashboard-production.up.railway.app/api/events",
  NEWS_API: "https://hoboken-dashboard-production.up.railway.app/api/news",
  SPORTS_API: "https://hoboken-dashboard-production.up.railway.app/api/sports",
  BRIEFING_API: "https://hoboken-dashboard-production.up.railway.app/api/briefing",
  WEATHER_NARRATIVE_API: "https://hoboken-dashboard-production.up.railway.app/api/weather-narrative",
  STOCK_DIGEST_API: "https://hoboken-dashboard-production.up.railway.app/api/stock-digest",
  SPORTS_RECAP_API: "https://hoboken-dashboard-production.up.railway.app/api/sports-recap",
  EVENT_PICKS_API: "https://hoboken-dashboard-production.up.railway.app/api/event-picks",
  NEWS_DIGEST_API: "https://hoboken-dashboard-production.up.railway.app/api/news-digest",
  DAY_PLAN_API: "https://hoboken-dashboard-production.up.railway.app/api/day-plan",
  ASK_API: "https://hoboken-dashboard-production.up.railway.app/api/ask",
  WEATHER_API: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,windspeed_10m_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=5`,
  REFRESH_INTERVAL: 300000,
};

// ========== SCHEDULE DATA ==========
const PATH_SCHEDULES = {
  "33rd Street": {
    color: "#4D92FB", routeName: "Hoboken - 33rd Street",
    weekend: { start: 360, end: 1380, interval: 20, offset: 0 },
    weekday: { start: 370, end: 1365, interval: 10, offset: 0 },
  },
  "World Trade Center": {
    color: "#65C100", routeName: "Hoboken - World Trade Center",
    weekend: { start: 360, end: 1380, interval: 20, offset: 5 },
    weekday: { start: 360, end: 1380, interval: 10, offset: 5 },
  },
};

const FERRY_SCHEDULES = {
  midtown: {
    name: "Midtown / W 39th St", from: "Hoboken 14th St", to: "W 39th St", tripTime: 12,
    weekday: ["6:20 AM","6:40 AM","7:03 AM","7:23 AM","7:43 AM","8:03 AM","8:23 AM","8:43 AM","9:03 AM","9:23 AM","9:43 AM","10:03 AM","10:23 AM","10:43 AM","11:03 AM","11:23 AM","11:43 AM","12:03 PM","12:23 PM","12:43 PM","1:03 PM","1:23 PM","1:43 PM","2:03 PM","2:23 PM","2:43 PM","3:03 PM","3:23 PM","3:38 PM","3:58 PM","4:18 PM","4:38 PM","4:58 PM","5:18 PM","5:38 PM","5:58 PM","6:18 PM","6:38 PM","6:58 PM","7:18 PM","7:38 PM","7:58 PM","8:18 PM","8:38 PM","8:58 PM","9:18 PM"],
    weekend: ["10:02 AM","10:22 AM","10:42 AM","11:02 AM","11:22 AM","11:42 AM","12:02 PM","12:22 PM","12:42 PM","1:02 PM","1:22 PM","1:42 PM","2:02 PM","2:22 PM","2:42 PM","3:02 PM","3:22 PM","3:42 PM","4:02 PM","4:22 PM","4:42 PM","5:02 PM","5:22 PM","5:42 PM","6:02 PM","6:22 PM","6:42 PM","7:02 PM","7:22 PM","7:42 PM","8:02 PM","8:22 PM","8:42 PM","9:02 PM","9:22 PM"],
    returnWeekday: ["6:30 AM","6:50 AM","7:10 AM","7:30 AM","7:50 AM","8:10 AM","8:30 AM","8:50 AM","9:10 AM","9:30 AM","9:50 AM","10:10 AM","10:30 AM","10:50 AM","11:10 AM","11:30 AM","11:50 AM","12:10 PM","12:30 PM","12:50 PM","1:10 PM","1:30 PM","1:50 PM","2:10 PM","2:30 PM","2:50 PM","3:10 PM","3:30 PM","3:50 PM","4:10 PM","4:30 PM","4:50 PM","5:10 PM","5:30 PM","5:50 PM","6:10 PM","6:30 PM","6:50 PM","7:10 PM","7:30 PM","7:50 PM","8:10 PM","8:30 PM","8:50 PM","9:10 PM","9:30 PM"],
    returnWeekend: ["10:10 AM","10:30 AM","10:50 AM","11:10 AM","11:30 AM","11:50 AM","12:10 PM","12:30 PM","12:50 PM","1:10 PM","1:30 PM","1:50 PM","2:10 PM","2:30 PM","2:50 PM","3:10 PM","3:30 PM","3:50 PM","4:10 PM","4:30 PM","4:50 PM","5:10 PM","5:30 PM","5:50 PM","6:10 PM","6:30 PM","6:50 PM","7:10 PM","7:30 PM","7:50 PM","8:10 PM","8:30 PM","8:50 PM","9:10 PM","9:30 PM"],
  },
  downtown: {
    name: "Brookfield Place", from: "Hoboken NJT Terminal", to: "Brookfield Place", tripTime: 10,
    weekday: ["6:00 AM","6:20 AM","6:40 AM","7:00 AM","7:10 AM","7:20 AM","7:30 AM","7:40 AM","7:50 AM","8:00 AM","8:10 AM","8:20 AM","8:30 AM","8:40 AM","8:50 AM","9:00 AM","9:10 AM","9:20 AM","9:30 AM","9:40 AM","9:50 AM","10:00 AM","10:20 AM","10:40 AM","11:00 AM","11:20 AM","11:40 AM","12:00 PM","12:20 PM","12:40 PM","1:00 PM","1:20 PM","1:40 PM","2:00 PM","2:20 PM","2:40 PM","3:00 PM","3:20 PM","3:40 PM","4:00 PM","4:10 PM","4:20 PM","4:30 PM","4:40 PM","4:50 PM","5:00 PM","5:10 PM","5:20 PM","5:30 PM","5:40 PM","5:50 PM","6:00 PM","6:10 PM","6:20 PM","6:30 PM","6:40 PM","6:50 PM","7:00 PM","7:20 PM","7:40 PM","8:00 PM","8:20 PM","8:40 PM","9:00 PM"],
    weekend: ["10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:20 PM","3:50 PM","4:20 PM","4:50 PM","5:20 PM","5:50 PM","6:20 PM","6:50 PM","7:20 PM","7:50 PM"],
    returnWeekday: ["6:10 AM","6:30 AM","6:50 AM","7:10 AM","7:20 AM","7:30 AM","7:40 AM","7:50 AM","8:00 AM","8:10 AM","8:20 AM","8:30 AM","8:40 AM","8:50 AM","9:00 AM","9:10 AM","9:20 AM","9:30 AM","9:40 AM","9:50 AM","10:10 AM","10:30 AM","10:50 AM","11:10 AM","11:30 AM","11:50 AM","12:10 PM","12:30 PM","12:50 PM","1:10 PM","1:30 PM","1:50 PM","2:10 PM","2:30 PM","2:50 PM","3:10 PM","3:30 PM","3:50 PM","4:10 PM","4:20 PM","4:30 PM","4:40 PM","4:50 PM","5:00 PM","5:10 PM","5:20 PM","5:30 PM","5:40 PM","5:50 PM","6:00 PM","6:10 PM","6:20 PM","6:30 PM","6:40 PM","6:50 PM","7:00 PM","7:10 PM","7:30 PM","7:50 PM","8:10 PM","8:30 PM","8:50 PM","9:10 PM"],
    returnWeekend: ["10:20 AM","10:50 AM","11:20 AM","11:50 AM","12:20 PM","12:50 PM","1:20 PM","1:50 PM","2:20 PM","2:50 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM"],
  },
  midtownNJT: {
    name: "Midtown / W 39th St", from: "Hoboken NJT Terminal", to: "W 39th St", tripTime: 15,
    weekday: ["6:55 AM","7:35 AM","8:15 AM","8:55 AM","9:35 AM","4:18 PM","4:58 PM","5:38 PM","6:18 PM","6:58 PM"],
    weekend: [],
    returnWeekday: ["6:30 AM","7:10 AM","7:50 AM","8:30 AM","9:10 AM","4:10 PM","4:50 PM","5:30 PM","6:10 PM","6:50 PM","7:30 PM"],
    returnWeekend: [],
  },
};

const BUS_126 = {
  name: "Port Authority / 42nd St", from: "Hoboken Terminal", tripTime: 22,
  weekday: ["5:10 AM","5:35 AM","5:55 AM","6:10 AM","6:20 AM","6:30 AM","6:40 AM","6:50 AM","7:00 AM","7:10 AM","7:20 AM","7:30 AM","7:40 AM","7:50 AM","8:00 AM","8:10 AM","8:20 AM","8:30 AM","8:40 AM","8:50 AM","9:00 AM","9:10 AM","9:20 AM","9:30 AM","9:40 AM","9:55 AM","10:10 AM","10:25 AM","10:40 AM","10:55 AM","11:10 AM","11:25 AM","11:40 AM","11:55 AM","12:10 PM","12:25 PM","12:40 PM","12:55 PM","1:10 PM","1:25 PM","1:40 PM","1:55 PM","2:10 PM","2:25 PM","2:40 PM","2:55 PM","3:10 PM","3:25 PM","3:40 PM","3:55 PM","4:10 PM","4:25 PM","4:40 PM","4:55 PM","5:10 PM","5:25 PM","5:40 PM","5:55 PM","6:10 PM","6:25 PM","6:40 PM","6:55 PM","7:10 PM","7:25 PM","7:40 PM","8:00 PM","8:20 PM","8:40 PM","9:00 PM","9:20 PM","9:40 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM"],
  weekend: ["6:00 AM","6:30 AM","7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM","12:30 AM","1:00 AM"],
  returnName: "Hoboken Terminal", returnFrom: "Port Authority / 42nd St",
  returnWeekday: ["6:00 AM","6:30 AM","7:00 AM","7:15 AM","7:30 AM","7:45 AM","8:00 AM","8:15 AM","8:30 AM","8:45 AM","9:00 AM","9:15 AM","9:30 AM","9:45 AM","10:00 AM","10:20 AM","10:40 AM","11:00 AM","11:20 AM","11:40 AM","12:00 PM","12:20 PM","12:40 PM","1:00 PM","1:20 PM","1:40 PM","2:00 PM","2:20 PM","2:40 PM","3:00 PM","3:20 PM","3:40 PM","4:00 PM","4:20 PM","4:40 PM","5:00 PM","5:15 PM","5:30 PM","5:45 PM","6:00 PM","6:15 PM","6:30 PM","6:45 PM","7:00 PM","7:20 PM","7:40 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM"],
  returnWeekend: ["7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM","8:30 PM","9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM","12:30 AM","1:30 AM"],
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
    if (diff > -2) upcoming.push({ time: t, minsAway: Math.max(0, diff) });
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

// Shared PATH live countdown calculation
function calcLiveCountdown(train, fetchedAt, now) {
  const elapsed = fetchedAt ? (now - fetchedAt) / 1000 : 0;
  const secs = Math.max(0, train.secondsAway - elapsed);
  const mins = Math.floor(secs / 60);
  const display = secs < 30 ? "Arriving" : mins === 0 ? "< 1 min" : mins === 1 ? "1 min" : `${mins} min`;
  return { mins, display };
}

const WMO_CODES = {0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",95:"Thunderstorm"};

// ========== SPARKLINE ==========
function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return <svg width={80} height={28} />;
  const min = Math.min(...data), max = Math.max(...data);
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

// ========== SECTION CARD ==========
function SectionCard({ children, mb = "md" }) {
  return (
    <Card withBorder p={0} radius="md" mb={mb} style={{ overflow: "hidden" }}>
      {children}
    </Card>
  );
}

// ========== SECTION HEADER ==========
function SectionHeader({ badge, badgeColor = "violet", title, right }) {
  return (
    <Group justify="space-between" mb="sm">
      <Group gap="xs">
        <Badge color={badgeColor} variant="filled" size="sm" radius="sm">{badge}</Badge>
        <Text fw={500} size="sm">{title}</Text>
      </Group>
      {right}
    </Group>
  );
}

// ========== TRANSIT ROW ==========
function TransitRow({ color, headsign, subtitle, right, badge, isLast }) {
  return (
    <Box py="xs" style={{ borderBottom: isLast ? "none" : "1px solid var(--mantine-color-default-border)" }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Box w={4} h={30} style={{ borderRadius: 2, background: color, flexShrink: 0 }} />
          <Box>
            <Text size="sm" fw={500}>{headsign}</Text>
            {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
          </Box>
        </Group>
        <Group gap="xs" wrap="nowrap">
          {badge}
          {right}
        </Group>
      </Group>
    </Box>
  );
}

// ========== MAIN COMPONENT ==========
export default function Dashboard() {
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");
  const dark = colorScheme === "dark";

  const [now, setNow] = useState(new Date());
  const [pathTrains, setPathTrains] = useState({ toNY: [], toNJ: [], toNJFrom33S: [], fetchedAt: null });
  const [pathLive, setPathLive] = useState(false);
  const [pathUpdated, setPathUpdated] = useState(null);
  const [weather, setWeather] = useState(null);
  const coordsRef = useRef({ lat: 40.744, lon: -74.032 });
  const [locationLabel, setLocationLabel] = useState("Hoboken, NJ");
  const [stocks, setStocks] = useState([]);
  const [stockPage, setStockPage] = useState(0);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantIdx, setRestaurantIdx] = useState(0);
  const [events, setEvents] = useState([]);
  const [eventPage, setEventPage] = useState(0);
  const [briefing, setBriefing] = useState(null);
  const [weatherNarrative, setWeatherNarrative] = useState(null);
  const [stockDigest, setStockDigest] = useState(null);
  const [news, setNews] = useState([]);
  const [sports, setSports] = useState({});
  const [sportsLeague, setSportsLeague] = useState("nba");
  const [refreshCount, setRefreshCount] = useState(0);
  const [sportsRecap, setSportsRecap] = useState(null);
  const [eventPicks, setEventPicks] = useState(null);
  const [newsDigest, setNewsDigest] = useState(null);
  const [dayPlan, setDayPlan] = useState(null);
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchPath = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.PATH_API + "?t=" + Date.now());
      if (!res.ok) throw new Error();
      const data = await res.json();
      const toNY = data.toNY || [], toNJ = data.toNJ || [], toNJFrom33S = data.toNJFrom33S || [];
      if (toNY.length > 0 || toNJ.length > 0 || toNJFrom33S.length > 0) {
        setPathTrains({ toNY, toNJ, toNJFrom33S, fetchedAt: data.dataFetchedAt || Date.now() });
        setPathLive(true);
        setPathUpdated(new Date());
      } else {
        setPathLive(false);
      }
    } catch { setPathLive(false); }
  }, []);

  useEffect(() => {
    fetchPath();
    const iv = setInterval(fetchPath, 20000);
    return () => clearInterval(iv);
  }, [fetchPath]);

  const fetchWeather = useCallback(async () => {
    const { lat, lon } = coordsRef.current;
    try {
      const res = await fetch(CONFIG.WEATHER_API(lat, lon));
      if (!res.ok) throw new Error();
      const data = await res.json();
      const allDaily = (data.daily?.time || []).map((_, i) => ({
        day: new Date(data.daily.time[i] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
        hi: Math.round(data.daily.temperature_2m_max[i]),
        lo: Math.round(data.daily.temperature_2m_min[i]),
        code: data.daily.weathercode[i],
        rain: data.daily.precipitation_probability_max[i],
        wind: Math.round(data.daily.windspeed_10m_max[i]),
      }));
      setWeather({
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weathercode,
        wind: Math.round(data.current.windspeed_10m),
        hi: allDaily[0]?.hi,
        lo: allDaily[0]?.lo,
        rain: allDaily[0]?.rain,
        daily: allDaily.slice(1, 5),
      });
    } catch (e) { console.error("Weather fetch failed:", e); }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords: { latitude, longitude } }) => {
      coordsRef.current = { lat: latitude, lon: longitude };
      fetchWeather();
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb;
        const state = data.address?.state;
        const resolvedCity = city === "Jersey City" ? "Hoboken" : city;
        if (resolvedCity && state) setLocationLabel(`${resolvedCity}, ${state}`);
      } catch { /* keep default */ }
    });
  }, [fetchWeather]);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.STOCKS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setStocks(data);
    } catch (e) { console.error("Stocks fetch failed:", e); }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.RESTAURANTS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setRestaurants(data);
    } catch (e) { console.error("Restaurant fetch failed:", e); }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.NEWS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setNews(data);
    } catch (e) { console.error("News fetch failed:", e); }
  }, []);

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.BRIEFING_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setBriefing(data);
    } catch (e) { console.error("Briefing fetch failed:", e); }
  }, []);

  const fetchWeatherNarrative = useCallback(async () => {
    const { lat, lon } = coordsRef.current;
    try {
      const res = await fetch(`${CONFIG.WEATHER_NARRATIVE_API}?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setWeatherNarrative(data.text);
    } catch (e) { console.error("Weather narrative fetch failed:", e); }
  }, []);

  const fetchStockDigest = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.STOCK_DIGEST_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setStockDigest(data.text);
    } catch (e) { console.error("Stock digest fetch failed:", e); }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.EVENTS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setEvents(data);
    } catch (e) { console.error("Events fetch failed:", e); }
  }, []);

  const fetchSports = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.SPORTS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Object.keys(data).length > 0) setSports(data);
    } catch (e) { console.error("Sports fetch failed:", e); }
  }, []);

  const fetchSportsRecap = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.SPORTS_RECAP_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setSportsRecap(data.text);
    } catch (e) { console.error("Sports recap fetch failed:", e); }
  }, []);

  const fetchEventPicks = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.EVENT_PICKS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setEventPicks(data.text);
    } catch (e) { console.error("Event picks fetch failed:", e); }
  }, []);

  const fetchNewsDigest = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.NEWS_DIGEST_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setNewsDigest(data.text);
    } catch (e) { console.error("News digest fetch failed:", e); }
  }, []);

  const fetchDayPlan = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.DAY_PLAN_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setDayPlan(data);
    } catch (e) { console.error("Day plan fetch failed:", e); }
  }, []);

  useEffect(() => {
    fetchWeather(); fetchStocks(); fetchRestaurants();
    fetchEvents(); fetchBriefing(); fetchNews(); fetchSports();
    fetchWeatherNarrative(); fetchStockDigest();
    fetchSportsRecap(); fetchEventPicks(); fetchNewsDigest();
    fetchDayPlan();
    const iv = setInterval(() => {
      fetchWeather(); fetchStocks(); fetchSports();
      fetchWeatherNarrative(); fetchStockDigest();
      fetchSportsRecap();
      setRefreshCount(c => c + 1);
    }, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchWeather, fetchStocks, fetchRestaurants, fetchEvents, fetchBriefing, fetchNews, fetchSports, fetchWeatherNarrative, fetchStockDigest, fetchSportsRecap, fetchEventPicks, fetchNewsDigest, fetchDayPlan]);

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const estTrains = getEstimatedPathTrains(now, 6);
  const midFerries = getNextScheduled(FERRY_SCHEDULES.midtown, now);
  const dnFerries = getNextScheduled(FERRY_SCHEDULES.downtown, now);
  const midNJTFerries = getNextScheduled(FERRY_SCHEDULES.midtownNJT, now);
  const midFerriesReturn = getNextScheduled(FERRY_SCHEDULES.midtown, now, 3, true);
  const dnFerriesReturn = getNextScheduled(FERRY_SCHEDULES.downtown, now, 3, true);
  const midNJTFerriesReturn = getNextScheduled(FERRY_SCHEDULES.midtownNJT, now, 3, true);
  const busDeps = getNextScheduled(BUS_126, now, 4);
  const busReturn = getNextScheduled(BUS_126, now, 4, true);

  // Memoize sports grouping — only recomputes when league data or selection changes
  const sportsGroups = useMemo(() => {
    const league = sports[sportsLeague];
    if (!league) return null;
    const groups = {};
    for (const t of league.teams) {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push({ ...t, winsNum: parseInt(t.wins) || 0 });
    }
    for (const g of Object.values(groups)) g.sort((a, b) => b.winsNum - a.winsNum);
    return groups;
  }, [sports, sportsLeague]);

  // Hero bar values
  const heroPath = (() => {
    const train = pathLive
      ? pathTrains.toNY.find(t => t.headsign === "33rd Street")
      : estTrains.find(t => t.headsign === "33rd Street");
    if (!train) return { value: "—", sub: "No trains", color: "gray" };
    const { mins, display } = pathLive
      ? calcLiveCountdown(train, pathTrains.fetchedAt, now)
      : { mins: train.minsAway, display: fmtCountdown(train.minsAway) };
    const color = mins <= 3 ? "red" : mins <= 8 ? "yellow" : "green";
    return { value: train.headsign, sub: display, color };
  })();

  const heroFerry = (() => {
    const all = [...midFerries, ...dnFerries, ...midNJTFerries].sort((a, b) => a.minsAway - b.minsAway);
    const f = all[0];
    if (!f) return { value: "—", sub: "No more today", color: "gray" };
    const color = f.minsAway <= 5 ? "red" : f.minsAway <= 15 ? "yellow" : "blue";
    return { value: f.time, sub: `${f.minsAway} min away`, color };
  })();



  return (
    <Box bg={dark ? "var(--mantine-color-dark-8)" : "var(--mantine-color-gray-1)"} mih="100vh" p="md">

      {/* HEADER */}
      <Group justify="space-between" mb="md">
        <Text fw={700} size="lg">Gladdy's Life</Text>
        <Group gap="sm">
          <Text size="sm" c="dimmed" ff="monospace">
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </Text>
          <Button
            size="xs" variant="default"
            onClick={() => setColorScheme(dark ? "light" : "dark")}
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </Button>
        </Group>
      </Group>

      {/* HERO BAR */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {[
          {
            label: "Weather",
            value: weather ? `${weather.temp}°F` : "—",
            sub: weather ? (WMO_CODES[weather.code] || "Clear") : "Loading...",
            accent: "teal",
          },
          {
            label: "PATH to NYC",
            value: heroPath.value,
            sub: heroPath.sub,
            accent: heroPath.color,
          },
          {
            label: "Ferry",
            value: heroFerry.value,
            sub: heroFerry.sub,
            accent: heroFerry.color,
          },
          {
            label: now.toLocaleDateString("en-US", { weekday: "long" }),
            value: now.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
            sub: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            accent: "violet",
          },
        ].map((p) => (
          <Paper
            key={p.label}
            withBorder p="md" radius="md"
            style={{ borderTop: `3px solid var(--mantine-color-${p.accent}-5)` }}
          >
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4} style={{ letterSpacing: "0.05em" }}>{p.label}</Text>
            <Text size="lg" fw={700} lh={1.2}>{p.value}</Text>
            <Text size="xs" fw={500} c={`${p.accent}.5`} mt={4}>{p.sub}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* COMMAND BAR */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!askQuery.trim() || askLoading) return;
          setAskLoading(true);
          setAskAnswer(null);
          try {
            const res = await fetch(CONFIG.ASK_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: askQuery }),
            });
            const data = await res.json();
            setAskAnswer(data.answer || "");
          } catch { setAskAnswer("Something went wrong."); }
          finally { setAskLoading(false); }
        }}>
          <Group gap="xs">
            <TextInput
              placeholder="Ask anything… fastest way to midtown? dinner ideas? what's happening tonight?"
              value={askQuery}
              onChange={e => setAskQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
              size="sm"
              leftSection={<Text size="sm">✦</Text>}
            />
            <Button type="submit" size="sm" variant="light" color="violet" loading={askLoading}>Ask</Button>
          </Group>
        </form>
        {askAnswer && (
          <Text size="sm" c="dimmed" mt="xs" lh={1.5}>{askAnswer}</Text>
        )}
      </Paper>

      {/* DAILY BRIEFING */}
      {briefing && (
        <Paper withBorder p="md" mb="md" radius="md">
          <Group gap="xs" mb="xs">
            <Badge color="violet" variant="light" size="sm" radius="sm">AI</Badge>
            <Text size="sm" fw={500}>Daily Briefing</Text>
            <Text size="xs" c="dimmed" ml="auto">
              {new Date(briefing.generatedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </Group>
          <Text size="sm" c="dimmed" lh={1.6}>{briefing.text}</Text>
        </Paper>
      )}

      {/* DAY PLAN */}
      {dayPlan && (
        <Paper withBorder p="md" mb="md" radius="md">
          <Group gap="xs" mb="xs">
            <Badge color="teal" variant="light" size="sm" radius="sm">AI</Badge>
            <Text size="sm" fw={500}>Today's Plan</Text>
          </Group>
          <Text size="sm" c="dimmed" lh={1.6}>{dayPlan.text}</Text>
        </Paper>
      )}

      {/* TWO-COLUMN GRID */}
      <Grid gutter="lg">

        {/* ── LEFT COLUMN ── */}
        <Grid.Col span={{ base: 12, md: 6 }}>

          {/* WEATHER */}
          <Text size="xs" c="dimmed" fw={500} mb="xs">{locationLabel}</Text>
          <SimpleGrid cols={{ base: 3, xs: 5 }} mb="md">
            <Card withBorder p="xs" radius="md" style={{ textAlign: "center" }}>
              <Text size="xs" c="dimmed" mb={2}>Today</Text>
              <Text size="xs" c="dimmed" mb={2}>{weather ? (WMO_CODES[weather.code] || "Clear") : ""}</Text>
              <Text size="sm" fw={700}>{weather ? `${weather.temp}°F` : "..."}</Text>
              <Text size="xs" c="dimmed">{weather?.lo != null ? `${weather.lo}°` : ""}</Text>
              <Text size="xs" c="blue.5" mt={2}>{weather?.rain != null ? `${weather.rain}%` : ""}</Text>
              <Text size="xs" c="dimmed">{weather?.wind != null ? `${weather.wind} mph` : ""}</Text>
            </Card>
            {(weather?.daily || [{},{},{},{}]).map((d, i) => (
              <Card key={d.day || i} withBorder p="xs" radius="md" style={{ textAlign: "center" }}>
                <Text size="xs" c="dimmed" mb={2}>{d.day || "..."}</Text>
                <Text size="xs" c="dimmed" mb={2}>{d.code != null ? (WMO_CODES[d.code] || "Clear") : ""}</Text>
                <Text size="sm" fw={700}>{d.hi != null ? `${d.hi}°` : "..."}</Text>
                <Text size="xs" c="dimmed">{d.lo != null ? `${d.lo}°` : ""}</Text>
                <Text size="xs" c="blue.5" mt={2}>{d.rain != null ? `${d.rain}%` : ""}</Text>
                <Text size="xs" c="dimmed">{d.wind != null ? `${d.wind} mph` : ""}</Text>
              </Card>
            ))}
          </SimpleGrid>
          {weatherNarrative && (
            <Text size="xs" c="dimmed" mb="md" fs="italic">{weatherNarrative}</Text>
          )}

          <Divider mb="md" />


          {/* PATH */}
          <SectionHeader
            badge="PATH" badgeColor="violet"
            title="Hoboken to NYC"
            right={
              <Group gap="xs">
                <Badge size="xs" color={pathLive ? "green" : "yellow"} variant="light">
                  {pathLive ? "live" : "estimated"}
                </Badge>
                {pathUpdated && pathLive && (
                  <Text size="xs" c="dimmed">
                    {pathUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </Text>
                )}
              </Group>
            }
          />

          {pathLive && (pathTrains.toNY.length > 0 || pathTrains.toNJFrom33S.length > 0) ? (
            <Box mb="md">
              {[
                { label: "To NYC", trains: pathTrains.toNY, key: "ny" },
                { label: "To NJ (from 33rd St)", trains: pathTrains.toNJFrom33S, key: "nj" },
              ].map(({ label, trains, key }) => trains.length === 0 ? null : (
                <Box key={key} mb="xs">
                  <Text size="xs" c="dimmed" mb={4} mt={key === "nj" ? "sm" : 0}>{label}</Text>
                  {trains.map((t, i) => {
                    const { mins, display } = calcLiveCountdown(t, pathTrains.fetchedAt, now);
                    return (
                      <TransitRow
                        key={i}
                        color={t.lineColor}
                        headsign={t.headsign}
                        badge={<Badge size="xs" color="green" variant="light">Live</Badge>}
                        right={
                          <Text fw={700} size={mins <= 5 ? "lg" : "sm"} c={mins <= 3 ? "red" : undefined}>
                            {display}
                          </Text>
                        }
                        isLast={i === trains.length - 1}
                      />
                    );
                  })}
                </Box>
              ))}
            </Box>
          ) : (
            <Box mb="md">
              {estTrains.map((t, i) => (
                <TransitRow
                  key={i}
                  color={t.color}
                  headsign={t.headsign}
                  subtitle={t.routeName}
                  right={
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">{t.timeStr}</Text>
                      <Text fw={700} size={t.minsAway <= 5 ? "lg" : "sm"} c={t.minsAway <= 3 ? "red" : undefined}>
                        ~{fmtCountdown(t.minsAway)}
                      </Text>
                    </Group>
                  }
                  isLast={i === estTrains.length - 1}
                />
              ))}
            </Box>
          )}

          <Divider mb="md" />

          {/* FERRY */}
          <SectionHeader
            badge="Ferry" badgeColor="blue"
            title="NY Waterway"
            right={<Text size="xs" c="dimmed">{isWeekend ? "weekend" : "weekday"}</Text>}
          />
          <SimpleGrid cols={{ base: 1, xs: 3 }} mb="md">
            {[
              { route: FERRY_SCHEDULES.midtown, toData: midFerries, fromData: midFerriesReturn },
              { route: FERRY_SCHEDULES.downtown, toData: dnFerries, fromData: dnFerriesReturn },
              { route: FERRY_SCHEDULES.midtownNJT, toData: midNJTFerries, fromData: midNJTFerriesReturn },
            ].map(({ route, toData, fromData }, ri) => (
              <Card key={ri} withBorder p="sm" radius="md">
                <Text size="sm" fw={500} mb={4}>{route.name}</Text>
                <Text size="xs" c="dimmed" mb={2}>→ NYC · {route.from} · ~{route.tripTime} min</Text>
                {toData.length === 0
                  ? <Text size="xs" c="dimmed" py={2}>No more today</Text>
                  : toData.slice(0, 3).map((f, i, arr) => (
                    <Group key={i} justify="space-between" py={2} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                      <Text size="xs" c="dimmed">{f.time}</Text>
                      <Text size="xs" fw={500} c={f.minsAway <= 10 ? "blue" : undefined}>{fmtCountdown(f.minsAway)}</Text>
                    </Group>
                  ))
                }
                <Text size="xs" c="dimmed" mt="xs" mb={2}>→ Hoboken · {route.to}</Text>
                {fromData.length === 0
                  ? <Text size="xs" c="dimmed" py={2}>No more today</Text>
                  : fromData.slice(0, 3).map((f, i, arr) => (
                    <Group key={i} justify="space-between" py={2} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                      <Text size="xs" c="dimmed">{f.time}</Text>
                      <Text size="xs" fw={500} c={f.minsAway <= 10 ? "blue" : undefined}>{fmtCountdown(f.minsAway)}</Text>
                    </Group>
                  ))
                }
              </Card>
            ))}
          </SimpleGrid>

          <Divider mb="md" />

          {/* BUS 126 */}
          <SectionHeader
            badge="126" badgeColor="orange"
            title="NJ Transit Bus to 42nd St"
            right={<Text size="xs" c="dimmed">{isWeekend ? "weekend" : "weekday"}</Text>}
          />
          <Card withBorder p="sm" radius="md" mb="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed" mb="xs">→ NYC · from {BUS_126.from} · ~{BUS_126.tripTime} min</Text>
                {busDeps.map((b, i) => (
                  <Group key={i} justify="space-between" py={5} style={{ borderBottom: i < busDeps.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                    <Text size="sm" c="dimmed">{b.time}</Text>
                    <Text size="sm" fw={500} c={b.minsAway <= 10 ? "orange" : undefined}>{fmtCountdown(b.minsAway)}</Text>
                  </Group>
                ))}
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed" mb="xs">→ Hoboken · from {BUS_126.returnFrom}</Text>
                {busReturn.map((b, i) => (
                  <Group key={i} justify="space-between" py={5} style={{ borderBottom: i < busReturn.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                    <Text size="sm" c="dimmed">{b.time}</Text>
                    <Text size="sm" fw={500} c={b.minsAway <= 10 ? "orange" : undefined}>{fmtCountdown(b.minsAway)}</Text>
                  </Group>
                ))}
              </Grid.Col>
            </Grid>
          </Card>

        </Grid.Col>

        {/* ── RIGHT COLUMN ── */}
        <Grid.Col span={{ base: 12, md: 6 }}>

          {/* STOCKS */}
          {stockDigest && (
            <Text size="xs" c="dimmed" mb="xs" fs="italic">{stockDigest}</Text>
          )}
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={500}>Top 100 Stocks</Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">Page {stockPage + 1} / {Math.ceil(stocks.length / 10) || 10}</Text>
              <ActionIcon size="sm" variant="default" disabled={stockPage === 0} onClick={() => setStockPage(p => p - 1)}>‹</ActionIcon>
              <ActionIcon size="sm" variant="default" disabled={stockPage >= Math.ceil(stocks.length / 10) - 1} onClick={() => setStockPage(p => p + 1)}>›</ActionIcon>
            </Group>
          </Group>
          <SectionCard>
            <Table striped={false} highlightOnHover verticalSpacing={6} horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={32} style={{ fontSize: 11 }}>#</Table.Th>
                  <Table.Th style={{ fontSize: 11 }}>Symbol</Table.Th>
                  <Table.Th style={{ fontSize: 11, textAlign: "right" }}>Price</Table.Th>
                  <Table.Th style={{ fontSize: 11, textAlign: "right" }}>Change</Table.Th>
                  <Table.Th style={{ fontSize: 11, textAlign: "right" }} visibleFrom="xs">5d</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stocks.length === 0
                  ? <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed" p="sm">Loading...</Text></Table.Td></Table.Tr>
                  : stocks.slice(stockPage * 10, stockPage * 10 + 10).map((s) => {
                    const pos = s.pct >= 0;
                    return (
                      <Table.Tr key={s.symbol}>
                        <Table.Td><Text size="xs" c="dimmed">{s.rank}</Text></Table.Td>
                        <Table.Td><Text size="sm" fw={600}>{s.symbol}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}><Text size="sm" fw={500}>${s.price.toFixed(2)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text size="xs" c={pos ? "green" : "red"}>{pos ? "+" : ""}{s.pct.toFixed(2)}%</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }} visibleFrom="xs">
                          <Sparkline data={s.sparkline} positive={pos} />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                }
              </Table.Tbody>
            </Table>
          </SectionCard>

          <Divider mb="md" />

          {/* RESTAURANT */}
          {(() => {
            const r = restaurants[restaurantIdx];
            if (!r) return null;
            return (
              <Box mb="md">
                <SectionHeader
                  badge="Eat" badgeColor="orange"
                  title="Restaurant of the Day"
                  right={
                    <Button size="xs" variant="default" onClick={() => setRestaurantIdx(i => (i + 1) % restaurants.length)}>
                      Next →
                    </Button>
                  }
                />
                <Card withBorder p={0} radius="md" style={{ overflow: "hidden" }}>
                  <Group wrap="nowrap" align="stretch" gap={0}>
                    {r.photo && <img src={r.photo} alt={r.name} style={{ width: 110, objectFit: "cover", flexShrink: 0 }} />}
                    <Box p="sm" style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Text size="sm" fw={600}>{r.name}</Text>
                        <Badge size="xs" variant="outline">{r.area}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mb={4}>
                        {r.category}{r.price ? " · " + "$".repeat(r.price) : ""}{r.rating ? ` · ★ ${r.rating.toFixed(1)}` : ""}
                      </Text>
                      <Text size="xs" c="dimmed">{r.address}</Text>
                      {r.website && <Anchor href={r.website} target="_blank" size="xs" mt={4} display="block">Website →</Anchor>}
                    </Box>
                  </Group>
                </Card>
              </Box>
            );
          })()}

          <Divider mb="md" />

          {/* EVENTS */}
          <SectionHeader
            badge="Events" badgeColor="violet"
            title="NYC This Week"
            right={
              <Group gap="xs">
                <Text size="xs" c="dimmed">Page {eventPage + 1} / {Math.ceil(events.length / 10) || 1}</Text>
                <ActionIcon size="sm" variant="default" disabled={eventPage === 0} onClick={() => setEventPage(p => p - 1)}>‹</ActionIcon>
                <ActionIcon size="sm" variant="default" disabled={eventPage >= Math.ceil(events.length / 10) - 1} onClick={() => setEventPage(p => p + 1)}>›</ActionIcon>
              </Group>
            }
          />
          {eventPicks && (
            <Text size="xs" c="dimmed" mb="xs" fs="italic">{eventPicks}</Text>
          )}
          <SectionCard>
            {events.length === 0
              ? <Text size="sm" c="dimmed" p="sm">Loading...</Text>
              : events.slice(eventPage * 10, eventPage * 10 + 10).map((e, i) => {
                const dateStr = e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
                const timeStr = e.time ? new Date("1970-01-01T" + e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                return (
                  <Group key={i} p="xs" gap="sm" wrap="nowrap" style={{ borderBottom: i < Math.min(10, events.length - eventPage * 10) - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                    {e.image && <img src={e.image} alt="" style={{ width: 52, height: 34, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={500} truncate>{e.name}</Text>
                      <Text size="xs" c="dimmed" truncate>{e.venue}{e.genre && e.genre !== "Undefined" ? ` · ${e.genre}` : ""}</Text>
                    </Box>
                    <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}>
                      <Text size="xs" c="dimmed">{dateStr}</Text>
                      <Text size="xs" c="dimmed">{timeStr}</Text>
                      {e.priceMin && <Text size="xs" c="green">from ${Math.round(e.priceMin)}</Text>}
                    </Stack>
                    {e.url && <Anchor href={e.url} target="_blank" size="xs" c="blue">→</Anchor>}
                  </Group>
                );
              })
            }
          </SectionCard>

          <Divider mb="md" />

          {/* SPORTS */}
          <SectionHeader
            badge="Sports" badgeColor="violet"
            title="Standings & News"
            right={
              <SegmentedControl
                size="xs"
                value={sportsLeague}
                onChange={setSportsLeague}
                data={[
                  { value: "nba", label: "NBA" },
                  { value: "nfl", label: "NFL" },
                  { value: "mlb", label: "MLB" },
                ]}
              />
            }
          />
          {sportsRecap && (
            <Text size="xs" c="dimmed" mt="xs" mb="xs" fs="italic">{sportsRecap}</Text>
          )}
          {!sportsGroups
            ? <Text size="sm" c="dimmed" mb="md">Loading...</Text>
            : (
              <Box mb="md">
                <SectionCard mb="sm">
                  <Table verticalSpacing={6} horizontalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ fontSize: 11 }}>Team</Table.Th>
                        <Table.Th style={{ fontSize: 11, textAlign: "center", width: 36 }}>W</Table.Th>
                        <Table.Th style={{ fontSize: 11, textAlign: "center", width: 36 }}>L</Table.Th>
                        <Table.Th style={{ fontSize: 11, textAlign: "center", width: 56 }}>PCT</Table.Th>
                        <Table.Th style={{ fontSize: 11, textAlign: "center", width: 46 }}>GB</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {Object.entries(sportsGroups).map(([grp, teams], gi, all) => [
                        grp && (
                          <Table.Tr key={`grp-${grp}`}>
                            <Table.Td colSpan={5} style={{ background: "var(--mantine-color-default-hover)" }}>
                              <Text size="xs" fw={600} c="dimmed">{grp}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ),
                        ...teams.map((t, i) => (
                          <Table.Tr key={t.abbr || `${grp}-${i}`}>
                            <Table.Td>
                              <Group gap="xs">
                                {t.logo && <img src={t.logo} alt={t.abbr} style={{ width: 18, height: 18, objectFit: "contain" }} />}
                                <Text size="sm">{t.name}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "center" }}><Text size="sm">{t.wins}</Text></Table.Td>
                            <Table.Td style={{ textAlign: "center" }}><Text size="sm">{t.losses}</Text></Table.Td>
                            <Table.Td style={{ textAlign: "center" }}><Text size="xs" c="dimmed">{t.pct}</Text></Table.Td>
                            <Table.Td style={{ textAlign: "center" }}><Text size="xs" c="dimmed">{t.gb}</Text></Table.Td>
                          </Table.Tr>
                        )),
                      ])}
                    </Table.Tbody>
                  </Table>
                </SectionCard>
                {sports[sportsLeague]?.news?.length > 0 && (
                  <SectionCard mb="md">
                    {sports[sportsLeague].news.map((n, i) => (
                      <Box key={i} p="sm" style={{ borderBottom: i < sports[sportsLeague].news.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                        <Anchor href={n.link} target="_blank" size="sm" c="var(--mantine-color-text)" underline="never"
                          style={{ display: "block", lineHeight: 1.4 }}
                          onMouseEnter={e => e.currentTarget.style.color = "var(--mantine-color-blue-5)"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--mantine-color-text)"}
                        >
                          {n.headline}
                        </Anchor>
                        {n.date && <Text size="xs" c="dimmed" mt={2}>{new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>}
                      </Box>
                    ))}
                  </SectionCard>
                )}
              </Box>
            )
          }

          <Divider mb="md" />

          {/* NEWS */}
          <SectionHeader badge="News" badgeColor="blue" title="Top Headlines" />
          {newsDigest && (
            <Text size="xs" c="dimmed" mb="xs" fs="italic">{newsDigest}</Text>
          )}
          <SectionCard>
            {news.length === 0
              ? <Text size="sm" c="dimmed" p="sm">Loading...</Text>
              : news.slice(0, 15).map((item, i) => (
                <Group key={i} p="xs" gap="xs" wrap="nowrap" align="flex-start" style={{ borderBottom: i < 14 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                  <Badge size="xs" variant="outline" color="gray" style={{ flexShrink: 0 }}>{item.source}</Badge>
                  <Anchor href={item.link} target="_blank" size="xs" c="var(--mantine-color-text)" underline="never"
                    style={{ flex: 1, lineHeight: 1.4 }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--mantine-color-blue-5)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--mantine-color-text)"}
                  >
                    {item.title}
                  </Anchor>
                  {item.pubDate && (
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  )}
                </Group>
              ))
            }
          </SectionCard>

        </Grid.Col>
      </Grid>

      {/* FOOTER */}
      <Group justify="space-between" mt="md">
        <Text size="xs" c="dimmed">
          PATH: {pathLive ? "live 20s (PANYNJ)" : "schedule est."} · Weather: live 5m · Stocks: top 100, live 5m · Transit: schedule
        </Text>
        <Text size="xs" c="dimmed">Refreshed {refreshCount}x</Text>
      </Group>
    </Box>
  );
}
