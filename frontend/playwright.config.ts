import { defineConfig, devices } from '@playwright/test'

const database = process.env.MURIM_TEST_DATABASE_URL
if (!database) throw new Error('Configure MURIM_TEST_DATABASE_URL para o PostgreSQL local descartável.')
const url = new URL(database)
if (url.protocol !== 'postgresql:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/murim_fastapi_test' || url.search) {
  throw new Error('Os testes requerem PostgreSQL local no banco murim_fastapi_test.')
}

const origin = 'http://127.0.0.1:38200'
const auth = 'http://127.0.0.1:38203'
const backend = 'http://127.0.0.1:38202'
const next = 'http://127.0.0.1:38206'
export default defineConfig({
  testDir: './tests',
  workers: 2,
  timeout: 60_000,
  use: { baseURL: origin, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.CHROME_BIN } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/nitro-auth.mjs', url: auth + '/api/health',
      env: {
        HOST: '127.0.0.1', PORT: '38203', DATABASE_URL: database, BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: 'frontend-tests-isolated-better-auth-only-secret',
        RESEND_API_KEY: 'fixture', AUTH_EMAIL_FROM: 'Murim <test@example.test>',
        NUXT_MURIM_FASTAPI_ORIGIN: backend,
        NUXT_SECURITY_RATE_LIMITER_TOKENS_PER_INTERVAL: '1000',
      },
    },
    {
      command: '../backend/.venv/bin/python tests/fastapi_providers.py',
      url: backend + '/api/ready',
      env: {
        PYTHONPATH: '../backend', DATABASE_URL: database, AUTH_ORIGIN: auth, BETTER_AUTH_URL: origin, ENABLE_WRITES: 'true',
        GEMINI_API_KEY: 'fixture-gemini', GEMINI_MODEL: 'fixture-model',
        STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'fixture-strava',
        STRAVA_SESSION_SECRET: 'fixture-only-strava-session-secret-long-enough',
      },
    },
    {
      command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 38206', url: next,
      env: { MURIM_AUTH_ORIGIN: auth, MURIM_FASTAPI_ORIGIN: backend, NEXT_TELEMETRY_DISABLED: '1' },
    },
    { command: 'node tests/cutover-gateway.mjs', url: origin },
  ],
})
