import { manualHealthImportSchema } from '../../../shared/health'
import { requireUser } from '../../utils/authentication'
import { persistHealthImport } from '../../utils/health-import'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const input = await readValidatedBody(event, value => manualHealthImportSchema.parse(value))
  return persistHealthImport(userId, input)
})
