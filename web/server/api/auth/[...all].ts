import { getAuth } from '../../utils/authentication'

export default defineEventHandler(event => getAuth().handler(toWebRequest(event)))
