'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, FormControlLabel, TextField } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, ApiError, dashboardResult, read, type Progress } from '../lib/api'
import { formatMetric } from '../lib/health-api'

const prompts = ['Como interpretar minha carga aguda/crônica?', 'Qual treino combina com meu objetivo agora?', 'Como distribuir meu tempo entre as zonas cardíacas?']
const schema = z.object({ question: z.string().trim().min(1, 'Escreva sua pergunta.').max(300), includeHealth: z.boolean() })

// Render only simple inline emphasis; React escapes all provider text.
function OracleReply({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  return <p className="oracle-reply">{parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <b key={index}>{part.slice(2, -2)}</b>
      : part.startsWith('`') && part.endsWith('`') && part.length > 2
        ? <code key={index}>{part.slice(1, -1)}</code>
        : part)}</p>
}

export function Oracle({ progress, overview }: { progress?: Progress; overview?: z.infer<typeof dashboardResult> }) {
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'oracle'; content: string }[]>([])
  const [cooldown, setCooldown] = useState(0)
  const deadline = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { question: '', includeHealth: false } })
  const { ref: questionRef, ...question } = form.register('question')
  const { ref: healthRef, ...health } = form.register('includeHealth')
  const mutation = useMutation({
    mutationFn: async (body: z.infer<typeof schema>) => read(await api.POST('/api/oracle/ask', { body }), z.object({ reply: z.string() })),
    onError: (_error, body) => { form.setValue('question', body.question); form.setValue('includeHealth', false) },
    onSuccess: result => setMessages(items => [...items, { id: crypto.randomUUID(), role: 'oracle', content: result.reply }]),
  })
  const busy = mutation.isPending || cooldown > 0
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setInterval(() => setCooldown(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250)
    return () => window.clearInterval(timer)
  }, [cooldown])
  useEffect(() => { if (messages.length) bottom.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])
  function send(body: z.infer<typeof schema>) {
    if (busy) return
    deadline.current = Date.now() + 5500
    setCooldown(6)
    setMessages(items => [...items, { id: crypto.randomUUID(), role: 'user', content: body.question }])
    form.reset()
    mutation.mutate(body)
  }
  const failure = mutation.error instanceof ApiError && mutation.error.status === 429 ? 'Limite de consultas atingido. Aguarde antes de tentar novamente.'
    : mutation.error instanceof ApiError && mutation.error.status === 503 ? 'O Oráculo está indisponível neste ambiente.'
      : mutation.error instanceof ApiError && mutation.error.status === 504 ? 'O Gemini demorou para responder. Tente novamente.'
        : 'Não foi possível consultar o Oráculo. Tente novamente.'

  return <section className="view" aria-labelledby="oracle-heading">
    <header className="surface overview"><div><h1 id="oracle-heading">Oráculo · Análise de treino</h1>
      <p>Consulta educativa sobre seus treinos e recuperação.</p></div>
      <p className="mono">Nível {progress?.level ?? '—'} · {progress?.xp ?? '—'} XP · Prontidão {formatMetric(overview?.recovery?.score, '%')} · ACWR {formatMetric(overview?.acwr)}</p>
    </header>
    <div className="surface overview oracle-log" role="log" aria-label="Conversa com o Oráculo" aria-live="polite">
      {!messages.length && <p>Escolha uma pergunta ou escreva sua consulta.</p>}
      {messages.map(message => <div key={message.id} className={message.role === 'user' ? 'oracle-message oracle-user' : 'surface inset oracle-message'}>
        <strong>{message.role === 'user' ? 'Você' : 'Oráculo'}</strong>{message.role === 'oracle' ? <OracleReply content={message.content} /> : <p>{message.content}</p>}
      </div>)}
      {mutation.isPending && <p role="status">Analisando sua consulta…</p>}
      <div ref={bottom} />
    </div>
    <div className="row" aria-label="Sugestões de pergunta">{prompts.map(prompt => <Button key={prompt} variant="outlined" disabled={busy}
      onClick={() => send({ question: prompt, includeHealth: form.getValues('includeHealth') })}>{prompt}</Button>)}</div>
    {mutation.error && <Alert severity="error">{failure}</Alert>}
    <form className="surface overview" noValidate onSubmit={form.handleSubmit(send)}>
      <FormControlLabel label="Autorizar o envio de um resumo de recuperação e carga dos últimos 28 dias ao Gemini nesta consulta."
        control={<Checkbox {...health} inputRef={healthRef} checked={form.watch('includeHealth')} disabled={busy} />} />
      <TextField {...question} inputRef={questionRef} label="Pergunta ao Oráculo" fullWidth disabled={mutation.isPending}
        error={!!form.formState.errors.question} helperText={form.formState.errors.question?.message}
        slotProps={{ htmlInput: { maxLength: 300 } }} />
      <div><Button type="submit" variant="contained" disabled={busy}>{mutation.isPending ? 'Enviando…' : cooldown ? `Aguarde ${cooldown}s` : 'Enviar'}</Button></div>
      <p>Conversa mantida nesta sessão. Em caso de dor, procure orientação profissional.</p>
    </form>
  </section>
}
