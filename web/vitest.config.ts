import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['web/tests/**/*.test.ts'],
    environment: 'nuxt',
    environmentOptions: { nuxt: { rootDir: './web' } },
  },
})
