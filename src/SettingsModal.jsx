import { useState } from 'react';
import { Modal, Tabs, TextInput, NumberInput, PinInput, Button, Stack, Switch, Group, Text, Divider } from '@mantine/core';
import { useConfig } from './ConfigContext';

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
          <Tabs.Tab value="security">PIN</Tabs.Tab>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
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
      </Tabs>
    </Modal>
  );
}
