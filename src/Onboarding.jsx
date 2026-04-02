import { useState } from 'react';
import {
  Box, Stack, Text, TextInput, NumberInput, Button, Group,
  PinInput, Stepper, Paper, Title, ThemeIcon
} from '@mantine/core';
import { useConfig, API_BASE } from './ConfigContext';

export default function Onboarding({ onComplete }) {
  const { saveConfig } = useConfig();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Profile
  const [displayName, setDisplayName] = useState('');
  const [appTitle, setAppTitle] = useState('');

  // Step 1 — Location
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);

  // Step 2 — PIN
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  const next = async () => {
    if (step === 0) {
      if (!displayName.trim()) return;
      setStep(1);
    } else if (step === 1) {
      if (!city.trim() || !lat || !lon) return;
      setStep(2);
    } else if (step === 2) {
      if (pin && pin !== pinConfirm) {
        setPinError('PINs do not match');
        return;
      }
      setSaving(true);
      try {
        const patch = {
          display_name: displayName.trim(),
          app_title: appTitle.trim() || `${displayName.trim()}'s Dashboard`,
          location: { city: city.trim(), lat: Number(lat), lon: Number(lon), address: address.trim() || city.trim() },
        };
        if (pin) patch.pin = pin;
        await saveConfig(patch);
        onComplete();
      } finally {
        setSaving(false);
      }
    }
  };

  const back = () => setStep(s => s - 1);

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
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
              <TextInput
                label="City"
                placeholder="Hoboken, NJ"
                value={city}
                onChange={e => setCity(e.currentTarget.value)}
                required
                autoFocus
              />
              <TextInput
                label="Street address"
                placeholder="The White House, 1600 Pennsylvania Ave NW"
                value={address}
                onChange={e => setAddress(e.currentTarget.value)}
                description="Used in AI search prompts for better local context"
              />
              <Group grow>
                <NumberInput
                  label="Latitude"
                  placeholder="40.7440"
                  value={lat}
                  onChange={setLat}
                  decimalScale={6}
                />
                <NumberInput
                  label="Longitude"
                  placeholder="-74.0324"
                  value={lon}
                  onChange={setLon}
                  decimalScale={6}
                />
              </Group>
              <Button
                size="xs"
                variant="default"
                onClick={useMyLocation}
                loading={locating}
              >
                📍 Use my current location
              </Button>
            </Stack>
          )}

          {step === 2 && (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Optionally set a 4-digit PIN to prevent others from changing your settings.
                The dashboard itself is always publicly viewable.
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
                (step === 1 && (!city.trim() || !lat || !lon))
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
