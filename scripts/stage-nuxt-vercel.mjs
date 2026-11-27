import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = realpathSync(join(root, 'web/.vercel/output'))
const scratch = join(root, '.data')

function inspect(folder) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    const stats = lstatSync(path)
    if (/^(\.env(?:\.|$))|\.(key|pem|pfx)$/i.test(name)) {
      throw new Error('O artefato contém um arquivo de configuração sensível.')
    }
    if (stats.isSymbolicLink()) {
      const target = relative(output, realpathSync(path))
      if (isAbsolute(target) || target === '..' || target.startsWith(`..${sep}`)) {
        throw new Error('O artefato contém um link para fora da pasta de build.')
      }
      continue
    }
    if (stats.isDirectory()) inspect(path)
  }
}

inspect(output)
mkdirSync(scratch, { recursive: true })
const staging = mkdtempSync(join(scratch, 'nuxt-vercel-upload-'))
const destination = join(staging, '.vercel/output')
mkdirSync(dirname(destination), { recursive: true })
// Nitro can emit Windows junctions for external dependencies. Upload actual files.
cpSync(output, destination, { recursive: true, dereference: true })
console.log(staging)
