import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt()
  .prepend({ ignores: ['web/.nuxt/**', 'web/.output/**', 'web/.vercel/**', 'web/node_modules/**'] })
