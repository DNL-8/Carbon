export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) throw createError({ statusCode: 503, statusMessage: 'Google nao configurado' })
  return { googleClientId: clientId }
})
