import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'
import { writeFile } from 'node:fs/promises'

const backend = fileURLToPath(new URL('../backend/', import.meta.url))
const generated = spawnSync(process.env.MURIM_PYTHON || './.venv/bin/python', [
  '-c', 'import json; from app.main import app; print(json.dumps(app.openapi()))',
], { cwd: backend, encoding: 'utf8' })
if (generated.status !== 0) throw new Error(generated.stderr || generated.error?.message)
const schema = JSON.parse(generated.stdout)
const result = '// Gerado pelo FastAPI. Execute bun run generate:api para atualizar.\n' + astToString(await openapiTS(schema))
await writeFile(new URL('./lib/api.generated.ts', import.meta.url), result)
