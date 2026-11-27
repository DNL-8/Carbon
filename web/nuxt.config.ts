export default defineNuxtConfig({
  compatibilityDate: '2026-11-26',
  runtimeConfig: { murimFastapiOrigin: '' },
  typescript: {
    strict: true,
    tsConfig: { compilerOptions: { noUncheckedIndexedAccess: false } },
  },
  vite: { ssr: { noExternal: ['vue-router'] } },
  nitro: {
    externals: { inline: ['vue-router'] },
    vercel: { functions: { runtime: 'nodejs24.x' } },
    // Nitro's per-route Vercel functions use absolute directory junctions on Windows.
    ...(process.platform === 'win32' && {
      compatibilityDate: { default: '2026-11-26', vercel: '2025-07-14' },
    }),
  },
  modules: ['nuxt-security', '@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false, colorMode: false },
  security: {
    // This limiter is local to each Nitro instance.
    rateLimiter: { tokensPerInterval: 150, interval: 60_000 },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR', class: 'dark' },
      title: 'Fitness RPG & Saúde',
    },
  },
})
