import { useState } from 'react';
import { Box, Paper, Stack, Title, Text, TextInput, PasswordInput, Button, Anchor, ThemeIcon, Alert } from '@mantine/core';
import { useAuth } from './AuthContext';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Paper withBorder p="xl" radius="lg" style={{ width: '100%', maxWidth: 400 }}>
        <Stack gap="xl">
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="violet">
              <Text size="xl">✦</Text>
            </ThemeIcon>
            <Title order={3} ta="center">
              {mode === 'login' ? 'Welcome back' : 'Create your dashboard'}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {mode === 'login' ? 'Sign in to your dashboard' : 'Get started in seconds'}
            </Text>
          </Stack>

          <Stack gap="sm">
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.currentTarget.value)}
              onKeyDown={handleKey}
              autoFocus
              type="email"
            />
            <PasswordInput
              label="Password"
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              onKeyDown={handleKey}
            />
            {error && <Alert color="red" p="xs" radius="sm"><Text size="sm">{error}</Text></Alert>}
            <Button
              color="violet"
              onClick={submit}
              loading={loading}
              disabled={!email.trim() || !password}
              mt={4}
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </Stack>

          <Text size="sm" ta="center" c="dimmed">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Anchor
              size="sm"
              c="violet"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
}
