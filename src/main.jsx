import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import Dashboard from './Dashboard'
import { ConfigProvider, useConfig } from './ConfigContext'

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

function App() {
  const { config } = useConfig();

  useEffect(() => {
    if (config.app_title) document.title = config.app_title;
  }, [config.app_title]);

  return <Dashboard />;
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
