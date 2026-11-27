export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const revision = process.env.VERCEL_GIT_COMMIT_SHA
  return { status: 'ok', ...(/^[a-f0-9]{40}$/.test(revision ?? '') ? { revision } : {}) }
})
