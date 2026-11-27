'use client'

import { useRef, useState } from 'react'
import { Alert, Button, MenuItem, TextField } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { manualHealthImportSchema, manualHealthSource } from '../shared/health'
import { api, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { importResult, sources, type ManualSource } from '../lib/health-api'
import { refreshRpg } from '../lib/rpg-api'

const formats: Record<ManualSource, string> = { apple_health: '.xml', samsung_health: '.csv,.json', csv: '.csv', gpx: '.gpx' }

export function HealthImport() {
  const client = useQueryClient()
  const files = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<ManualSource>('csv')
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  async function importFiles() {
    const input = Array.from(files.current?.files ?? [])
    if (!input.length || busy) return
    setBusy(true); setError(''); setMessage(''); setWarnings([])
    const totals = { imported: 0, duplicates: 0, days: 0, xp: 0 }
    try {
      const tools = await import('../../src/utils/healthParsers')
      const [file] = input
      const parsed = source === 'samsung_health' ? await tools.parseSamsungHealthFiles(input)
        : source === 'apple_health' ? await tools.parseAppleHealthXmlFile(file)
          : source === 'gpx' ? tools.parseGpxContent(await file.text(), file.name)
            : tools.parseCsvHealthContent(await file.text(), file.name)
      setWarnings(parsed.warnings)
      const total = Math.max(parsed.activities.length, parsed.dailyMetrics.length)
      if (!total) { setMessage('Nenhum registro de saúde encontrado.'); return }
      for (let offset = 0; offset < total; offset += 25) {
        const body = manualHealthImportSchema.parse({
          source,
          activities: parsed.activities.slice(offset, offset + 25),
          dailyMetrics: parsed.dailyMetrics.slice(offset, offset + 25),
        })
        const result = read(await api.POST('/api/saude/importar', { body: { ...body, source } }), importResult)
        totals.imported += result.imported
        totals.duplicates += result.duplicates
        totals.days += result.days
        totals.xp += result.xp
      }
      setMessage(`${totals.imported} atividades novas, ${totals.duplicates} duplicadas e ${totals.days} dias de métricas processados. +${totals.xp} XP.`)
      if (files.current) files.current.value = ''
      setSelected(0)
    } catch (cause) {
      const partial = totals.imported || totals.days ? ` Foram salvas ${totals.imported} atividades e processados ${totals.days} dias.` : ''
      setError((cause instanceof Error && cause.name === 'ZodError' ? 'O arquivo contém registros inválidos.' : errorMessage(cause)) + partial)
    } finally {
      if (totals.imported || totals.days) await refreshRpg(client, 'health-summary', 'health-connect', 'missions', 'arsenal')
      setBusy(false)
    }
  }

  return <section className="surface overview" aria-labelledby="import-health">
    <header><h2 id="import-health">Importação manual</h2><p>Importe treinos e métricas dos seus arquivos de saúde.</p></header>
    <form className="health-stack" onSubmit={event => { event.preventDefault(); void importFiles() }}>
      <div className="rpg-grid">
        <TextField label="Formato do arquivo" select size="small" value={source} disabled={busy} onChange={event => {
          setSource(manualHealthSource.parse(event.target.value))
          if (files.current) files.current.value = ''
          setSelected(0); setMessage(''); setError(''); setWarnings([])
        }}>
          {manualHealthSource.options.map(option => <MenuItem key={option} value={option}>{sources[option]}</MenuItem>)}
        </TextField>
        <div className="health-stack"><label htmlFor="health-file">Arquivos de saúde</label>
          <input id="health-file" type="file" ref={files} className="health-file" accept={formats[source]} multiple={source === 'samsung_health'}
            disabled={busy} onChange={event => setSelected(event.target.files?.length ?? 0)} />
        </div>
      </div>
      <div><Button type="submit" variant="contained" disabled={busy || !selected}>{busy ? 'Importando…' : 'Importar dados'}</Button></div>
    </form>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <p className="green" role="status">{message}</p>}
    {!!warnings.length && <details><summary>Avisos da leitura do arquivo</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
  </section>
}
