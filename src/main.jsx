import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme, Box, PinInput, Text, Stack } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import Dashboard from './Dashboard'

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

const CORRECT_PIN = '6514'
const STORAGE_KEY = 'gl_auth'

function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')
  const [error, setError] = useState(false)

  if (authed) return <Dashboard />

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="md">
        <Text fw={700} size="xl">Gladdy's Life</Text>
        <Text size="sm" c="dimmed">Enter your PIN</Text>
        <PinInput
          length={4}
          type="number"
          mask
          autoFocus
          error={error}
          onComplete={(val) => {
            if (val === CORRECT_PIN) {
              localStorage.setItem(STORAGE_KEY, '1')
              setAuthed(true)
            } else {
              setError(true)
              setTimeout(() => setError(false), 1000)
            }
          }}
        />
        {error && <Text size="xs" c="red">Incorrect PIN</Text>}
      </Stack>
    </Box>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <App />
    </MantineProvider>
  </React.StrictMode>
)
