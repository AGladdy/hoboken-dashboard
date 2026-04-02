import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BASE = import.meta.env.VITE_API_BASE || 'https://hoboken-dashboard-production.up.railway.app';

export const DEFAULT_CONFIG = {
  display_name: 'User',
  app_title: 'My Dashboard',
  location: { city: 'Hoboken, NJ', lat: 40.744, lon: -74.032, address: 'Hoboken, NJ' },
  visible_sections: ['weather','strava','path','ferry','bus','news','stocks','sports','events','restaurants'],
};

const ConfigContext = createContext({ config: DEFAULT_CONFIG, loading: true, saveConfig: async () => {} });

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/config`)
      .then(r => r.json())
      .then(data => setConfig(prev => ({ ...prev, ...data })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = useCallback(async (patch) => {
    const res = await fetch(`${BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const updated = await res.json();
    setConfig(prev => ({ ...prev, ...updated }));
    return updated;
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, saveConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);
export { BASE as API_BASE };
