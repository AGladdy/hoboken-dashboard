import { useState, useEffect, useRef } from 'react';
import { Box, Paper, Stack, Title, Text, TextInput, PasswordInput, Button, Anchor, ThemeIcon, Alert, Divider } from '@mantine/core';
import { useAuth } from './AuthContext';
import { API_BASE } from './ConfigContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthPage() {
  const { login, signup, googleLogin } = useAuth();
  const googleBtnRef = useRef(null);
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError('');
          setLoading(true);
          try {
            await googleLogin(credential);
          } catch (e) {
            setError(e.message);
          } finally {
            setLoading(false);
          }
        },
      });
      window.google?.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black', size: 'large', width: 352, text: 'continue_with',
      });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [googleLogin]);

  const submit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        if (!email.trim() || !password) return;
        await login(email.trim(), password);
      } else if (mode === 'signup') {
        if (!email.trim() || !password) return;
        await signup(email.trim(), password);
      } else if (mode === 'forgot') {
        if (!email.trim()) return;
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Request failed');
        }
        setSuccess('If that email exists, a reset link has been sent. Check your inbox.');
      } else if (mode === 'reset') {
        if (!password) return;
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Reset failed');
        setSuccess('Password updated! You can now sign in.');
        setMode('login');
        setPassword('');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') submit(); };

  const titles = {
    login: 'Welcome back',
    signup: 'Create your dashboard',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };
  const subtitles = {
    login: 'Sign in to your dashboard',
    signup: 'Get started in seconds',
    forgot: "We'll email you a reset link",
    reset: 'Enter your new password below',
  };

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Paper withBorder p="xl" radius="lg" style={{ width: '100%', maxWidth: 400 }}>
        <Stack gap="xl">
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="violet">
              <Text size="xl">✦</Text>
            </ThemeIcon>
            <Title order={3} ta="center">{titles[mode]}</Title>
            <Text size="sm" c="dimmed" ta="center">{subtitles[mode]}</Text>
          </Stack>

          <Stack gap="sm">
            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <TextInput
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.currentTarget.value)}
                onKeyDown={handleKey}
                autoFocus
                type="email"
              />
            )}
            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <PasswordInput
                label="Password"
                placeholder={mode === 'signup' || mode === 'reset' ? 'At least 8 characters' : ''}
                value={password}
                onChange={e => setPassword(e.currentTarget.value)}
                onKeyDown={handleKey}
                autoFocus={mode === 'reset'}
              />
            )}
            {error && <Alert color="red" p="xs" radius="sm"><Text size="sm">{error}</Text></Alert>}
            {success && <Alert color="green" p="xs" radius="sm"><Text size="sm">{success}</Text></Alert>}
            {!success && (
              <Button
                color="violet"
                onClick={submit}
                loading={loading}
                disabled={
                  (mode === 'login' && (!email.trim() || !password)) ||
                  (mode === 'signup' && (!email.trim() || !password)) ||
                  (mode === 'forgot' && !email.trim()) ||
                  (mode === 'reset' && !password)
                }
                mt={4}
              >
                {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Set new password'}
              </Button>
            )}
          </Stack>

          {(mode === 'login' || mode === 'signup') && GOOGLE_CLIENT_ID && (
            <>
              <Divider label="or" labelPosition="center" />
              <Box ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
            </>
          )}

          <Stack gap={4} align="center">
            {mode === 'login' && (
              <>
                <Text size="sm" c="dimmed">
                  Don't have an account?{' '}
                  <Anchor size="sm" c="violet" onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Sign up</Anchor>
                </Text>
                <Anchor size="xs" c="dimmed" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}>
                  Forgot your password?
                </Anchor>
              </>
            )}
            {mode === 'signup' && (
              <Text size="sm" c="dimmed">
                Already have an account?{' '}
                <Anchor size="sm" c="violet" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Sign in</Anchor>
              </Text>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <Anchor size="sm" c="dimmed" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                Back to sign in
              </Anchor>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
