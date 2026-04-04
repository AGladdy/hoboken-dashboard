import { useState, useEffect, useRef } from 'react';
import { Box, Paper, Stack, Title, Text, TextInput, PasswordInput, Button, Anchor, ThemeIcon, Alert, Divider } from '@mantine/core';
import { useAuth } from './AuthContext';
import { API_BASE } from './ConfigContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID;

export default function AuthPage() {
  const { login, signup, googleLogin, appleLogin } = useAuth();
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

  useEffect(() => {
    if (!APPLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      window.AppleID?.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await window.AppleID.auth.signIn();
      await appleLogin(data.authorization.id_token);
    } catch (e) {
      if (e?.error !== 'popup_closed_by_user') setError(e?.message || 'Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

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

          {(mode === 'login' || mode === 'signup') && (GOOGLE_CLIENT_ID || APPLE_CLIENT_ID) && (
            <>
              <Divider label="or" labelPosition="center" />
              {GOOGLE_CLIENT_ID && (
                <Box style={{ position: 'relative', height: 42 }}>
                  <Button
                    variant="default" fullWidth
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
                    leftSection={
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                    }
                  >
                    Continue with Google
                  </Button>
                  <Box ref={googleBtnRef} style={{ position: 'absolute', inset: 0, zIndex: 2, opacity: 0, overflow: 'hidden' }} />
                </Box>
              )}
              {APPLE_CLIENT_ID && (
                <Button
                  variant="default" fullWidth onClick={handleAppleSignIn} loading={loading}
                  leftSection={
                    <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 411.3 8 224.8 8 148.9c0-111.9 73-170.6 144.3-170.6 76 0 130.3 50.9 171.1 50.9 39.9 0 103.7-53 192.1-53 57.8 0 164 11.4 224.2 105.9zm-232.6-111c-8.6-40.2-26.6-81.4-57.8-113.3-31.2-31.9-71.9-53-114.4-53-1.9 0-3.8 0-5.7.3 1.9 42.8 18.6 84.7 49.5 116.7 31.2 32.3 71.9 54.2 128.4 49.3z"/>
                    </svg>
                  }
                >
                  Continue with Apple
                </Button>
              )}
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
