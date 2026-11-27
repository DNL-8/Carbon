import type { Metadata } from 'next'
import { headers } from 'next/headers'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './globals.css'
import { Providers } from '../components/providers'

export const metadata: Metadata = { title: 'Fitness RPG & Saúde', description: 'Acompanhe seus treinos e a evolução do seu personagem no Murim.' }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get('x-murim-nonce') ?? undefined
  return <html lang="pt-BR"><body><Providers nonce={nonce}>{children}</Providers></body></html>
}
