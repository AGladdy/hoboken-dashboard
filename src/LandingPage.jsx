import { Box, Button, Text, Title, Stack, Group, Badge, SimpleGrid, ThemeIcon, Paper } from '@mantine/core';

const FEATURES = [
  { icon: '🚇', label: 'Live Transit', desc: 'Real-time PATH, ferry, and bus departures from your station.' },
  { icon: '🌤', label: 'Weather', desc: 'Current conditions, hourly forecast, and AI-generated narrative.' },
  { icon: '📈', label: 'Stocks', desc: 'Top 100 stocks with sparklines. Build a custom watchlist.' },
  { icon: '🏃', label: 'Fitness', desc: 'Strava activity feed, weekly stats, and calorie tracking.' },
  { icon: '🎟', label: 'Events', desc: 'NYC events this week pulled from Ticketmaster.' },
  { icon: '🍽', label: 'Restaurants', desc: 'Top-rated spots near you via Foursquare.' },
  { icon: '📰', label: 'News', desc: 'Headlines from Reuters, AP, NYT, CNBC, The Verge, and more.' },
  { icon: '🤖', label: 'AI Search', desc: 'Ask anything. Claude answers using your live dashboard data.' },
];

export default function LandingPage({ onGetStarted }) {
  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <Group justify="space-between" px={{ base: 'lg', sm: 48 }} py="md">
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" variant="light" color="violet">
            <Text size="sm">✦</Text>
          </ThemeIcon>
          <Text fw={700} size="lg">Dashboard</Text>
        </Group>
        <Button size="xs" variant="default" onClick={onGetStarted}>Sign in</Button>
      </Group>

      {/* Hero */}
      <Box
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}
      >
        <Stack align="center" gap="xl" style={{ maxWidth: 640, width: '100%' }}>
          <Stack align="center" gap="sm">
            <Badge size="lg" variant="light" color="violet" radius="xl">Personal dashboard</Badge>
            <Title order={1} ta="center" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', lineHeight: 1.15 }}>
              Everything you need,<br />before you leave the door.
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={480}>
              Live transit, weather, news, stocks, fitness, and events — all in one place, powered by AI.
            </Text>
          </Stack>

          <Group gap="sm">
            <Button size="md" color="violet" radius="md" onClick={onGetStarted}>
              Get started free
            </Button>
            <Button
              size="md" variant="default" radius="md"
              component="a"
              href="https://github.com/AGladdy/hoboken-dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </Button>
          </Group>

          <Text size="xs" c="dimmed">No credit card required · Self-hostable · Open source</Text>
        </Stack>
      </Box>

      {/* Features */}
      <Box px={{ base: 'lg', sm: 48 }} pb={80}>
        <Text size="sm" fw={600} c="dimmed" tt="uppercase" ta="center" mb="xl" style={{ letterSpacing: '0.08em' }}>
          What's on your dashboard
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" style={{ maxWidth: 900, margin: '0 auto' }}>
          {FEATURES.map(f => (
            <Paper key={f.label} withBorder p="md" radius="md">
              <Stack gap={6}>
                <Text size="xl">{f.icon}</Text>
                <Text size="sm" fw={600}>{f.label}</Text>
                <Text size="xs" c="dimmed">{f.desc}</Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Box>

      {/* Footer CTA */}
      <Box
        style={{ borderTop: '1px solid var(--mantine-color-default-border)', padding: '48px 24px' }}
      >
        <Stack align="center" gap="md">
          <Title order={3} ta="center">Ready to build yours?</Title>
          <Text size="sm" c="dimmed" ta="center">
            Set up in under 2 minutes. Customizable sections, locations, and watchlists.
          </Text>
          <Button size="md" color="violet" radius="md" onClick={onGetStarted}>
            Create your dashboard
          </Button>
        </Stack>
      </Box>

    </Box>
  );
}
