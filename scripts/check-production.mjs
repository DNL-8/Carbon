import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const origin = 'https://murim-iota.vercel.app'
const revisionPattern = /^[a-f0-9]{40}$/

export async function checkProduction(revision, fetchJson = fetch) {
  assert.match(revision ?? '', revisionPattern, 'Informe o SHA completo da revisão esperada')

  async function read(path) {
    const response = await fetchJson(new URL(path, origin), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    assert.equal(response.status, 200, `${path} deve responder HTTP 200`)
    assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/i)
    return response.json()
  }

  const health = await read('/api/health')
  assert.equal(health.status, 'ok', 'O processo Nitro deve estar disponível')
  assert.equal(health.revision, revision, 'O domínio deve servir a revisão esperada')
  const ready = await read('/api/ready')
  assert.equal(ready.ready, true, 'O Nuxt deve ter autenticação e banco disponíveis')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkProduction(process.env.EXPECTED_REVISION)
  console.log('Murim responde e a revisão publicada confere.')
}
