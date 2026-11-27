import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
delete env.VERCEL;

let next;
let browser;

try {
  const build = spawn(process.execPath, [nextBin, 'build'], { cwd: root, env, stdio: 'inherit' });
  assert.equal((await once(build, 'exit'))[0], 0, 'Build para o teste de navegador');

  next = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', '0'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const nextOrigin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Next.js não informou a porta.')), 15_000);
    next.stdout.on('data', (chunk) => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    next.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Servidor Next.js interrompido.'));
    });
  });

  for (const [path, status] of [
    ['/api/health', 200],
    ['/api/ready', 200],
    ['/api/strava/config', 200],
    ['/api/strava/status', 401],
    ['/manifest.webmanifest', 200],
    ['/sw.js', 200],
  ]) {
    const response = await fetch(new URL(path, nextOrigin));
    assert.equal(response.status, status, path);
  }

  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (process.env.CHROME_BIN) {
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: launchArgs });
  } else {
    try {
      browser = await chromium.launch({ channel: 'chrome', args: launchArgs });
    } catch (channelError) {
      const candidates = [
        '/usr/bin/google-chrome',
        '/opt/google/chrome/chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
        chromium.executablePath(),
      ];
      const { existsSync } = await import('node:fs');
      const fallbackPath = candidates.find((p) => Boolean(p) && existsSync(p));
      if (!fallbackPath) throw channelError;
      browser = await chromium.launch({ executablePath: fallbackPath, args: launchArgs });
    }
  }

  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 880 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${nextOrigin}/`);
    await page.getByRole('heading', { name: /Fitness\s+RPG/i }).waitFor();
    await page.getByRole('button', { name: 'Entrar com Google' }).waitFor();
    await page.getByRole('tab', { name: 'Criar conta' }).click();
    await page.getByLabel('Nome do jogador').waitFor();
    await page.getByLabel('E-mail', { exact: true }).waitFor();
    await page.getByLabel('Senha').waitFor();
    await page.getByRole('tab', { name: 'Entrar' }).click();
    await page.getByRole('button', { name: 'Entrar com e-mail' }).waitFor();
    await page.getByRole('button', { name: /Esqueci minha senha/i }).waitFor();

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
    await page.close();
  }

  console.log('Fluxos Firebase Auth e build validados com sucesso.');
} finally {
  await browser?.close();
  if (next && next.exitCode === null) {
    next.kill();
    await once(next, 'exit');
  }
}
