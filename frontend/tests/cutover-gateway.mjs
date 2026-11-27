import { createServer, request } from 'node:http'

const host = '127.0.0.1'
const publicPort = 38200
const backends = { next: 38206, nuxt: 38203 }
const selection = 'murim_test_frontend='

const server = createServer((incoming, outgoing) => {
  // Playwright contexts can select a frontend independently while sharing the public origin.
  const cookies = (incoming.headers.cookie ?? '').split(';').map(item => item.trim())
  const requested = cookies.includes(selection + 'nuxt') ? 'nuxt' : 'next'
  const path = incoming.url ?? '/'
  const target = path.startsWith('/_next/') ? 'next' : path.startsWith('/_nuxt/') ? 'nuxt' : requested
  const headers = { ...incoming.headers }
  const cookie = cookies.filter(item => item && !item.startsWith(selection)).join('; ')
  if (cookie) headers.cookie = cookie
  else delete headers.cookie

  const upstream = request({ host, port: backends[target], method: incoming.method, path, headers }, response => {
    outgoing.writeHead(response.statusCode, { ...response.headers, 'x-murim-test-frontend': target })
    response.pipe(outgoing)
  })
  upstream.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(502)
    outgoing.end()
  })
  outgoing.on('close', () => upstream.destroy())
  incoming.pipe(upstream)
})

server.listen(publicPort, host)
