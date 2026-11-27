import type { Metadata } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './globals.css'
import { Providers } from '../components/providers'

export const metadata: Metadata = { title: 'Fitness RPG & Saúde', description: 'Acompanhe seus treinos e a evolução do seu personagem no Murim.' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>
}
