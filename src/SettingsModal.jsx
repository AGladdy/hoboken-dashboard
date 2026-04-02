import { useState } from 'react';
import { Modal, Tabs, TextInput, NumberInput, PinInput, Button, Stack, Switch, Group, Text, Divider, Textarea, Select, ActionIcon, Badge, Box } from '@mantine/core';
import { useConfig } from './ConfigContext';
import { useAuth } from './AuthContext';

const EMPTY_LINE = {
  id: null, name: '', type: 'bus', from: '', to: '', tripTime: 20,
  weekday: '', weekend: '', returnWeekday: '', returnWeekend: '',
};

function parseTimes(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}
function joinTimes(arr) {
  return (arr || []).join(', ');
}

function LineEditor({ line, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...EMPTY_LINE, ...line,
    weekday: joinTimes(line.weekday),
    weekend: joinTimes(line.weekend),
    returnWeekday: joinTimes(line.returnWeekday),
    returnWeekend: joinTimes(line.returnWeekend),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    onSave({
      ...form,
      id: form.id || Date.now().toString(),
      tripTime: Number(form.tripTime),
      weekday: parseTimes(form.weekday),
      weekend: parseTimes(form.weekend),
      returnWeekday: parseTimes(form.returnWeekday),
      returnWeekend: parseTimes(form.returnWeekend),
    });
  };

  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput label="Line name" placeholder="126 Bus to 42nd St" value={form.name} onChange={e => set('name', e.currentTarget.value)} />
        <Select label="Type" value={form.type} onChange={v => set('type', v)} data={['bus','ferry','rail','subway','tram']} />
      </Group>
      <Group grow>
        <TextInput label="From" placeholder="Hoboken Terminal" value={form.from} onChange={e => set('from', e.currentTarget.value)} />
        <TextInput label="To" placeholder="Port Authority" value={form.to} onChange={e => set('to', e.currentTarget.value)} />
      </Group>
      <NumberInput label="Trip time (min)" value={form.tripTime} onChange={v => set('tripTime', v)} min={1} max={180} />
      <Textarea label="Weekday departures (comma-separated)" placeholder="6:10 AM, 6:30 AM, 7:00 AM..." value={form.weekday} onChange={e => set('weekday', e.currentTarget.value)} minRows={2} autosize />
      <Textarea label="Weekend departures" placeholder="8:00 AM, 8:30 AM..." value={form.weekend} onChange={e => set('weekend', e.currentTarget.value)} minRows={2} autosize />
      <Textarea label="Return weekday departures" placeholder="6:00 AM, 6:30 AM..." value={form.returnWeekday} onChange={e => set('returnWeekday', e.currentTarget.value)} minRows={2} autosize />
      <Textarea label="Return weekend departures" placeholder="7:00 AM, 7:30 AM..." value={form.returnWeekend} onChange={e => set('returnWeekend', e.currentTarget.value)} minRows={2} autosize />
      <Group>
        <Button size="xs" onClick={save} disabled={!form.name.trim()}>Save line</Button>
        <Button size="xs" variant="default" onClick={onCancel}>Cancel</Button>
      </Group>
    </Stack>
  );
}

const ALL_SECTIONS = [
  { id: 'weather',     label: 'Weather' },
  { id: 'strava',      label: 'Fitness (Strava)' },
  { id: 'path',        label: 'PATH Trains' },
  { id: 'ferry',       label: 'Ferry' },
  { id: 'bus',         label: 'Bus 126' },
  { id: 'news',        label: 'News' },
  { id: 'stocks',      label: 'Stocks' },
  { id: 'sports',      label: 'Sports' },
  { id: 'events',      label: 'Events' },
  { id: 'restaurants', label: 'Restaurants' },
];

export default function SettingsModal({ opened, onClose }) {
  const { config, saveConfig } = useConfig();
  const { user, logout } = useAuth();

  const [displayName, setDisplayName] = useState(config.display_name || '');
  const [appTitle, setAppTitle] = useState(config.app_title || '');
  const [city, setCity] = useState(config.location?.city || '');
  const [lat, setLat] = useState(config.location?.lat ?? 40.744);
  const [lon, setLon] = useState(config.location?.lon ?? -74.032);
  const [address, setAddress] = useState(config.location?.address || '');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [visible, setVisible] = useState(config.visible_sections || ALL_SECTIONS.map(s => s.id));
  const [watchlist, setWatchlist] = useState(config.stock_watchlist ? config.stock_watchlist.join(', ') : '');
  const [transitLines, setTransitLines] = useState(config.transit_lines || []);
  const [editingLine, setEditingLine] = useState(null); // null | 'new' | line object
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  const save = async (patch, label) => {
    setSaving(true);
    try {
      await saveConfig(patch);
      setSaved(label);
      setTimeout(() => setSaved(''), 2000);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = () => save({ display_name: displayName, app_title: appTitle }, 'profile');

  const saveLocation = () => {
    if (navigator.geolocation) {
      // optional: could auto-fill but just save what's entered
    }
    save({ location: { city, lat: Number(lat), lon: Number(lon), address } }, 'location');
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setLat(pos.coords.latitude.toFixed(4));
      setLon(pos.coords.longitude.toFixed(4));
    });
  };

  const savePin = () => {
    if (pin !== pinConfirm) { setPinError('PINs do not match'); return; }
    if (pin && pin.length !== 4) { setPinError('PIN must be 4 digits'); return; }
    setPinError('');
    save({ pin: pin || '' }, 'PIN');
    setPin('');
    setPinConfirm('');
  };

  const saveSections = () => save({ visible_sections: visible }, 'sections');

  const toggleSection = (id) => {
    setVisible(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="md">
      <Tabs defaultValue="profile">
        <Tabs.List mb="md">
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="location">Location</Tabs.Tab>
          <Tabs.Tab value="transit">Transit</Tabs.Tab>
          <Tabs.Tab value="security">PIN</Tabs.Tab>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
          <Tabs.Tab value="stocks">Stocks</Tabs.Tab>
          <Tabs.Tab value="account">Account</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="profile">
          <Stack gap="sm">
            <TextInput label="Your name" value={displayName} onChange={e => setDisplayName(e.currentTarget.value)} placeholder="Adam" />
            <TextInput label="App title" value={appTitle} onChange={e => setAppTitle(e.currentTarget.value)} placeholder="My Dashboard" />
            <Button size="sm" onClick={saveProfile} loading={saving}>{saved === 'profile' ? 'Saved!' : 'Save'}</Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="location">
          <Stack gap="sm">
            <TextInput label="City label" value={city} onChange={e => setCity(e.currentTarget.value)} placeholder="Hoboken, NJ" />
            <TextInput label="Street address (used in AI prompts)" value={address} onChange={e => setAddress(e.currentTarget.value)} placeholder="205 Hudson St, Hoboken, NJ" />
            <Group grow>
              <NumberInput label="Latitude" value={lat} onChange={setLat} decimalScale={6} step={0.001} />
              <NumberInput label="Longitude" value={lon} onChange={setLon} decimalScale={6} step={0.001} />
            </Group>
            <Button size="xs" variant="default" onClick={useMyLocation}>Use my current location</Button>
            <Button size="sm" onClick={saveLocation} loading={saving}>{saved === 'location' ? 'Saved!' : 'Save'}</Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="security">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Set a 4-digit PIN to lock the dashboard. Leave blank to disable the PIN lock.</Text>
            <Divider />
            <Text size="xs" fw={500}>New PIN</Text>
            <PinInput length={4} type="number" mask value={pin} onChange={setPin} />
            <Text size="xs" fw={500}>Confirm PIN</Text>
            <PinInput length={4} type="number" mask value={pinConfirm} onChange={setPinConfirm} />
            {pinError && <Text size="xs" c="red">{pinError}</Text>}
            <Button size="sm" onClick={savePin} loading={saving}>{saved === 'PIN' ? 'Saved!' : 'Save PIN'}</Button>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="transit">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Configure ferry, bus, or rail lines with custom schedules.
              Leave empty to use the built-in Hoboken defaults.
            </Text>
            {transitLines.map((line, i) => (
              <Box key={line.id}>
                <Group justify="space-between" p="xs" style={{ background: 'var(--mantine-color-default-hover)', borderRadius: 6 }}>
                  <Group gap="xs">
                    <Badge size="xs" variant="light" color="blue">{line.type}</Badge>
                    <Text size="sm" fw={500}>{line.name}</Text>
                    <Text size="xs" c="dimmed">{line.from} → {line.to}</Text>
                  </Group>
                  <Group gap="xs">
                    <ActionIcon size="sm" variant="default" onClick={() => setEditingLine(line)}>✏</ActionIcon>
                    <ActionIcon size="sm" variant="default" color="red" onClick={() => {
                      const next = transitLines.filter((_, j) => j !== i);
                      setTransitLines(next);
                    }}>✕</ActionIcon>
                  </Group>
                </Group>
                {editingLine?.id === line.id && (
                  <Box mt="xs" p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 6 }}>
                    <LineEditor
                      line={editingLine}
                      onSave={(updated) => {
                        setTransitLines(prev => prev.map(l => l.id === updated.id ? updated : l));
                        setEditingLine(null);
                      }}
                      onCancel={() => setEditingLine(null)}
                    />
                  </Box>
                )}
              </Box>
            ))}
            {editingLine === 'new' && (
              <Box p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 6 }}>
                <LineEditor
                  line={EMPTY_LINE}
                  onSave={(newLine) => {
                    setTransitLines(prev => [...prev, newLine]);
                    setEditingLine(null);
                  }}
                  onCancel={() => setEditingLine(null)}
                />
              </Box>
            )}
            {editingLine !== 'new' && (
              <Button size="xs" variant="default" onClick={() => setEditingLine('new')}>+ Add line</Button>
            )}
            <Divider />
            <Group>
              <Button size="sm" onClick={() => save({ transit_lines: transitLines }, 'transit')} loading={saving}>
                {saved === 'transit' ? 'Saved!' : 'Save transit config'}
              </Button>
              {transitLines.length > 0 && (
                <Button size="sm" variant="default" color="red" onClick={() => { setTransitLines([]); save({ transit_lines: [] }, 'transit'); }}>
                  Reset to defaults
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="sections">
          <Stack gap="xs">
            <Text size="sm" c="dimmed" mb="xs">Toggle which sections appear on your dashboard.</Text>
            {ALL_SECTIONS.map(s => (
              <Switch
                key={s.id}
                label={s.label}
                checked={visible.includes(s.id)}
                onChange={() => toggleSection(s.id)}
              />
            ))}
            <Button size="sm" mt="sm" onClick={saveSections} loading={saving}>{saved === 'sections' ? 'Saved!' : 'Save'}</Button>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="stocks">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Enter stock symbols to track, comma-separated. Leave empty to show the full top 100 by market cap.
            </Text>
            <Textarea
              label="Watchlist"
              placeholder="AAPL, TSLA, NVDA, MSFT, GOOGL..."
              value={watchlist}
              onChange={e => setWatchlist(e.currentTarget.value)}
              minRows={3}
              autosize
            />
            <Text size="xs" c="dimmed">
              {watchlist.split(',').map(s => s.trim()).filter(Boolean).length > 0
                ? `${watchlist.split(',').map(s => s.trim()).filter(Boolean).length} symbols`
                : 'Showing all top 100'}
            </Text>
            <Button size="sm" onClick={() => {
              const symbols = watchlist.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
              save({ stock_watchlist: symbols.length > 0 ? symbols : null }, 'watchlist');
            }} loading={saving}>
              {saved === 'watchlist' ? 'Saved!' : 'Save'}
            </Button>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="account">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Signed in as</Text>
            <Text size="sm" fw={500}>{user?.email || '—'}</Text>
            <Divider />
            <Button size="sm" variant="default" color="red" onClick={() => { onClose(); logout(); }}>
              Sign out
            </Button>
          </Stack>
        </Tabs.Panel>

      </Tabs>
    </Modal>
  );
}
