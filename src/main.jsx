import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <Dashboard />
    </MantineProvider>
  </React.StrictMode>
)
