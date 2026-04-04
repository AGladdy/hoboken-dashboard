import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { PinInput } from "@mantine/core";
import { DndContext, closestCenter, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useConfig, API_BASE, fetchWithAuth } from "./ConfigContext";
import SettingsModal from "./SettingsModal";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BarChart } from "@mantine/charts";
import ReactMarkdown from "react-markdown";
import CalendarSection from "./CalendarSection";
import "@mantine/charts/styles.css";
import {
  Box, Grid, SimpleGrid, Card, Paper, Group, Stack, Text, Badge,
  Button, Anchor, Table, Divider, SegmentedControl, ActionIcon,
  TextInput,
  useMantineColorScheme, useComputedColorScheme,
} from "@mantine/core";

// ========== CONFIG ==========
const CONFIG = {
  PATH_API: `${API_BASE}/api/path/hoboken`,
  STOCKS_API: `${API_BASE}/api/stocks`,
  RESTAURANTS_API: `${API_BASE}/api/restaurants`,
  EVENTS_API: `${API_BASE}/api/events`,
  NEWS_API: `${API_BASE}/api/news`,
  SPORTS_API: `${API_BASE}/api/sports`,
  WEATHER_NARRATIVE_API: `${API_BASE}/api/weather-narrative`,
  SPORTS_RECAP_API: `${API_BASE}/api/sports-recap`,
  ASK_API: `${API_BASE}/api/ask`,
  STRAVA_API: `${API_BASE}/api/strava`,
  RESTAURANT_PICK_API: `${API_BASE}/api/restaurant-pick`,
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
const WMO_ICONS = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"❄️",75:"❄️",80:"🌦️",95:"⛈️"};

// ========== SPARKLINE ==========
function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return <svg width="100%" height={28} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 200, h = 28, pad = 2;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    pad + (1 - (v - min) / range) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pts[0][0]},${h} ${line} ${pts[pts.length - 1][0]},${h}`;
  const color = positive ? "#22c55e" : "#ef4444";
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
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
function SectionHeader({ badge, badgeColor = "violet", title, right, dragHandle }) {
  return (
    <Group justify="space-between" mb="sm">
      <Group gap="xs">
        {dragHandle && (
          <Box component="span" {...dragHandle}
            style={{ cursor: "grab", color: "var(--mantine-color-dimmed)", fontSize: 14, lineHeight: 1, touchAction: "none", userSelect: "none" }}
            title="Drag to reorder"
          >⠿</Box>
        )}
        <Badge color={badgeColor} variant="filled" size="sm" radius="sm">{badge}</Badge>
        <Text fw={500} size="sm">{title}</Text>
      </Group>
      {right}
    </Group>
  );
}

// Modifier: pin overlay top to cursor position regardless of where in the element you grabbed
const snapOverlayToCursor = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  return {
    ...transform,
    y: transform.y + (activatorEvent.clientY - draggingNodeRect.top - 4),
  };
};

// ========== SORTABLE SECTION ==========
function SortableSection({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const dragHandleProps = { ref: setActivatorNodeRef, ...attributes, ...listeners };
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform),
      transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
      opacity: isDragging ? 0 : 1,
      position: "relative",
    }}>
      {children(dragHandleProps)}
    </div>
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
  const { config, saveConfig } = useConfig();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [now, setNow] = useState(new Date());
  const [pathTrains, setPathTrains] = useState({ toNY: [], toNJ: [], toNJFrom33S: [], fetchedAt: null });
  const [pathLive, setPathLive] = useState(false);
  const [pathUpdated, setPathUpdated] = useState(null);
  const [weather, setWeather] = useState(null);
  const coordsRef = useRef({ lat: config.location?.lat ?? 40.744, lon: config.location?.lon ?? -74.032 });
  const [locationLabel, setLocationLabel] = useState(config.location?.city || "Hoboken, NJ");
  const [stocks, setStocks] = useState([]);
  const [stockPage, setStockPage] = useState(0);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantIdx, setRestaurantIdx] = useState(0);
  const [restaurantArea, setRestaurantArea] = useState("Hoboken");
  const [restaurantPick, setRestaurantPick] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventPage, setEventPage] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [stravaPage, setStravaPage] = useState(0);
  const [stockSort, setStockSort] = useState({ col: 'rank', dir: 'asc' });
  const [stockRange, setStockRange] = useState('1M');
  const stockRangeRef = useRef('1M');
  const STRAVA_PAGE_SIZE = 5;
  const [weatherNarrative, setWeatherNarrative] = useState(null);
  const [news, setNews] = useState([]);
  const [sports, setSports] = useState({});
  const [sportsLeague, setSportsLeague] = useState("nba");
  const [refreshCount, setRefreshCount] = useState(0);
  const [sportsRecap, setSportsRecap] = useState(null);
  const [strava, setStrava] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(true);
  const [newsCategory, setNewsCategory] = useState("All");
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState(null);
  const [askHistory, setAskHistory] = useState([]);
  const [askLoading, setAskLoading] = useState(false);
  const [askDots, setAskDots] = useState('');
  const [askCount, setAskCount] = useState(0);
  const [askLocked, setAskLocked] = useState(false);
  const [askPinError, setAskPinError] = useState(false);
  const ASK_LIMIT = 3;
  const chatBottomRef = useRef(null);

  const DEFAULT_LEFT = ['weather', 'strava', 'path', 'ferry', 'bus', 'news'];
  const DEFAULT_RIGHT = ['calendar', 'stocks', 'sports', 'events', 'restaurants'];
  const [leftOrder, setLeftOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('gl_left_order')) || DEFAULT_LEFT; } catch { return DEFAULT_LEFT; } });
  const [rightOrder, setRightOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gl_right_order'));
      if (!saved) return DEFAULT_RIGHT;
      // Ensure 'calendar' is present for users with old saved layouts
      if (!saved.includes('calendar')) { const next = ['calendar', ...saved]; localStorage.setItem('gl_right_order', JSON.stringify(next)); return next; }
      return saved;
    } catch { return DEFAULT_RIGHT; }
  });
  const [zoom, setZoom] = useState(() => parseFloat(localStorage.getItem('gl_zoom') || '1'));
  const setZoomSave = (z) => { const v = Math.min(1, Math.max(0.5, z)); localStorage.setItem('gl_zoom', v); setZoom(v); };

  useEffect(() => {
    if (!askLoading) { setAskDots(''); return; }
    const iv = setInterval(() => setAskDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(iv);
  }, [askLoading]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [askHistory, askLoading]);

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
    const rangeKey = {'1D':'1d','1W':'5d','1M':'1mo','1Y':'1y'}[stockRangeRef.current] || '1mo';
    try {
      const res = await fetch(`${CONFIG.STOCKS_API}?range=${rangeKey}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setStocks(data);
    } catch (e) { console.error("Stocks fetch failed:", e); }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      let url = CONFIG.RESTAURANTS_API;
      const savedLoc = config.restaurant_location;
      const useGps = config.restaurant_location_mode !== 'saved';
      if (!useGps && savedLoc?.lat && savedLoc?.lon) {
        url += `?lat=${savedLoc.lat}&lon=${savedLoc.lon}`;
      } else {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          url += `?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
        } catch {} // if denied or unavailable, fall back to server default
      }
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setRestaurants(data);
    } catch (e) { console.error("Restaurant fetch failed:", e); }
  }, [config.restaurant_location, config.restaurant_location_mode]);

  const fetchRestaurantPick = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.RESTAURANT_PICK_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setRestaurantPick(data.text);
    } catch (e) { console.error("Restaurant pick fetch failed:", e); }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.NEWS_API);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setNews(data);
    } catch (e) { console.error("News fetch failed:", e); }
  }, []);

  const fetchWeatherNarrative = useCallback(async () => {
    const { lat, lon } = coordsRef.current;
    try {
      const res = await fetchWithAuth(`${CONFIG.WEATHER_NARRATIVE_API}?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.text) setWeatherNarrative(data.text);
    } catch (e) { console.error("Weather narrative fetch failed:", e); }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      let url = CONFIG.EVENTS_API;
      const savedLoc = config.restaurant_location;
      const useGps = config.restaurant_location_mode !== 'saved';
      if (!useGps && savedLoc?.lat && savedLoc?.lon) {
        url += `?lat=${savedLoc.lat}&lon=${savedLoc.lon}`;
      } else {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          url += `?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
        } catch {}
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.length > 0) setEvents(data);
    } catch (e) { console.error("Events fetch failed:", e); }
  }, [config.restaurant_location, config.restaurant_location_mode]);

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

  const fetchStrava = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.STRAVA_API, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.connected === false) { setStravaConnected(false); return; }
      setStravaConnected(true);
      if (data.activities) setStrava(data);
    } catch (e) { console.error("Strava fetch failed:", e); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/calendar`);
      if (!res.ok) return;
      const data = await res.json();
      setCalendarConnected(data.connected);
      if (data.events) setCalendarEvents(data.events);
      // Auto-add 'calendar' to visible sections for users who connected before it was in the defaults
      if (data.connected) {
        const vs = config.visible_sections;
        if (vs && !vs.includes('calendar')) {
          saveConfig({ visible_sections: [...vs, 'calendar'] });
        }
      }
    } catch (e) { console.error("Calendar fetch failed:", e); }
  }, [config.visible_sections, saveConfig]);

  useEffect(() => {
    fetchWeather(); fetchStocks(); fetchRestaurants();
    fetchEvents(); fetchNews(); fetchSports();
    fetchWeatherNarrative(); fetchSportsRecap();
    fetchStrava(); fetchRestaurantPick(); fetchCalendar();
    const iv = setInterval(() => {
      fetchWeather(); fetchStocks(); fetchSports();
      fetchWeatherNarrative(); fetchSportsRecap(); fetchStrava();
      setRefreshCount(c => c + 1);
    }, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchWeather, fetchStocks, fetchRestaurants, fetchEvents, fetchNews, fetchSports, fetchWeatherNarrative, fetchSportsRecap, fetchStrava, fetchRestaurantPick, fetchCalendar]);

  useEffect(() => {
    stockRangeRef.current = stockRange;
    setStocks([]);
    fetchStocks();
  }, [stockRange, fetchStocks]);

  const [stravaError, setStravaError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava_connected')) {
      window.history.replaceState({}, '', window.location.pathname);
      setStravaConnected(true);
      fetchStrava();
    } else if (params.get('strava_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      setStravaError(decodeURIComponent(params.get('strava_error')));
    } else if (params.get('google_connected')) {
      window.history.replaceState({}, '', window.location.pathname);
      fetchCalendar();
    }
  }, [fetchStrava, fetchCalendar]);

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const estTrains = getEstimatedPathTrains(now, 6);

  // Use config transit lines if set, otherwise fall back to built-in defaults
  const configLines = config.transit_lines && config.transit_lines.length > 0 ? config.transit_lines : null;
  const ferryLines = configLines
    ? configLines.filter(l => l.type === 'ferry')
    : [FERRY_SCHEDULES.midtownNJT, FERRY_SCHEDULES.downtown];
  const busLines = configLines
    ? configLines.filter(l => l.type === 'bus')
    : [BUS_126];


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
      ? pathTrains.toNY.find(t => t.headsign?.includes("33rd Street"))
      : estTrains.find(t => t.headsign?.includes("33rd Street"));
    if (!train) return { value: "—", sub: "No trains", color: "gray" };
    const { mins, display } = pathLive
      ? calcLiveCountdown(train, pathTrains.fetchedAt, now)
      : { mins: train.minsAway, display: fmtCountdown(train.minsAway) };
    const color = mins <= 3 ? "red" : mins <= 8 ? "yellow" : "green";
    return { value: train.headsign, sub: display, color };
  })();

  const heroFerry = (() => {
    const allDeps = ferryLines.flatMap(route => getNextScheduled(route, now, 3)).sort((a, b) => a.minsAway - b.minsAway);
    const f = allDeps[0];
    if (!f) return { value: "—", sub: "No more today", color: "gray" };
    const color = f.minsAway <= 5 ? "red" : f.minsAway <= 15 ? "yellow" : "blue";
    return { value: f.time, sub: `${f.minsAway} min away`, color };
  })();



  return (
    <Box bg={dark ? "var(--mantine-color-dark-8)" : "var(--mantine-color-gray-1)"} mih="100vh" p="md">

      {/* HEADER */}
      <Group justify="space-between" mb="md" wrap="nowrap" gap="xs">
        <Text fw={700} size="lg" truncate style={{ minWidth: 0 }}>
          {(() => { const h = now.getHours(); const n = config.display_name || "there"; return h < 12 ? `Good morning, ${n}` : h < 17 ? `Good afternoon, ${n}` : `Good evening, ${n}`; })()}
        </Text>
        <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ flexShrink: 0 }}>
          <Text size="sm" c="dimmed" ff="monospace" visibleFrom="sm">
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </Text>
          <Button
            size="xs" variant="default" visibleFrom="sm"
            onClick={() => {
              localStorage.removeItem('gl_left_order');
              localStorage.removeItem('gl_right_order');
              setLeftOrder(DEFAULT_LEFT);
              setRightOrder(DEFAULT_RIGHT);
            }}
          >Reset Layout</Button>
          <Group gap={2} visibleFrom="sm">
            <Button size="xs" variant="default" onClick={() => setZoomSave(zoom - 0.1)} disabled={zoom <= 0.5}>−</Button>
            <Button size="xs" variant="default" onClick={() => setZoomSave(1)} style={{ minWidth: 44 }}>{Math.round(zoom * 100)}%</Button>
            <Button size="xs" variant="default" onClick={() => setZoomSave(zoom + 0.1)} disabled={zoom >= 1}>+</Button>
          </Group>
          <Button size="xs" variant="default" onClick={() => setSettingsOpen(true)}>⚙</Button>
          <Button
            size="xs" variant="default"
            onClick={() => setColorScheme(dark ? "light" : "dark")}
          >
            {dark ? "☀️" : "🌙"}
          </Button>
        </Group>
      </Group>
      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
      <Paper withBorder mb="md" radius="md" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat history — above the input */}
        {(askHistory.length > 0 || askLoading) && (
          <Box style={{ maxHeight: 420, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {askHistory.map((h, i) => {
              const isUser = h.role === "user";
              return (
                <Box key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  <Box style={{
                    maxWidth: "82%",
                    background: isUser ? "var(--mantine-color-default-hover)" : "var(--mantine-color-violet-light)",
                    borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                    padding: "8px 12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}>
                    <Text size="xs" fw={600} c={isUser ? "dimmed" : "violet"} mb={2}>
                      {isUser ? "You" : "✦ Gladdy"}
                    </Text>
                    {isUser ? (
                      <Text size="sm" lh={1.6}>{h.content}</Text>
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        <ReactMarkdown>{h.content}</ReactMarkdown>
                      </div>
                    )}
                  </Box>
                </Box>
              );
            })}
            {askLoading && (
              <Box style={{ display: "flex", justifyContent: "flex-start" }}>
                <Box style={{ background: "var(--mantine-color-violet-light)", borderRadius: "4px 12px 12px 12px", padding: "8px 12px" }}>
                  <Text size="xs" fw={600} c="violet" mb={2}>✦ Gladdy</Text>
                  <Text size="sm" c="dimmed" fs="italic">Thinking{askDots}</Text>
                </Box>
              </Box>
            )}
            <div ref={chatBottomRef} />
          </Box>
        )}
        {/* Input bar — pinned at the bottom */}
        <Box p="sm" style={{ borderTop: askHistory.length > 0 || askLoading ? '1px solid var(--mantine-color-default-border)' : undefined }}>
          {askLocked ? (
            <Stack gap="xs" align="center" py="xs">
              <Text size="xs" c="dimmed">Query limit reached — enter PIN to continue</Text>
              <PinInput
                length={4}
                type="number"
                mask
                autoFocus
                error={askPinError}
                onComplete={async (val) => {
                  try {
                    const res = await fetch(`${API_BASE}/api/config/verify-pin`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pin: val }),
                    });
                    const { valid } = await res.json();
                    if (valid) { setAskCount(0); setAskLocked(false); setAskPinError(false); }
                    else { setAskPinError(true); setTimeout(() => setAskPinError(false), 1000); }
                  } catch { setAskPinError(true); setTimeout(() => setAskPinError(false), 1000); }
                }}
              />
            </Stack>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!askQuery.trim() || askLoading) return;
              const newCount = askCount + 1;
              const currentQuery = askQuery;
              setAskLoading(true);
              setAskAnswer(null);
              setAskCount(newCount);
              setAskQuery("");
              try {
                const res = await fetchWithAuth(CONFIG.ASK_API, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: currentQuery, history: askHistory }),
                });
                const data = await res.json();
                const answer = data.answer || "";
                setAskAnswer(answer);
                setAskHistory(h => [...h, { role: "user", content: currentQuery }, { role: "assistant", content: answer }]);
              } catch { setAskAnswer("Something went wrong."); }
              finally {
                setAskLoading(false);
                if (newCount >= ASK_LIMIT) setAskLocked(true);
              }
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
                <Button type="submit" size="sm" variant="light" color="violet" loading={askLoading}>
                  Ask {askCount > 0 ? `(${ASK_LIMIT - askCount} left)` : ""}
                </Button>
              </Group>
            </form>
          )}
        </Box>
      </Paper>

      {/* TWO-COLUMN GRID */}
      {(() => {
        const visibleSections = config.visible_sections || null;
        const renderSection = (id, dh) => {
          if (visibleSections && !visibleSections.includes(id)) return null;
          switch (id) {
            case 'weather': return (
              <Box key="weather">
                <SectionHeader badge="Weather" badgeColor="blue" title={locationLabel} dragHandle={dh} />
                <SectionCard mb="md">
                  {[
                    { label: "Today", code: weather?.code, temp: weather?.temp != null ? `${weather.temp}°F` : "...", lo: weather?.lo, rain: weather?.rain, wind: weather?.wind },
                    ...(weather?.daily || []).map(d => ({ label: d.day || "...", code: d.code, temp: d.hi != null ? `${d.hi}°` : "...", lo: d.lo, rain: d.rain, wind: d.wind }))
                  ].map((d, i, arr) => (
                    <Group key={i} p="xs" justify="space-between" wrap="nowrap" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 80 }}>
                        <Text size="lg" style={{ lineHeight: 1 }}>{d.code != null ? (WMO_ICONS[d.code] || "☀️") : "—"}</Text>
                        <Box>
                          <Text size="xs" fw={600}>{d.label}</Text>
                          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{d.code != null ? (WMO_CODES[d.code] || "Clear") : ""}</Text>
                        </Box>
                      </Group>
                      <Group gap="md" wrap="nowrap">
                        <Text size="sm" fw={700}>{d.temp}</Text>
                        {d.lo != null && <Text size="xs" c="dimmed">↓{d.lo}°</Text>}
                        {d.rain != null && <Text size="xs" c="blue.4">{d.rain}%</Text>}
                        {d.wind != null && <Text size="xs" c="dimmed">{d.wind}mph</Text>}
                      </Group>
                    </Group>
                  ))}
                </SectionCard>
                {weatherNarrative && <Text size="xs" c="dimmed" mb="md" fs="italic">{weatherNarrative}</Text>}
              </Box>
            );
            case 'path': return (
              <Box key="path">
                <SectionHeader badge="PATH" badgeColor="violet" title="Hoboken to NYC" dragHandle={dh}
                  right={
                    <Group gap="xs">
                      <Badge size="xs" color={pathLive ? "green" : "yellow"} variant="light">{pathLive ? "live" : "estimated"}</Badge>
                      {pathUpdated && pathLive && <Text size="xs" c="dimmed">{pathUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>}
                    </Group>
                  }
                />
                {pathLive && (pathTrains.toNY.length > 0 || pathTrains.toNJFrom33S.length > 0) ? (
                  <Box mb="md">
                    {[{ label: "To NYC", trains: pathTrains.toNY, key: "ny" }, { label: "To NJ (from 33rd St)", trains: pathTrains.toNJFrom33S, key: "nj" }].map(({ label, trains, key }) => trains.length === 0 ? null : (
                      <Box key={key} mb="xs">
                        <Text size="xs" c="dimmed" mb={4} mt={key === "nj" ? "sm" : 0}>{label}</Text>
                        {trains.map((t, i) => {
                          const { mins, display } = calcLiveCountdown(t, pathTrains.fetchedAt, now);
                          return <TransitRow key={i} color={t.lineColor} headsign={t.headsign} badge={<Badge size="xs" color="green" variant="light">Live</Badge>} right={<Text fw={700} size={mins <= 5 ? "lg" : "sm"} c={mins <= 3 ? "red" : undefined}>{display}</Text>} isLast={i === trains.length - 1} />;
                        })}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box mb="md">
                    {estTrains.map((t, i) => (
                      <TransitRow key={i} color={t.color} headsign={t.headsign} subtitle={t.routeName}
                        right={<Group gap="xs"><Text size="xs" c="dimmed">{t.timeStr}</Text><Text fw={700} size={t.minsAway <= 5 ? "lg" : "sm"} c={t.minsAway <= 3 ? "red" : undefined}>~{fmtCountdown(t.minsAway)}</Text></Group>}
                        isLast={i === estTrains.length - 1}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            );
            case 'ferry': return (
              <Box key="ferry">
                <SectionHeader badge="Ferry" badgeColor="blue" title={configLines ? "Ferry" : "NY Waterway"} dragHandle={dh} right={<Text size="xs" c="dimmed">{isWeekend ? "weekend" : "weekday"}</Text>} />
                <Box mb="md">
                  {ferryLines.map((route, ri) => {
                    const toData = getNextScheduled(route, now, 3);
                    const fromData = getNextScheduled(route, now, 3, true);
                    const next = toData[0]; const nextReturn = fromData[0];
                    const label = route.name || `${route.from} → ${route.to}`;
                    return <TransitRow key={ri} color="#0070c0" headsign={label} subtitle={next ? `${next.time} · ~${route.tripTime} min` : "No more today"}
                      right={next ? <Stack gap={0} align="flex-end"><Text fw={700} size={next.minsAway <= 5 ? "lg" : "sm"} c={next.minsAway <= 5 ? "blue" : undefined}>{fmtCountdown(next.minsAway)}</Text>{nextReturn && <Text size="xs" c="dimmed">← {nextReturn.time}</Text>}</Stack> : null}
                      isLast={ri === ferryLines.length - 1} />;
                  })}
                </Box>
              </Box>
            );
            case 'bus': return (
              <Box key="bus">
                <SectionHeader badge="Bus" badgeColor="orange" title={configLines ? "Bus" : "NJ Transit Bus to 42nd St"} dragHandle={dh} right={<Text size="xs" c="dimmed">{isWeekend ? "weekend" : "weekday"}</Text>} />
                <Box mb="md">
                  {busLines.map((route, ri) => {
                    const deps = getNextScheduled(route, now, 4);
                    const rets = getNextScheduled(route, now, 4, true);
                    const nextOut = deps[0]; const nextIn = rets[0];
                    const outLabel = route.name || `To ${route.to || '42nd St'} · from ${route.from || 'Terminal'}`;
                    const retLabel = configLines ? `Return · from ${route.to || 'Terminal'}` : `To Hoboken · from ${route.returnFrom || route.to}`;
                    return (
                      <Box key={ri}>
                        <TransitRow color="#f97316" headsign={outLabel} subtitle={nextOut ? `~${route.tripTime} min ride` : "No more today"} right={nextOut ? <Text fw={700} size={nextOut.minsAway <= 5 ? "lg" : "sm"} c={nextOut.minsAway <= 10 ? "orange" : undefined}>{nextOut.time} · {fmtCountdown(nextOut.minsAway)}</Text> : null} isLast={false} />
                        <TransitRow color="#f97316" headsign={retLabel} subtitle={nextIn ? `~${route.tripTime} min ride` : "No more today"} right={nextIn ? <Text fw={700} size="sm" c="dimmed">{nextIn.time}</Text> : null} isLast={ri === busLines.length - 1} />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
            case 'news': return (
              <Box key="news">
                <SectionHeader badge="News" badgeColor="blue" title="Top Headlines" dragHandle={dh}
                  right={<SegmentedControl size="xs" value={newsCategory} onChange={setNewsCategory} data={["All", "World", "Business", "Tech", "NYC"]} />}
                />
                <Box mb="md">
                  {(() => {
                    const filtered = newsCategory === "All" ? news : news.filter(n => n.category === newsCategory);
                    if (filtered.length === 0) return <Text size="sm" c="dimmed" py="xs">Loading...</Text>;
                    return filtered.slice(0, 15).map((item, i, arr) => (
                      <Group key={i} py="xs" gap="sm" wrap="nowrap" align="flex-start" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                        <Stack gap={4} style={{ flexShrink: 0, width: 72 }}>
                          <Badge size="xs" variant="light" color="blue" style={{ width: "100%", justifyContent: "center" }}>{item.category || "News"}</Badge>
                          <Badge size="xs" variant="outline" color="gray" style={{ width: "100%", justifyContent: "center" }}>{item.source}</Badge>
                        </Stack>
                        <Anchor href={item.link} target="_blank" c="var(--mantine-color-text)" underline="never" style={{ flex: 1, lineHeight: 1.4, fontSize: "clamp(11px, 1.8vw, 14px)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--mantine-color-blue-5)"} onMouseLeave={e => e.currentTarget.style.color = "var(--mantine-color-text)"}>{item.title}</Anchor>
                        {item.pubDate && <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>}
                      </Group>
                    ));
                  })()}
                </Box>
              </Box>
            );
             case 'strava': return (
              <Box key="strava">
                <SectionHeader badge="Fitness" badgeColor="orange" title="Recent Workouts" dragHandle={dh}
                  right={strava && stravaConnected ? (() => {
                    const totalCal = strava.activities.reduce((sum, a) => sum + (a.calories || 0), 0);
                    const totalPages = Math.ceil(strava.activities.length / STRAVA_PAGE_SIZE);
                    return (
                      <Group gap="xs">
                        {totalCal > 0 && <Text size="xs" c="orange">{totalCal.toLocaleString()} cal</Text>}
                        <Text size="xs" c="dimmed">{strava.weeklyCount} this week</Text>
                        <ActionIcon size="sm" variant="default" disabled={stravaPage === 0} onClick={() => setStravaPage(p => p - 1)}>‹</ActionIcon>
                        <ActionIcon size="sm" variant="default" disabled={stravaPage >= totalPages - 1} onClick={() => setStravaPage(p => p + 1)}>›</ActionIcon>
                      </Group>
                    );
                  })() : null}
                />
                {!stravaConnected ? (
                  <Stack align="center" gap="sm" py="md">
                    {stravaError && <Text size="sm" c="red" ta="center">{stravaError}</Text>}
                    <Text size="sm" c="dimmed">Connect your Strava account to see your workouts here.</Text>
                    <Button size="xs" color="orange" component="a" href={`${API_BASE}/api/strava/connect?token=${localStorage.getItem('auth_token')}`}>
                      Connect Strava
                    </Button>
                  </Stack>
                ) : (
                  <>
                    {!strava ? <Text size="sm" c="dimmed" mb="md">Loading...</Text> : (<>
                      {strava.chartData?.length > 0 && <Box style={{ width: '100%', minWidth: 0 }}><BarChart h={120} mb="sm" data={strava.chartData} dataKey="day" series={[{ name: "mins", color: "orange.5", label: "Duration (min)" }]} tickLine="none" gridAxis="none" withTooltip tooltipAnimationDuration={200} barProps={{ radius: 3 }} tooltipProps={{ content: ({ payload }) => { const d = payload?.[0]?.payload; if (!d) return null; return <Paper withBorder p={6} radius="sm"><Text size="xs" fw={600}>{d.day}</Text><Text size="xs">{d.mins ? `${d.mins} min` : "Rest"}</Text>{d.cal ? <Text size="xs" c="orange">{d.cal} cal</Text> : null}</Paper>; } }} /></Box>}
                      <Box mb="md">
                        {strava.activities.slice(stravaPage * STRAVA_PAGE_SIZE, (stravaPage + 1) * STRAVA_PAGE_SIZE).map((a, i, arr) => (
                          <Group key={a.id} py="xs" justify="space-between" wrap="nowrap" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                            <Group gap="xs" wrap="nowrap">
                              <Text size="md">{a.emoji}</Text>
                              <Box><Text size="xs" fw={500} truncate style={{ maxWidth: 160 }}>{a.name}</Text><Text size="xs" c="dimmed">{new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</Text></Box>
                            </Group>
                            <Group gap="xs" wrap="nowrap">
                              <Badge size="xs" variant="light" color="orange">{a.type}</Badge>
                              <Text size="xs" c="dimmed">{a.duration}</Text>
                              {a.heartrate && <Text size="xs" c="red">♥ {a.heartrate}</Text>}
                              {a.calories && <Text size="xs" c="dimmed">{a.calories} cal</Text>}
                            </Group>
                          </Group>
                        ))}
                      </Box>
                    </>)}
                  </>
                )}
              </Box>
            );
            case 'stocks': return (
              <Box key="stocks">
                <SectionHeader badge="Stocks" badgeColor="green" title="US Market" dragHandle={dh}
                  right={<Group gap="xs"><SegmentedControl size="xs" value={stockRange} onChange={setStockRange} data={['1D','1W','1M','1Y']} /><ActionIcon size="sm" variant="default" disabled={stockPage === 0} onClick={() => setStockPage(p => p - 1)}>‹</ActionIcon><ActionIcon size="sm" variant="default" disabled={stockPage >= Math.ceil((config.stock_watchlist?.length > 0 ? stocks.filter(s => config.stock_watchlist.includes(s.symbol)) : stocks).length / 10) - 1} onClick={() => setStockPage(p => p + 1)}>›</ActionIcon></Group>}
                />
                <SectionCard>
                  {(() => {
                    const thStyle = (col) => ({
                      fontSize: 11, cursor: "pointer", userSelect: "none",
                      color: stockSort.col === col ? "var(--mantine-color-blue-4)" : undefined,
                    });
                    const arrow = (col) => stockSort.col === col ? (stockSort.dir === 'asc' ? ' ↑' : ' ↓') : '';
                    const toggle = (col) => setStockSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
                    const displayStocks = config.stock_watchlist?.length > 0
                      ? stocks.filter(s => config.stock_watchlist.includes(s.symbol))
                      : stocks;
                    const sorted = [...displayStocks].sort((a, b) => {
                      const d = stockSort.dir === 'asc' ? 1 : -1;
                      if (stockSort.col === 'rank') return (a.rank - b.rank) * d;
                      if (stockSort.col === 'symbol') return a.symbol.localeCompare(b.symbol) * d;
                      if (stockSort.col === 'price') return (a.price - b.price) * d;
                      if (stockSort.col === 'pct') return (a.pct - b.pct) * d;
                      return 0;
                    });
                    return (
                      <Table striped={false} highlightOnHover verticalSpacing={6} horizontalSpacing="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={32} style={thStyle('rank')} onClick={() => toggle('rank')}>#{ arrow('rank')}</Table.Th>
                            <Table.Th style={thStyle('symbol')} onClick={() => toggle('symbol')}>Symbol{arrow('symbol')}</Table.Th>
                            <Table.Th style={{ ...thStyle('price'), textAlign: "right" }} onClick={() => toggle('price')}>Price{arrow('price')}</Table.Th>
                            <Table.Th style={{ ...thStyle('pct'), textAlign: "right" }} onClick={() => toggle('pct')}>Change{arrow('pct')}</Table.Th>
                            <Table.Th style={{ fontSize: 11, width: "100%" }} visibleFrom="xs">{stockRange}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sorted.length === 0
                            ? <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed" p="sm">Loading...</Text></Table.Td></Table.Tr>
                            : sorted.slice(stockPage * 10, stockPage * 10 + 10).map((s) => {
                              const pos = s.pct >= 0;
                              return <Table.Tr key={s.symbol}><Table.Td><Text size="xs" c="dimmed">{s.rank}</Text></Table.Td><Table.Td><Text size="sm" fw={600}>{s.symbol}</Text></Table.Td><Table.Td style={{ textAlign: "right" }}><Text size="sm" fw={500}>${s.price.toFixed(2)}</Text></Table.Td><Table.Td style={{ textAlign: "right" }}><Text size="xs" c={pos ? "green" : "red"}>{pos ? "+" : ""}{s.pct.toFixed(2)}%</Text></Table.Td><Table.Td style={{ width: "100%" }} visibleFrom="xs"><Sparkline data={s.sparkline} positive={pos} /></Table.Td></Table.Tr>;
                            })}
                        </Table.Tbody>
                      </Table>
                    );
                  })()}
                </SectionCard>
              </Box>
            );
            case 'sports': return (
              <Box key="sports">
                <SectionHeader badge="Sports" badgeColor="violet" title="Standings & News" dragHandle={dh}
                  right={<SegmentedControl size="xs" value={sportsLeague} onChange={setSportsLeague} data={[{ value: "nba", label: "NBA" }, { value: "nfl", label: "NFL" }, { value: "mlb", label: "MLB" }]} />}
                />
                {sportsRecap && <Text size="xs" c="dimmed" mt="xs" mb="xs" fs="italic">{sportsRecap}</Text>}
                {!sportsGroups ? <Text size="sm" c="dimmed" mb="md">Loading...</Text> : (
                  <Box mb="md">
                    {sports[sportsLeague]?.news?.length > 0 && (
                      <Box mb="md">
                        {sports[sportsLeague].news.map((n, i) => (
                          <Box key={i} py="xs" style={{ borderBottom: i < sports[sportsLeague].news.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                            <Anchor href={n.link} target="_blank" size="sm" c="var(--mantine-color-text)" underline="never" style={{ display: "block", lineHeight: 1.4 }} onMouseEnter={e => e.currentTarget.style.color = "var(--mantine-color-blue-5)"} onMouseLeave={e => e.currentTarget.style.color = "var(--mantine-color-text)"}>{n.headline}</Anchor>
                            {n.date && <Text size="xs" c="dimmed" mt={2}>{new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>}
                          </Box>
                        ))}
                      </Box>
                    )}
                    <SectionCard mb="sm">
                      <Table verticalSpacing={6} horizontalSpacing="sm">
                        <Table.Thead><Table.Tr><Table.Th style={{ fontSize: 11 }}>Team</Table.Th><Table.Th style={{ fontSize: 11, textAlign: "center", width: 36 }}>W</Table.Th><Table.Th style={{ fontSize: 11, textAlign: "center", width: 36 }}>L</Table.Th><Table.Th style={{ fontSize: 11, textAlign: "center", width: 56 }}>PCT</Table.Th><Table.Th style={{ fontSize: 11, textAlign: "center", width: 46 }}>GB</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {Object.entries(sportsGroups).map(([grp, teams]) => [
                            grp && <Table.Tr key={`grp-${grp}`}><Table.Td colSpan={5} style={{ background: "var(--mantine-color-default-hover)" }}><Text size="xs" fw={600} c="dimmed">{grp}</Text></Table.Td></Table.Tr>,
                            ...teams.map((t, i) => <Table.Tr key={t.abbr || `${grp}-${i}`}><Table.Td><Group gap="xs">{t.logo && <img src={t.logo} alt={t.abbr} style={{ width: 18, height: 18, objectFit: "contain" }} />}<Text size="sm">{t.name}</Text></Group></Table.Td><Table.Td style={{ textAlign: "center" }}><Text size="sm">{t.wins}</Text></Table.Td><Table.Td style={{ textAlign: "center" }}><Text size="sm">{t.losses}</Text></Table.Td><Table.Td style={{ textAlign: "center" }}><Text size="xs" c="dimmed">{t.pct}</Text></Table.Td><Table.Td style={{ textAlign: "center" }}><Text size="xs" c="dimmed">{t.gb}</Text></Table.Td></Table.Tr>),
                          ])}
                        </Table.Tbody>
                      </Table>
                    </SectionCard>
                  </Box>
                  
                )}
              </Box>
            );
            case 'events': return (
              <Box key="events">
                <SectionHeader badge="Events" badgeColor="violet" title={`${locationLabel} Events`} dragHandle={dh}
                  right={<Group gap="xs"><Text size="xs" c="dimmed">Page {eventPage + 1} / {Math.ceil(events.length / 10) || 1}</Text><ActionIcon size="sm" variant="default" disabled={eventPage === 0} onClick={() => setEventPage(p => p - 1)}>‹</ActionIcon><ActionIcon size="sm" variant="default" disabled={eventPage >= Math.ceil(events.length / 10) - 1} onClick={() => setEventPage(p => p + 1)}>›</ActionIcon></Group>}
                />
                <Box mb="md">
                  {events.length === 0 ? <Text size="sm" c="dimmed" py="xs">Loading...</Text>
                    : events.slice(eventPage * 10, eventPage * 10 + 10).map((e, i) => {
                      const dateStr = e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
                      const timeStr = e.time ? new Date("1970-01-01T" + e.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                      return (
                        <Group key={i} py="xs" gap="sm" wrap="nowrap" style={{ borderBottom: i < Math.min(10, events.length - eventPage * 10) - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                          {e.image && <img src={e.image} alt="" style={{ width: 52, height: 34, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />}
                          <Box style={{ flex: 1, minWidth: 0 }}><Text size="xs" fw={500} truncate>{e.name}</Text><Text size="xs" c="dimmed" truncate>{e.venue}{e.genre && e.genre !== "Undefined" ? ` · ${e.genre}` : ""}</Text></Box>
                          <Stack gap={0} align="flex-end" style={{ flexShrink: 0 }}><Text size="xs" c="dimmed">{dateStr}</Text><Text size="xs" c="dimmed">{timeStr}</Text>{e.priceMin && <Text size="xs" c="green">from ${Math.round(e.priceMin)}</Text>}</Stack>
                          {e.url && <Anchor href={e.url} target="_blank" size="xs" c="blue">→</Anchor>}
                        </Group>
                      );
                    })}
                </Box>
              </Box>
            );
            case 'restaurants': return (
              <Box key="restaurants">
                {(() => {
                  const hasNearby = restaurants.some(r => r.area === "Nearby");
                  const areas = [...new Set(restaurants.map(r => r.area))].filter(a => a !== "Nearby");
                  const filtered = (hasNearby ? restaurants : restaurants.filter(r => r.area === restaurantArea))
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
                  const PAGE_SIZE = 10;
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
                  const paged = filtered.slice(restaurantIdx * PAGE_SIZE, restaurantIdx * PAGE_SIZE + PAGE_SIZE);
                  return (
                    <>
                      <SectionHeader badge="Eat" badgeColor="orange"
                        title={hasNearby ? "Nearby Restaurants" : "Where to Eat"} dragHandle={dh}
                        right={
                          <Group gap="xs">
                            {!hasNearby && areas.length > 1 && <SegmentedControl size="xs" value={restaurantArea} onChange={v => { setRestaurantArea(v); setRestaurantIdx(0); }} data={areas} />}
                            {totalPages > 1 && <Group gap={2}>
                              <Text size="xs" c="dimmed">{restaurantIdx + 1}/{totalPages}</Text>
                              <ActionIcon size="sm" variant="default" disabled={restaurantIdx === 0} onClick={() => setRestaurantIdx(p => p - 1)}>‹</ActionIcon>
                              <ActionIcon size="sm" variant="default" disabled={restaurantIdx >= totalPages - 1} onClick={() => setRestaurantIdx(p => p + 1)}>›</ActionIcon>
                            </Group>}
                          </Group>
                        }
                      />
                      {restaurantPick && <Text size="xs" c="dimmed" mb="xs" fs="italic">{restaurantPick}</Text>}
                      {restaurants.length === 0 ? <Text size="sm" c="dimmed" mb="md">Loading...</Text> : (
                        <Box mb="md">
                          {paged.map((r, i) => (
                            <Group key={i} py="xs" gap="sm" wrap="nowrap" align="center" style={{ borderBottom: i < paged.length - 1 ? "1px solid var(--mantine-color-default-border)" : "none" }}>
                              {r.photo
                                ? <img src={r.photo} alt={r.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                : <Box style={{ width: 40, height: 40, borderRadius: 6, background: "var(--mantine-color-default-hover)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Text>🍽️</Text></Box>
                              }
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" fw={600} truncate>
                                  {r.website ? <Anchor href={r.website} target="_blank" c="inherit" underline="never">{r.name}</Anchor> : r.name}
                                </Text>
                                <Text size="xs" c="dimmed" truncate>
                                  {[r.category, r.price > 0 ? "$".repeat(r.price) : null, r.address?.split(",")[0]].filter(Boolean).join(" · ")}
                                </Text>
                              </Box>
                              <Group gap={6} style={{ flexShrink: 0 }} wrap="nowrap">
                                {r.rating && <Text size="xs" c="orange" fw={700}>★ {r.rating.toFixed(1)}</Text>}
                                {r.address && (
                                  <Anchor href={`https://maps.apple.com/?q=${encodeURIComponent(r.name + ' ' + r.address)}`} target="_blank" title="Open in Apple Maps" style={{ display: "flex", alignItems: "center", color: "var(--mantine-color-dimmed)" }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                  </Anchor>
                                )}
                              </Group>
                            </Group>
                          ))}
                        </Box>
                      )}
                    </>
                  );
                })()}
              </Box>
            );
            case 'calendar': return (
              <CalendarSection key="calendar" dh={dh} events={calendarEvents} connected={calendarConnected} onEventsChange={setCalendarEvents} />
            );
            default: return null;
          }
        };

        const [activeId, setActiveId] = useState(null);
        const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
          useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
        );

        const handleDragStart = ({ active }) => setActiveId(active.id);
        const handleDragEnd = ({ active, over }) => {
          setActiveId(null);
          if (!over || active.id === over.id) return;
          const inLeft = leftOrder.includes(active.id);
          const overLeft = leftOrder.includes(over.id);
          const inRight = rightOrder.includes(active.id);
          const overRight = rightOrder.includes(over.id);

          if (inLeft && overLeft) {
            setLeftOrder(prev => { const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)); localStorage.setItem('gl_left_order', JSON.stringify(next)); return next; });
          } else if (inRight && overRight) {
            setRightOrder(prev => { const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)); localStorage.setItem('gl_right_order', JSON.stringify(next)); return next; });
          } else if (inLeft && overRight) {
            setLeftOrder(prev => { const next = prev.filter(id => id !== active.id); localStorage.setItem('gl_left_order', JSON.stringify(next)); return next; });
            setRightOrder(prev => { const idx = prev.indexOf(over.id); const next = [...prev.slice(0, idx), active.id, ...prev.slice(idx)]; localStorage.setItem('gl_right_order', JSON.stringify(next)); return next; });
          } else if (inRight && overLeft) {
            setRightOrder(prev => { const next = prev.filter(id => id !== active.id); localStorage.setItem('gl_right_order', JSON.stringify(next)); return next; });
            setLeftOrder(prev => { const idx = prev.indexOf(over.id); const next = [...prev.slice(0, idx), active.id, ...prev.slice(idx)]; localStorage.setItem('gl_left_order', JSON.stringify(next)); return next; });
          }
        };

        return (
          <Box style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            marginBottom: zoom < 1 ? `${-(1 - zoom) * 100}%` : 0,
            borderRadius: zoom < 1 ? `${(1 - zoom) * 48}px` : 0,
            overflow: "hidden",
            transition: "transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1), border-radius 0.5s cubic-bezier(0.34, 1.3, 0.64, 1), margin-bottom 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)",
            willChange: "transform",
          }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
                  {leftOrder.map((id, idx) => (
                    <Fragment key={id}>
                      {idx > 0 && <Divider mb="md" />}
                      <SortableSection id={id}>
                        {(dh) => renderSection(id, dh)}
                      </SortableSection>
                    </Fragment>
                  ))}
                </SortableContext>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
                  {rightOrder.map((id, idx) => (
                    <Fragment key={id}>
                      {idx > 0 && <Divider mb="md" />}
                      <SortableSection id={id}>
                        {(dh) => renderSection(id, dh)}
                      </SortableSection>
                    </Fragment>
                  ))}
                </SortableContext>
              </Grid.Col>
            </Grid>
            <DragOverlay modifiers={[snapOverlayToCursor]} dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
              {activeId ? (() => {
                const labels = { weather: ['Weather', 'blue'], path: ['PATH', 'violet'], ferry: ['Ferry', 'blue'], bus: ['Bus', 'orange'], news: ['News', 'blue'], strava: ['Fitness', 'orange'], stocks: ['Stocks', 'green'], sports: ['Sports', 'violet'], events: ['Events', 'violet'], restaurants: ['Restaurants', 'pink'], calendar: ['Calendar', 'blue'] };
                const [label, color] = labels[activeId] ?? [activeId, 'gray'];
                return (
                  <Group gap="xs" style={{ background: 'var(--mantine-color-body)', border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.28)', cursor: 'grabbing' }}>
                    <Text style={{ color: 'var(--mantine-color-dimmed)', fontSize: 14, lineHeight: 1 }}>⠿</Text>
                    <Badge color={color} variant="filled" size="sm" radius="sm">{label}</Badge>
                    <Text size="sm" fw={500} c="dimmed">Moving…</Text>
                  </Group>
                );
              })() : null}
            </DragOverlay>
          </DndContext>
          </Box>
        );
      })()}

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
