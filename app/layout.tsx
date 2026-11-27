import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import '../src/index.css';

const description = 'Aplicativo fitness gamificado com integração Strava, importação Apple Health, GPX e CSV, Oráculo e relatórios de treino e recuperação.';

export const metadata: Metadata = {
  title: 'Fitness RPG & Saúde — Monitoramento diário e relatórios',
  description,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'HunterFit', statusBarStyle: 'black-translucent' },
  openGraph: { title: 'Fitness RPG & Saúde', description, type: 'website' },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-[#09090B] text-zinc-100 antialiased selection:bg-orange-500/25 selection:text-orange-200">
        {children}
      </body>
    </html>
  );
}
