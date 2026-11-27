import { defineConfig, devices } from '@playwright/test'

const database = process.env.MURIM_TEST_DATABASE_URL
if (!database) throw new Error('MURIM_TEST_DATABASE_URL required')
const url = new URL(database)
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.pathname !== '/murim_fastapi_test' || url.search || url.hash) throw new Error('Disposable loopback PostgreSQL required')
const origin = 'http://127.0.0.1:38210'
const backend = 'http://127.0.0.1:38212'
export default defineConfig({
  testDir: './python-auth-tests',
  workers: 2,
  timeout: 60_000,
  use: { baseURL: origin, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.CHROME_BIN } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: '../backend/.venv/bin/python python-auth-tests/provider.py', url: backend + '/api/ready',
      env: {
        PYTHONPATH: '../backend', DATABASE_URL: database, AUTH_ORIGIN: '', AUTH_PROVIDER: 'authlib',
        BETTER_AUTH_URL: origin, ENABLE_WRITES: 'true', GOOGLE_CLIENT_ID: 'browser-fixture',
        GOOGLE_CLIENT_SECRET: 'fixture', PYTHON_AUTH_SECRET: 'browser-test-only-secret-not-for-production',
        GOOGLE_USERS: JSON.stringify({ 'browser-a': 'python-auth-browser-a', 'browser-b': 'python-auth-browser-b' }),
      },
    },
    {
      command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 38210', url: origin,
      env: { MURIM_AUTH_PROVIDER: 'authlib', MURIM_AUTH_ORIGIN: 'http://127.0.0.1:1',
        MURIM_FASTAPI_ORIGIN: backend, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
})
