import { useState, useEffect } from "react";
import { Box, Group, Stack, Text, Badge, SegmentedControl, Progress } from "@mantine/core";

const WEEK = [
  { abbr: "Mon", focus: "Kitchen reset", tasks: ["Wipe counters & stovetop", "Wash / run the dishes", "Clean the kitchen sink", "Take out trash & recycling"] },
  { abbr: "Tue", focus: "Bathroom", tasks: ["Clean toilet, sink & mirror", "Wipe down surfaces", "Swap in fresh towels", "Restock supplies"] },
  { abbr: "Wed", focus: "Floors", tasks: ["Vacuum & sweep every room", "Spot-mop the kitchen", "Shake out the entry mat"] },
  { abbr: "Thu", focus: "Dust & surfaces", tasks: ["Dust shelves, sills & electronics", "Wipe TV & console", "Tidy mail / clutter spots"] },
  { abbr: "Fri", focus: "Bedroom & laundry", tasks: ["Change & wash bed linens", "Vacuum the bedroom", "Quick closet tidy", "Run a load of laundry"] },
  { abbr: "Sat", focus: "Deep + wet clean", tasks: ["Mop kitchen & bathroom floors", "Scrub the tub / shower", "Do this week's deep task ↓"] },
  { abbr: "Sun", focus: "Kuma + week reset", tasks: ["Wash Kuma's bed & blanket", "Wash & sanitize his bowls + toys", "Brush him out", "Plan the week & restock"] },
];
const DAILY = ["Make the bed", "Wash / load dishes, wipe counters", "Clean & refill Kuma's bowls", "Quick sweep of crumbs & floor dust", "10-min tidy / clutter reset", "Take out trash if it's full"];
const ROTATION = [
  "Week 1 — Kitchen: degrease backsplash, wipe cabinet fronts, clean under appliances",
  "Week 2 — Bathroom: scrub grout, wash bath mat, clean exhaust fan cover",
  "Week 3 — Living room: vacuum sofa, dust everything, wipe baseboards",
  "Week 4 — Bedroom & entry: closet edit, wipe doors/handles, clear the catch-all",
];
const MONTHLY = [
  "Deep clean the fridge", "Clean oven & microwave, descale coffee maker", "Wash interior windows & sills",
  "Dust ceiling fixtures, vents & baseboards", "Descale showerhead & scrub grout", "Deep-wash Kuma's bed & toys",
  "Vacuum under / behind furniture", "Wipe doors, switches & walls (paw prints)", "Launder throw blankets & curtains",
  "Review & restock supplies",
];
const MLET = ["J","F","M","A","M","J","J","A","S","O","N","D"];

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function mondayIdx(d) { return (d.getDay() + 6) % 7; }
function weekOfMonth(d) { return Math.min(4, Math.ceil(d.getDate() / 7)); }
function weekDates(today) {
  const mon = new Date(today);
  mon.setDate(today.getDate() - mondayIdx(today));
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}

export default function CleaningSection({ dh }) {
  const today = new Date();
  const todayIdx = mondayIdx(today);
  const dates = weekDates(today);

  const [view, setView] = useState('day');
  const [sel, setSel] = useState(todayIdx);
  const [dayState, setDayState] = useState({});
  const [monthState, setMonthState] = useState({});

  const iso = isoOf(dates[sel]);
  const year = today.getFullYear();
  const curMonth = today.getMonth();

  useEffect(() => {
    try { setDayState(JSON.parse(localStorage.getItem(`cleaning_day_${iso}`) || '{}')); } catch { setDayState({}); }
  }, [iso]);

  useEffect(() => {
    try { setMonthState(JSON.parse(localStorage.getItem(`cleaning_month_${year}`) || '{}')); } catch { setMonthState({}); }
  }, [year]);

  const toggleDay = (id) => {
    const next = { ...dayState, [id]: !dayState[id] };
    setDayState(next);
    localStorage.setItem(`cleaning_day_${iso}`, JSON.stringify(next));
  };

  const toggleMonth = (key) => {
    const next = { ...monthState, [key]: !monthState[key] };
    setMonthState(next);
    localStorage.setItem(`cleaning_month_${year}`, JSON.stringify(next));
  };

  const day = WEEK[sel];
  const allIds = [...day.tasks.map((_, i) => `f${i}`), ...DAILY.map((_, i) => `d${i}`)];
  const doneCount = allIds.filter(id => dayState[id]).length;
  const pct = Math.round(doneCount / allIds.length * 100);

  const fmtShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Box>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          {dh && <Box component="span" {...dh} style={{ cursor: "grab", color: "var(--mantine-color-dimmed)", fontSize: 14, lineHeight: 1, touchAction: "none", userSelect: "none" }} title="Drag to reorder">⠿</Box>}
          <Badge color="teal" variant="filled" size="sm" radius="sm">Clean</Badge>
          <Text fw={500} size="sm">Cleaning</Text>
        </Group>
        <SegmentedControl size="xs" value={view} onChange={setView} data={[{ label: "Today", value: "day" }, { label: "Monthly", value: "month" }]} />
      </Group>

      {view === 'day' && (
        <>
          {/* Week strip */}
          <Group gap={4} mb="sm" wrap="nowrap" style={{ overflowX: 'auto' }}>
            {dates.map((d, i) => (
              <Box key={i} onClick={() => setSel(i)} style={{
                flex: '1 0 auto', minWidth: 38, textAlign: 'center', padding: '6px 4px',
                borderRadius: 10, cursor: 'pointer',
                background: i === sel ? 'var(--mantine-color-teal-filled)' : 'transparent',
                border: `1px solid ${i === sel ? 'transparent' : 'var(--mantine-color-default-border)'}`,
                position: 'relative',
              }}>
                <Text size="xs" fw={600} c={i === sel ? 'white' : 'dimmed'} style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{WEEK[i].abbr}</Text>
                <Text size="sm" fw={500} c={i === sel ? 'white' : undefined}>{d.getDate()}</Text>
                {i === todayIdx && <Box style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: i === sel ? 'rgba(255,255,255,0.7)' : 'var(--mantine-color-teal-5)' }} />}
              </Box>
            ))}
          </Group>

          {/* Focus + progress */}
          <Box mb="sm" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Group justify="space-between" mb={6}>
              <Stack gap={0}>
                <Text size="xs" c="dimmed" tt="uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>{sel === todayIdx ? "Today's focus" : `${WEEK[sel].abbr} focus`}</Text>
                <Text size="sm" fw={600}>{day.focus}</Text>
              </Stack>
              <Text size="sm" fw={700} c={pct === 100 ? "teal" : "dimmed"}>{pct}%</Text>
            </Group>
            <Progress value={pct} color={pct === 100 ? "teal" : "blue"} size="sm" radius="xl" />
            {sel === 5 && <Text size="xs" c="dimmed" mt={6}>{ROTATION[weekOfMonth(dates[sel]) - 1]}</Text>}
            {pct === 100 && <Text size="xs" c="teal" mt={4} fw={600}>All clear — nice work ✦</Text>}
          </Box>

          {/* Focus tasks */}
          <Text size="xs" c="dimmed" tt="uppercase" mb={4} style={{ fontSize: 10, letterSpacing: '0.12em' }}>Focus tasks</Text>
          {day.tasks.map((t, i) => {
            const id = `f${i}`;
            const done = !!dayState[id];
            return (
              <Group key={id} gap="sm" py={6} onClick={() => toggleDay(id)} style={{ cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--mantine-color-default-border)' : 'none' }}>
                <Box style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${done ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-default-border)'}`, background: done ? 'var(--mantine-color-teal-6)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: '0.15s' }}>
                  {done && <Text size="xs" c="white" style={{ fontSize: 11, lineHeight: 1 }}>✓</Text>}
                </Box>
                <Text size="sm" c={done ? 'dimmed' : undefined} style={{ textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{t}</Text>
              </Group>
            );
          })}

          {/* Daily quick list */}
          <Text size="xs" c="dimmed" tt="uppercase" mt="sm" mb={4} style={{ fontSize: 10, letterSpacing: '0.12em' }}>Daily quick list</Text>
          {DAILY.map((t, i) => {
            const id = `d${i}`;
            const done = !!dayState[id];
            return (
              <Group key={id} gap="sm" py={6} onClick={() => toggleDay(id)} style={{ cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--mantine-color-default-border)' : 'none' }}>
                <Box style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${done ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-default-border)'}`, background: done ? 'var(--mantine-color-teal-6)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: '0.15s' }}>
                  {done && <Text size="xs" c="white" style={{ fontSize: 11, lineHeight: 1 }}>✓</Text>}
                </Box>
                <Text size="sm" c={done ? 'dimmed' : undefined} style={{ textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{t}</Text>
              </Group>
            );
          })}
        </>
      )}

      {view === 'month' && (
        <Box mb="md">
          <Text size="xs" c="dimmed" tt="uppercase" mb="sm" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Monthly deep clean — tap a month when done</Text>
          {MONTHLY.map((t, ti) => (
            <Group key={ti} gap="sm" py={6} wrap="nowrap" style={{ borderTop: ti > 0 ? '1px solid var(--mantine-color-default-border)' : 'none' }}>
              <Text size="sm" style={{ flex: 1 }}>{t}</Text>
              <Group gap={2} wrap="nowrap">
                {MLET.map((L, mi) => {
                  const key = `${ti}-${mi}`;
                  const on = !!monthState[key];
                  const isCur = mi === curMonth;
                  return (
                    <Box key={mi} onClick={() => toggleMonth(key)} style={{
                      width: 16, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 600, cursor: 'pointer', transition: '0.12s',
                      border: `1px solid ${on ? 'var(--mantine-color-teal-6)' : isCur ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-default-border)'}`,
                      background: on ? 'var(--mantine-color-teal-6)' : 'transparent',
                      color: on ? 'white' : isCur ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-dimmed)',
                    }}>{L}</Box>
                  );
                })}
              </Group>
            </Group>
          ))}
        </Box>
      )}
    </Box>
  );
}
