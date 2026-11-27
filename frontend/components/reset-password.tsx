'use client'

import { useState } from 'react'
import { Alert, Button, TextField } from '@mui/material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authRequest, errorMessage } from '../lib/auth'

const schema = z.object({ newPassword: z.string().min(8, 'Use pelo menos 8 caracteres.') })

export function ResetPassword({ token }: { token?: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { newPassword: '' },
  })
  const [result, setResult] = useState('')
  const [done, setDone] = useState(false)
  const { ref, ...input } = register('newPassword')
  return <main className="profile-page"><section className="surface profile-card">
    <h1>Redefinir senha</h1>
    {!token && <Alert severity="error">Link inválido ou expirado.</Alert>}
    {result && <Alert severity={done ? 'success' : 'error'}>{result}</Alert>}
    {token && !done && <form className="profile-form" noValidate onSubmit={handleSubmit(async data => {
      try {
        await authRequest('reset-password', { token, ...data })
        setDone(true); setResult('Senha atualizada.')
      } catch (cause) { setResult(errorMessage(cause)) }
    })}>
      <TextField {...input} inputRef={ref} label="Nova senha" type="password" autoComplete="new-password" error={!!errors.newPassword} helperText={errors.newPassword?.message} />
      <Button type="submit" variant="contained" disabled={isSubmitting}>Salvar senha</Button>
    </form>}
    <Button href="/">Voltar ao login</Button>
  </section></main>
}
