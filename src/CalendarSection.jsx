import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Text, Group, Stack, Button, ActionIcon, Badge, Modal,
  TextInput, Textarea, Select, Switch, SegmentedControl, Loader,
  Alert,
} from '@mantine/core';
import { fetchWithAuth, API_BASE } from './ConfigContext';

// Google colorId → hex
const GOOGLE_COLORS = {
  '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
  '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#9e9e9e',
  '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
};

function getEventColor(event) {
  return GOOGLE_COLORS[event.color] || event.backgroundColor || '#5484ed';
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalISO(date, time) {
  return `${date}T${time}:00`;
}

function formatTime(isoStr) {
  if (!isoStr || !isoStr.includes('T')) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(cursor) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: new Date(year, month, 1 - (firstDow - i)), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), isCurrentMonth: false });
  }
  return cells;
}

function eventsForDay(date, events) {
  const dateStr = toDateStr(date);
  return events.filter(e => {
    if (e.allDay) return dateStr >= e.start && dateStr < e.end;
    return (e.start || '').startsWith(dateStr);
  });
}

function EventPill({ event, onClick }) {
  const color = getEventColor(event);
  return (
    <Box
      onClick={onClick}
      title={event.title}
      style={{
        background: color, color: '#fff', borderRadius: 3,
        padding: '1px 4px', fontSize: 10, marginBottom: 2,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        cursor: 'pointer', lineHeight: 1.5,
      }}
    >
      {!event.allDay && <span style={{ opacity: 0.9, marginRight: 3 }}>{formatTime(event.start)}</span>}
      {event.title}
    </Box>
  );
}

function DayCell({ day, events, onClick, onEventClick }) {
  const isToday = isSameDay(day.date, new Date());
  const MAX = 3;
  const visible = events.slice(0, MAX);
  const overflow = events.length - MAX;
  return (
    <Box
      onClick={onClick}
      style={{
        minHeight: 80, padding: '4px 3px',
        borderRight: '1px solid var(--mantine-color-default-border)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        background: day.isCurrentMonth ? 'transparent' : 'var(--mantine-color-default-hover)',
        cursor: 'pointer', overflow: 'hidden',
      }}
    >
      <Box style={{
        width: 22, height: 22, borderRadius: '50%',
        background: isToday ? 'var(--mantine-color-blue-6)' : 'transparent',
        color: isToday ? '#fff' : day.isCurrentMonth ? 'inherit' : 'var(--mantine-color-dimmed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: isToday ? 700 : 400, marginBottom: 2,
      }}>
        {day.date.getDate()}
      </Box>
      {visible.map(e => (
        <EventPill key={e.id} event={e} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} />
      ))}
      {overflow > 0 && (
        <Text size={10} c="dimmed" pl={2}>+{overflow} more</Text>
      )}
    </Box>
  );
}

function WeekView({ weekStart, events, onEventClick, onSlotClick }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <Box style={{ overflowY: 'auto', maxHeight: 520, border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      {/* Day headers */}
      <Box style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))', position: 'sticky', top: 0, zIndex: 1, background: 'var(--mantine-color-body)' }}>
        <Box style={{ borderRight: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)' }} />
        {days.map((d, i) => (
          <Box key={i} style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed">{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
            <Box style={{
              width: 26, height: 26, borderRadius: '50%', margin: '2px auto 0',
              background: isSameDay(d, today) ? 'var(--mantine-color-blue-6)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Text size="sm" fw={isSameDay(d, today) ? 700 : 400} c={isSameDay(d, today) ? '#fff' : 'inherit'}>
                {d.getDate()}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* All-day strip */}
      <Box style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Box style={{ padding: '4px 2px', fontSize: 9, color: 'var(--mantine-color-dimmed)', textAlign: 'right', borderRight: '1px solid var(--mantine-color-default-border)' }}>all-day</Box>
        {days.map((d, i) => (
          <Box key={i} style={{ minHeight: 24, padding: 2, borderRight: '1px solid var(--mantine-color-default-border)' }}>
            {events.filter(e => e.allDay && eventsForDay(d, [e]).length > 0).map(e => (
              <EventPill key={e.id} event={e} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} />
            ))}
          </Box>
        ))}
      </Box>

      {/* Time slots */}
      {hours.map(h => (
        <Box key={h} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}>
          <Box style={{
            fontSize: 10, color: 'var(--mantine-color-dimmed)', padding: '0 6px',
            height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            paddingTop: 2, borderRight: '1px solid var(--mantine-color-default-border)',
          }}>
            {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
          </Box>
          {days.map((d, i) => {
            const slotEvents = events.filter(e => {
              if (e.allDay) return false;
              if (!(e.start || '').startsWith(toDateStr(d))) return false;
              const eHour = new Date(e.start).getHours();
              return eHour === h;
            });
            return (
              <Box key={i} onClick={() => onSlotClick(d, h)}
                style={{ height: 60, borderRight: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)', padding: 2, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                {slotEvents.map(e => (
                  <EventPill key={e.id} event={e} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} />
                ))}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function EventModal({ opened, mode, event, defaultDate, defaultHour, calendars, onClose, onSave, onDelete }) {
  const today = toDateStr(new Date());
  const defaultEndHour = defaultHour != null ? String(Math.min(defaultHour + 1, 23)).padStart(2, '0') : '10';
  const defaultStartHour = defaultHour != null ? String(defaultHour).padStart(2, '0') : '09';

  const [form, setForm] = useState({
    title: '', date: today, startTime: `${defaultStartHour}:00`, endTime: `${defaultEndHour}:00`,
    allDay: false, description: '', location: '', calendarId: 'primary',
  });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setEditMode(mode === 'create');
    if (event) {
      setForm({
        title: event.title || '',
        date: (event.start || '').split('T')[0] || today,
        startTime: event.start?.includes('T') ? event.start.slice(11, 16) : '09:00',
        endTime: event.end?.includes('T') ? event.end.slice(11, 16) : '10:00',
        allDay: event.allDay || false,
        description: event.description || '',
        location: event.location || '',
        calendarId: event.calendarId || 'primary',
      });
    } else {
      const dStr = defaultDate ? toDateStr(defaultDate) : today;
      setForm({
        title: '', date: dStr,
        startTime: `${defaultStartHour}:00`, endTime: `${defaultEndHour}:00`,
        allDay: false, description: '', location: '',
        calendarId: calendars[0]?.id || 'primary',
      });
    }
  }, [opened, event, defaultDate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      // Google Calendar requires all-day end = day after start (exclusive)
      const allDayEnd = (() => {
        const d = new Date(form.date + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        return toDateStr(d);
      })();
      const payload = {
        title: form.title.trim(),
        allDay: form.allDay,
        start: form.allDay ? form.date : toLocalISO(form.date, form.startTime),
        end: form.allDay ? allDayEnd : toLocalISO(form.date, form.endTime),
        description: form.description || '',
        location: form.location || '',
        calendarId: form.calendarId,
      };
      await onSave(payload, event);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(event); } finally { setDeleting(false); }
  };

  const isView = !editMode && mode !== 'create';

  return (
    <Modal opened={opened} onClose={onClose} title={isView ? event?.title || 'Event' : mode === 'create' ? 'New Event' : 'Edit Event'} size="md">
      {isView && event ? (
        <Stack gap="sm">
          {event.start && (
            <Group gap="xs">
              <Text size="xs" c="dimmed" w={80}>When</Text>
              <Text size="sm">
                {event.allDay
                  ? new Date(event.start + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : `${new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTime(event.start)} – ${formatTime(event.end)}`
                }
              </Text>
            </Group>
          )}
          {event.location && (
            <Group gap="xs" align="flex-start">
              <Text size="xs" c="dimmed" w={80}>Where</Text>
              <Text size="sm" style={{ flex: 1 }}>{event.location}</Text>
            </Group>
          )}
          {event.description && (
            <Group gap="xs" align="flex-start">
              <Text size="xs" c="dimmed" w={80}>Notes</Text>
              <Text size="sm" style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{event.description}</Text>
            </Group>
          )}
          {event.calendarName && (
            <Group gap="xs">
              <Text size="xs" c="dimmed" w={80}>Calendar</Text>
              <Group gap={6}>
                {event.backgroundColor && <Box style={{ width: 10, height: 10, borderRadius: '50%', background: event.backgroundColor }} />}
                <Text size="sm">{event.calendarName}</Text>
              </Group>
            </Group>
          )}
          <Group justify="space-between" mt="xs">
            <Button size="xs" color="red" variant="subtle" loading={deleting} onClick={handleDelete}>Delete</Button>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={onClose}>Close</Button>
              <Button size="xs" onClick={() => setEditMode(true)}>Edit</Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <TextInput label="Title" required placeholder="Event title" value={form.title} onChange={e => set('title', e.currentTarget.value)} autoFocus />
          <Switch label="All day" checked={form.allDay} onChange={e => set('allDay', e.currentTarget.checked)} />
          <TextInput label="Date" type="date" value={form.date} onChange={e => set('date', e.currentTarget.value)} />
          {!form.allDay && (
            <Group grow>
              <TextInput label="Start time" type="time" value={form.startTime} onChange={e => set('startTime', e.currentTarget.value)} />
              <TextInput label="End time" type="time" value={form.endTime} onChange={e => set('endTime', e.currentTarget.value)} />
            </Group>
          )}
          <TextInput label="Location" placeholder="Add location" value={form.location} onChange={e => set('location', e.currentTarget.value)} />
          <Textarea label="Description" placeholder="Add notes" value={form.description} onChange={e => set('description', e.currentTarget.value)} minRows={2} autosize />
          {calendars.length > 1 && (
            <Select label="Calendar" value={form.calendarId} onChange={v => set('calendarId', v)}
              data={calendars.map(c => ({ value: c.id, label: c.name }))} />
          )}
          <Group justify="space-between" mt="xs">
            {event && <Button size="xs" color="red" variant="subtle" loading={deleting} onClick={handleDelete}>Delete</Button>}
            <Group gap="xs" ml="auto">
              <Button size="xs" variant="default" onClick={onClose}>Cancel</Button>
              <Button size="xs" loading={saving} disabled={!form.title.trim()} onClick={handleSave}>
                {event ? 'Save changes' : 'Create event'}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default function CalendarSection({ dh, events, connected, onEventsChange }) {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [calendars, setCalendars] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);

  const weekStart = getWeekStart(view === 'week' ? cursor : new Date());

  const fetchEvents = useCallback(async () => {
    if (!connected) return;
    setFetching(true);
    try {
      let timeMin, timeMax;
      if (view === 'month') {
        timeMin = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
        timeMax = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();
      } else {
        timeMin = weekStart.toISOString();
        timeMax = addDays(weekStart, 7).toISOString();
      }
      const res = await fetchWithAuth(`${API_BASE}/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await res.json();
      if (data.needsReconnect) { setNeedsReconnect(true); return; }
      if (data.events) onEventsChange(data.events);
      if (data.calendars) setCalendars(data.calendars);
    } catch (e) { console.error('Calendar fetch failed:', e); }
    finally { setFetching(false); }
  }, [connected, view, cursor]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const goBack = () => {
    if (view === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else setCursor(d => addDays(d, -7));
  };
  const goForward = () => {
    if (view === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else setCursor(d => addDays(d, 7));
  };
  const goToday = () => {
    const t = new Date();
    if (view === 'month') setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
    else setCursor(getWeekStart(t));
  };

  const openCreate = (date, hour) => {
    setSelectedEvent(null);
    setSelectedDate(date);
    setSelectedHour(hour ?? null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEvent = (event) => {
    setSelectedEvent(event);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleSave = async (payload, existingEvent) => {
    const method = existingEvent ? 'PATCH' : 'POST';
    const url = existingEvent
      ? `${API_BASE}/api/calendar/events/${existingEvent.id}?calendarId=${existingEvent.calendarId}`
      : `${API_BASE}/api/calendar/events`;
    const res = await fetchWithAuth(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.needsReconnect) { setNeedsReconnect(true); return; }
    if (data.error) { console.error('Save event error:', data.error); return; }
    if (!data.event) return;
    if (existingEvent) {
      onEventsChange(prev => prev.map(e => e.id === data.event.id ? data.event : e));
    } else {
      onEventsChange(prev => [...prev, data.event]);
    }
    setModalOpen(false);
  };

  const handleDelete = async (event) => {
    await fetchWithAuth(`${API_BASE}/api/calendar/events/${event.id}?calendarId=${event.calendarId}`, { method: 'DELETE' });
    onEventsChange(prev => prev.filter(e => e.id !== event.id));
    setModalOpen(false);
  };

  const monthGrid = buildMonthGrid(cursor);
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box>
      {/* Header */}
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          {dh && <Box component="span" {...dh} style={{ cursor: "grab", color: "var(--mantine-color-dimmed)", fontSize: 14, lineHeight: 1, touchAction: "none", userSelect: "none" }} title="Drag to reorder">⠿</Box>}
          <Badge color="blue" variant="filled" size="sm" radius="sm">Cal</Badge>
          <Text fw={500} size="sm">
            {view === 'month'
              ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            }
          </Text>
          {fetching && <Loader size={12} />}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={goBack}>‹</ActionIcon>
          <Button size="xs" variant="subtle" color="gray" onClick={goToday}>Today</Button>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={goForward}>›</ActionIcon>
          <SegmentedControl size="xs" value={view} onChange={setView}
            data={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
          <Button size="xs" color="blue" onClick={() => openCreate(new Date())}>+ Add</Button>
        </Group>
      </Group>

      {!connected ? (
        <Box style={{ textAlign: 'center', padding: '32px 16px', border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
          <Text size="sm" c="dimmed" mb="sm">Connect Google Calendar to see your events here.</Text>
          <Button size="sm" color="blue" component="a" href={`${API_BASE}/api/google/connect?token=${localStorage.getItem('auth_token')}`}>
            Connect Google Calendar
          </Button>
        </Box>
      ) : needsReconnect ? (
        <Alert color="blue" mb="md">
          <Stack gap="xs">
            <Text size="sm">Reconnect Google Calendar to enable full access (required for adding/editing events).</Text>
            <Button size="xs" color="blue" component="a" href={`${API_BASE}/api/google/connect?token=${localStorage.getItem('auth_token')}`}>
              Reconnect
            </Button>
          </Stack>
        </Alert>
      ) : view === 'month' ? (
        <Box mb="md">
          {/* DOW headers */}
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderLeft: '1px solid var(--mantine-color-default-border)', borderTop: '1px solid var(--mantine-color-default-border)', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
            {DOW.map(d => (
              <Box key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, background: 'var(--mantine-color-default-hover)', borderRight: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                {d}
              </Box>
            ))}
          </Box>
          {/* Day grid */}
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderLeft: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            {monthGrid.map((day, i) => (
              <DayCell
                key={i}
                day={day}
                events={eventsForDay(day.date, events)}
                onClick={() => openCreate(day.date)}
                onEventClick={openEvent}
              />
            ))}
          </Box>
        </Box>
      ) : (
        <Box mb="md">
          <WeekView
            weekStart={weekStart}
            events={events}
            onEventClick={openEvent}
            onSlotClick={(date, hour) => openCreate(date, hour)}
          />
        </Box>
      )}

      <EventModal
        opened={modalOpen}
        mode={modalMode}
        event={selectedEvent}
        defaultDate={selectedDate}
        defaultHour={selectedHour}
        calendars={calendars}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Box>
  );
}
