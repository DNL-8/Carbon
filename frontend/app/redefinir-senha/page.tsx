import { ResetPassword } from '../../components/reset-password'

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <ResetPassword token={typeof token === 'string' ? token : undefined} />
}
