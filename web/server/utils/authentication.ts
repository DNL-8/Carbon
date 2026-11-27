import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDatabase } from './database'
import * as schema from '../db/schema'

async function sendAuthEmail(to: string, url: string, subject: string) {
  const { RESEND_API_KEY, AUTH_EMAIL_FROM } = process.env
  if (!RESEND_API_KEY || !AUTH_EMAIL_FROM) {
    throw createError({ statusCode: 503, statusMessage: 'Envio de email indisponivel' })
  }
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: AUTH_EMAIL_FROM, to, subject, text: `${subject}\n\n${url}` }),
  })
  if (!result.ok) throw createError({ statusCode: 503, statusMessage: 'Envio de email indisponivel' })
}

function createAuth() {
  const {
    BETTER_AUTH_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, VERCEL_ENV, VERCEL_URL,
  } = process.env
  const previewUrl = VERCEL_ENV === 'preview' && VERCEL_URL && /^[a-z\d-]+\.vercel\.app$/i.test(VERCEL_URL)
    ? `https://${VERCEL_URL}`
    : undefined
  const baseURL = BETTER_AUTH_URL || previewUrl
  if (!baseURL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) {
    throw createError({ statusCode: 503, statusMessage: 'Autenticacao indisponivel' })
  }
  return betterAuth({
    baseURL,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDatabase(), { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) => sendAuthEmail(user.email, url, 'Redefina sua senha'),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: ({ user, url }) => sendAuthEmail(user.email, url, 'Verifique seu e-mail'),
    },
    socialProviders: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
      : {},
  })
}

let auth: ReturnType<typeof createAuth> | undefined

export function getAuth() {
  return auth ??= createAuth()
}

export async function requireUser(headers: Headers) {
  const session = await getAuth().api.getSession({ headers })
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Entre na sua conta' })
  if (!session.user.emailVerified) {
    throw createError({ statusCode: 403, statusMessage: 'Verifique seu email' })
  }
  return session.user.id
}
