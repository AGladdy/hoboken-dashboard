import { useState, useEffect, useRef } from 'react';
import {
  Box, Stack, Text, TextInput, Button, Group,
  PinInput, Stepper, Paper, Title, ThemeIcon, Combobox, useCombobox, Loader
} from '@mantine/core';
import { useConfig, API_BASE } from './ConfigContext';

async function geocodeCity(query) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
  const data = await r.json();
  return (data.results || []).map(r => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export default function Onboarding({ onComplete }) {
  const { saveConfig } = useConfig();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Profile
  const [displayName, setDisplayName] = useState('');
  const [appTitle, setAppTitle] = useState('');

  // Step 1 — Location
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState(null); // { label, lat, lon }
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  // Step 2 — PIN
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (cityInput.length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeCity(cityInput);
        setSuggestions(results);
        if (results.length > 0) combobox.openDropdown();
      } catch {}
      finally { setSearching(false); }
    }, 350);
  }, [cityInput]);

  const next = async () => {
    if (step === 0) {
      if (!displayName.trim()) return;
      setStep(1);
    } else if (step === 1) {
      if (!selectedCity) return;
      setStep(2);
    } else if (step === 2) {
      if (pin && pin !== pinConfirm) { setPinError('PINs do not match'); return; }
      setSaving(true);
      try {
        const patch = {
          display_name: displayName.trim(),
          app_title: appTitle.trim() || `${displayName.trim()}'s Dashboard`,
          location: {
            city: selectedCity.label,
            lat: selectedCity.lat,
            lon: selectedCity.lon,
            address: address.trim() || selectedCity.label,
          },
        };
        if (pin) patch.pin = pin;
        await saveConfig(patch);
        onComplete();
      } finally { setSaving(false); }
    }
  };

  const back = () => setStep(s => s - 1);

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Paper withBorder p="xl" radius="lg" style={{ width: '100%', maxWidth: 480 }}>
        <Stack gap="xl">
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="violet">
              <Text size="xl">✦</Text>
            </ThemeIcon>
            <Title order={3} ta="center">Welcome to your dashboard</Title>
            <Text size="sm" c="dimmed" ta="center">Let's get you set up in 3 quick steps.</Text>
          </Stack>

          <Stepper active={step} size="sm" color="violet">
            <Stepper.Step label="Profile" />
            <Stepper.Step label="Location" />
            <Stepper.Step label="Security" />
          </Stepper>

          {step === 0 && (
            <Stack gap="sm">
              <TextInput
                label="Your first name"
                placeholder="Adam"
                value={displayName}
                onChange={e => setDisplayName(e.currentTarget.value)}
                required
                autoFocus
              />
              <TextInput
                label="Dashboard title"
                placeholder={displayName ? `${displayName}'s Dashboard` : 'My Dashboard'}
                value={appTitle}
                onChange={e => setAppTitle(e.currentTarget.value)}
                description="Shown in the browser tab and header"
              />
            </Stack>
          )}

          {step === 1 && (
            <Stack gap="sm">
              <Combobox
                store={combobox}
                onOptionSubmit={val => {
                  const found = suggestions.find(s => s.label === val);
                  if (found) { setSelectedCity(found); setCityInput(found.label); }
                  combobox.closeDropdown();
                }}
              >
                <Combobox.Target>
                  <TextInput
                    label="City"
                    placeholder="Search for your city…"
                    value={cityInput}
                    onChange={e => { setCityInput(e.currentTarget.value); setSelectedCity(null); combobox.openDropdown(); }}
                    onFocus={() => suggestions.length > 0 && combobox.openDropdown()}
                    rightSection={searching ? <Loader size="xs" /> : null}
                    required
                    autoFocus
                    description={selectedCity ? `${selectedCity.lat.toFixed(4)}, ${selectedCity.lon.toFixed(4)}` : 'Coordinates will fill automatically'}
                  />
                </Combobox.Target>
                <Combobox.Dropdown>
                  <Combobox.Options>
                    {suggestions.map(s => (
                      <Combobox.Option key={s.label} value={s.label}>{s.label}</Combobox.Option>
                    ))}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
              <TextInput
                label="Street address"
                placeholder="123 Main St (optional — used in AI search for local context)"
                value={address}
                onChange={e => setAddress(e.currentTarget.value)}
              />
            </Stack>
          )}

          {step === 2 && (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Optionally set a 4-digit PIN to prevent others from changing your settings.
              </Text>
              <Text size="xs" fw={500}>PIN <Text span c="dimmed">(optional)</Text></Text>
              <PinInput length={4} type="number" mask value={pin} onChange={setPin} />
              {pin.length === 4 && (
                <>
                  <Text size="xs" fw={500}>Confirm PIN</Text>
                  <PinInput length={4} type="number" mask value={pinConfirm} onChange={setPinConfirm} />
                </>
              )}
              {pinError && <Text size="xs" c="red">{pinError}</Text>}
            </Stack>
          )}

          <Group justify="space-between">
            {step > 0
              ? <Button variant="default" size="sm" onClick={back}>Back</Button>
              : <Box />
            }
            <Button
              size="sm"
              color="violet"
              onClick={next}
              loading={saving}
              disabled={
                (step === 0 && !displayName.trim()) ||
                (step === 1 && !selectedCity)
              }
            >
              {step === 2 ? (pin ? 'Finish' : 'Skip & Finish') : 'Continue'}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
