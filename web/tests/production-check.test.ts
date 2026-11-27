import { expect, test } from 'vitest'
import { checkProduction } from '../../scripts/check-production.mjs'

const revision = 'a'.repeat(40)
const success = async (url: URL) => Response.json(
  url.pathname === '/api/health' ? { status: 'ok', revision } : { ready: true },
)

test('confere a revisão publicada e a prontidão do Nuxt', async () => {
  await expect(checkProduction(revision, success)).resolves.toBeUndefined()
  await expect(checkProduction('b'.repeat(40), success)).rejects.toThrow('revisão esperada')
  await expect(checkProduction('', success)).rejects.toThrow('SHA completo')
  await expect(checkProduction(revision, async (url: URL) => url.pathname === '/api/ready'
    ? Response.json({ ready: false }, { status: 503 }) : success(url),
  )).rejects.toThrow('/api/ready deve responder HTTP 200')
})
