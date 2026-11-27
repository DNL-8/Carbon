import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const db = new URL(process.env.DATABASE_URL)
assert.equal(db.pathname, '/murim_fastapi_test')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(db.hostname))
assert.equal(db.search, '')
const original = globalThis.fetch
globalThis.fetch = async (input, options) => {
  if (input === 'https://api.resend.com/emails') {
    const message = JSON.parse(options.body)
    assert.match(message.to, /^murim-frontend-[a-f0-9-]+@example\.test$/)
    const link = message.text.split('\n\n').at(-1)
    await mkdir('.e2e-mail', { recursive: true })
    await writeFile(join('.e2e-mail', message.to), link, { mode: 0o600 })
    return Response.json({})
  }
  return original(input, options)
}
await import('../../web/.output/server/index.mjs')
