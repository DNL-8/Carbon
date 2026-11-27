import { defineConfig, devices } from '@playwright/test'
const database = process.env.MURIM_TEST_DATABASE_URL
if (!database) throw new Error('MURIM_TEST_DATABASE_URL required')
const url = new URL(database)
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.pathname !== '/murim_fastapi_test' || url.search || url.hash) throw new Error('Disposable loopback PostgreSQL required')
const origin = 'http://127.0.0.1:38200'
const backend = 'http://127.0.0.1:38212'
const python = process.platform === 'win32' ? '../backend/.venv/Scripts/python.exe' : '../backend/.venv/bin/python'
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: origin, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.CHROME_BIN } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `"${python}" tests/provider.py`, url: backend + '/api/ready',
      env: {
        PYTHONPATH: '../backend', DATABASE_URL: database, APP_ORIGIN: origin,
        ENABLE_WRITES: 'true', GOOGLE_CLIENT_ID: 'browser-fixture',
        GOOGLE_CLIENT_SECRET: 'fixture', PYTHON_AUTH_SECRET: 'browser-test-only-secret-not-for-production',
        GOOGLE_USERS: JSON.stringify({ 'browser-a': 'python-auth-browser-a', 'browser-b': 'python-auth-browser-b' }),
        GEMINI_API_KEY: 'fixture-gemini', GEMINI_MODEL: 'fixture-model',
        STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'fixture-strava',
        STRAVA_SESSION_SECRET: 'fixture-only-strava-session-secret-long-enough',
      },
    },
    {
      command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 38200', url: origin,
      env: { MURIM_FASTAPI_ORIGIN: backend, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
})
