import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme, Box, PinInput, Text, Stack, Loader } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import Dashboard from './Dashboard'
import { ConfigProvider, useConfig, API_BASE } from './ConfigContext'

const theme = createTheme({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  primaryColor: 'violet',
  defaultRadius: 'md',
})

const cssVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-text': '#111111',
    '--mantine-color-dimmed': '#444444',
  },
  dark: {},
})

const STORAGE_KEY = 'gl_auth'

function App() {
  const { config, loading: configLoading } = useConfig();
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (config.app_title) document.title = config.app_title;
  }, [config.app_title]);

  if (authed) return <Dashboard />

  if (configLoading) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size="sm" />
      </Box>
    );
  }

  // If no PIN set (empty hash), skip lock screen
  const hasPinLock = Boolean(config.pin_hash_set);

  if (!hasPinLock) {
    localStorage.setItem(STORAGE_KEY, '1');
    setAuthed(true);
    return null;
  }

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="md">
        <Text fw={700} size="xl">{config.app_title || 'My Dashboard'}</Text>
        <Text size="sm" c="dimmed">Enter your PIN</Text>
        <PinInput
          length={4}
          type="number"
          mask
          autoFocus
          error={error}
          disabled={verifying}
          onComplete={async (val) => {
            setVerifying(true);
            try {
              const res = await fetch(`${API_BASE}/api/config/verify-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: val }),
              });
              const { valid } = await res.json();
              if (valid) {
                localStorage.setItem(STORAGE_KEY, '1');
                setAuthed(true);
              } else {
                setError(true);
                setTimeout(() => setError(false), 1000);
              }
            } catch {
              setError(true);
              setTimeout(() => setError(false), 1000);
            } finally {
              setVerifying(false);
            }
          }}
        />
        {error && <Text size="xs" c="red">Incorrect PIN</Text>}
        {verifying && <Loader size="xs" />}
      </Stack>
    </Box>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MantineProvider>
  </React.StrictMode>
)
