import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyBearerToken } from '../src/server/authSession.ts';
import { createAppServer } from '../src/server/index.ts';

test('verifyBearerToken rejeita cabeçalho ausente ou formato inválido', async () => {
  await assert.rejects(
    verifyBearerToken(undefined),
    { statusCode: 401, code: 'missing_bearer_token' }
  );

  await assert.rejects(
    verifyBearerToken('Basic abc123'),
    { statusCode: 401, code: 'missing_bearer_token' }
  );

  await assert.rejects(
    verifyBearerToken('Bearer invalid-token'),
    { statusCode: 401, code: 'invalid_token_format' }
  );

  await assert.rejects(
    verifyBearerToken('Bearer header.payload.signature'),
    { statusCode: 401, code: 'token_expired' }
  );
});

test('servidor Hono expõe health/ready Firebase e protege rotas de IA e Strava', async () => {
  const app = createAppServer();

  const healthRes = await app.request('/api/health');
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.authMode, 'firebase-auth');
  assert.equal(healthJson.storageMode, 'firestore');

  const readyRes = await app.request('/api/ready');
  assert.equal(readyRes.status, 200);
  const readyJson = await readyRes.json();
  assert.equal(readyJson.ok, true);
  assert.equal(readyJson.authMode, 'firebase-auth');
  assert.equal(readyJson.storageMode, 'firestore');

  const stravaStatusRes = await app.request('/api/strava/status');
  assert.equal(stravaStatusRes.status, 401);

  const oracleRes = await app.request('/api/oracle/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Como treinar hoje?' }),
  });
  assert.equal(oracleRes.status, 401);
});
