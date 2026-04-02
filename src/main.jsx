import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme, Box, Loader } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import Dashboard from './Dashboard'
import Onboarding from './Onboarding'
import AuthPage from './AuthPage'
import LandingPage from './LandingPage'
import { ConfigProvider, useConfig } from './ConfigContext'
import { AuthProvider, useAuth } from './AuthContext'

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
  const { user, loading: authLoading } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const [onboarded, setOnboarded] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (config.app_title) document.title = config.app_title;
  }, [config.app_title]);

  if (authLoading || (user && configLoading)) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size="sm" />
      </Box>
    );
  }

  if (!user) {
    if (!showAuth) return <LandingPage onGetStarted={() => setShowAuth(true)} />;
    return <AuthPage />;
  }

  const isFresh = !onboarded && config.display_name === 'User';
  if (isFresh) return <Onboarding onComplete={() => setOnboarded(true)} />;

  return <Dashboard />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <AuthProvider>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </AuthProvider>
    </MantineProvider>
  </React.StrictMode>
)
