'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { createTheme, CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { sessionChangeKey } from '../lib/auth'
import { tokens } from '../lib/theme-tokens'

const theme = createTheme({
  palette: {
    mode: 'dark', primary: { main: tokens.orange, contrastText: tokens.base },
    success: { main: tokens.green }, background: { default: tokens.base, paper: tokens.surface },
    text: { primary: tokens.text, secondary: tokens.muted }, divider: tokens.border,
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true, disableRipple: true }, styleOverrides: { root: { minHeight: 44 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
})

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false }, mutations: { retry: false } },
  }))
  useEffect(() => {
    const syncSession = (event: StorageEvent) => {
      if (event.key === sessionChangeKey) {
        queryClient.clear()
        window.location.reload()
      }
    }
    window.addEventListener('storage', syncSession)
    return () => window.removeEventListener('storage', syncSession)
  }, [queryClient])
  return <AppRouterCacheProvider options={{enableCssLayer: true, nonce}}><ThemeProvider theme={theme}><CssBaseline /><GlobalStyles styles={{ ':root': Object.fromEntries(Object.entries(tokens).map(([key, value]) => ['--' + key, value])) }} />
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ThemeProvider></AppRouterCacheProvider>
}
