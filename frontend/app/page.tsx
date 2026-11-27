import { headers } from 'next/headers'
import { Alert } from '@mui/material'
import { Login } from '../components/login'
import { Murim } from '../components/murim'
import { getAccount } from '../lib/upstream'

export default async function Home() {
  const cookie = (await headers()).get('cookie')
  if (!cookie) return <Login />
  try {
    return await getAccount(cookie) ? <Murim /> : <Login />
  } catch {
    return <main className="page-error"><Alert severity="error">Não foi possível verificar sua sessão. Atualize a página para tentar novamente.</Alert></main>
  }
}
