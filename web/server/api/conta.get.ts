import { getAuth } from '../utils/authentication'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const session = await getAuth().api.getSession({ headers: toWebRequest(event).headers })
  return { authenticated: session?.user.emailVerified === true }
})
