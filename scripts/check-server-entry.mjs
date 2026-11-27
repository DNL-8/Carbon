import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
const { GET: handler, POST: postHandler } = await import('../app/api/[[...route]]/route.ts');

const getRoutes = new Map([
  ['/api/health', 200],
  ['/api/ready', 200],
  ['/api/strava/config', 200],
  ['/api/strava/status', 401],
]);

for (const [path, expected] of getRoutes) {
  const response = await handler(new Request(new URL(path, 'http://localhost:3000')));
  assert.equal(response.status, expected, path);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);

  if (path === '/api/health') {
    const json = await response.json();
    assert.equal(json.ok, true);
    assert.equal(json.authMode, 'firebase-auth');
    assert.equal(json.storageMode, 'firestore');
  }
  if (path === '/api/ready') {
    const json = await response.json();
    assert.equal(json.ok, true);
    assert.equal(json.authMode, 'firebase-auth');
    assert.equal(json.storageMode, 'firestore');
  }
}

const oracleRes = await postHandler(
  new Request('http://localhost:3000/api/oracle/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Como treinar hoje?' }),
  })
);
assert.equal(oracleRes.status, 401);
