'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, InputAdornment, Tabs, Tab, TextField } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authRequest, errorMessage, notifySessionChange } from '../lib/auth'
import { Murim } from './murim'
import { Glyph } from './glyph'

type Mode = 'login' | 'register' | 'recover'
const emailSchema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string(), name: z.string() })

export function Login({ googleOnly = false }: { googleOnly?: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('login')
  const [guest, setGuest] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [social, setSocial] = useState(false)
  const { register, handleSubmit, clearErrors, setError: fieldError, formState } = useForm({
    resolver: zodResolver(emailSchema), defaultValues: { name: '', email: '', password: '' },
  })
  const busy = social || formState.isSubmitting
  const select = (value: Mode) => { setMode(value); clearErrors(); setMessage(''); setError('') }

  async function submit(values: z.infer<typeof emailSchema>) {
    setError(''); setMessage('')
    if (mode !== 'recover' && !values.password) {
      fieldError('password', { message: 'Informe sua senha.' }, { shouldFocus: true })
      return
    }
    if (mode === 'register') {
      if (!values.name.trim()) { fieldError('name', { message: 'Informe seu nome.' }, { shouldFocus: true }); return }
      if (values.password.length < 8) { fieldError('password', { message: 'Use pelo menos 8 caracteres.' }, { shouldFocus: true }); return }
    }
    try {
      if (mode === 'recover') {
        await authRequest('request-password-reset', { email: values.email, redirectTo: '/redefinir-senha' })
        setMessage('Se a conta existir, você receberá um link de recuperação.')
      } else if (mode === 'register') {
        await authRequest('sign-up/email', { ...values, name: values.name.trim(), callbackURL: '/' })
        setMessage('Confira seu e-mail para verificar a conta antes de entrar.')
      } else {
        await authRequest('sign-in/email', { email: values.email, password: values.password })
        queryClient.clear()
        notifySessionChange()
        router.refresh()
      }
    } catch (cause) { setError(errorMessage(cause)) }
  }

  async function google() {
    setSocial(true); setError('')
    try {
      const result = await authRequest('sign-in/social', { provider: 'google', callbackURL: '/', disableRedirect: true })
      const target = new URL(result.url ?? '')
      if (target.origin !== 'https://accounts.google.com') throw new Error('Não foi possível conectar ao Google.')
      window.location.assign(target.href)
    } catch (cause) { setError(errorMessage(cause)); setSocial(false) }
  }

  if (guest) return <Murim guest onLeaveGuest={() => setGuest(false)} />
  const selected = mode === 'register' ? 'register' : 'login'
  const field = (name: 'name' | 'email' | 'password', label: string, type: string, autocomplete: string, placeholder: string) => {
    const { ref, ...input } = register(name)
    return <div className="auth-field"><label htmlFor={'auth-' + name}>{label}</label><TextField id={'auth-' + name}
      {...input} inputRef={ref} fullWidth size="small" type={type} autoComplete={autocomplete}
      placeholder={placeholder} error={!!formState.errors[name]} helperText={formState.errors[name]?.message}
      slotProps={{
        htmlInput: { spellCheck: name === 'name', maxLength: name === 'name' ? 80 : undefined },
        input: name === 'name' ? undefined : { startAdornment: <InputAdornment position="start"><Glyph name={name === 'email' ? 'email' : 'lock'} /></InputAdornment> },
      }}
    /></div>
  }
  return <main className="auth-page"><div className="auth-card">
    <section aria-labelledby="auth-title" className="auth-intro">
      <div className="brand"><span><Glyph name="bolt" /></span>Fitness RPG</div>
      <div className="auth-copy">
        <h1 id="auth-title">Seu treino.<br /><strong>Sua evolução.</strong></h1>
        <p>Registre seus treinos, acompanhe a saúde pelo Health Connect e evolua seu personagem no Murim.</p>
      </div>
      {/* The original mascot is decorative in this screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/mascote-murim.svg" width="290" height="290" decoding="async" alt="" />
    </section>
    <section aria-labelledby="auth-access" className="auth-panel">
      <div><h2 id="auth-access">Acessar o Murim</h2><p>Entre para continuar sua jornada.</p></div>
      <Button className="google-button" onClick={google} disabled={busy} fullWidth><b aria-hidden="true">G</b>{social ? 'Conectando…' : 'Entrar com Google'}</Button>
      {!googleOnly && <div className="auth-divider">ou com e-mail</div>}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {message && <Alert severity="info" role="status">{message}</Alert>}
      {!googleOnly && <>
      <Tabs value={selected} onChange={(_, value: Mode) => select(value)} variant="fullWidth" aria-label="Modo de acesso por e-mail" className="auth-tabs">
        <Tab value="login" label="Entrar" id="tab-login" aria-controls="panel-login" disabled={busy} />
        <Tab value="register" label="Criar conta" id="tab-register" aria-controls="panel-register" disabled={busy} />
      </Tabs>
      {selected === 'register' ? <div id="panel-login" role="tabpanel" aria-labelledby="tab-login" hidden /> : <div id="panel-register" role="tabpanel" aria-labelledby="tab-register" hidden />}
      <div id={'panel-' + selected} role="tabpanel" aria-labelledby={'tab-' + selected}><form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
        {mode === 'register' && field('name', 'Nome do jogador', 'text', 'name', 'Seu nome ou apelido')}
        {field('email', 'E-mail', 'email', 'email', 'voce@exemplo.com')}
        {mode !== 'recover' && <div>
          {mode === 'login' && <button className="forgot-button" type="button" disabled={busy} onClick={() => select('recover')}>Esqueci minha senha</button>}
          {field('password', 'Senha', 'password', mode === 'register' ? 'new-password' : 'current-password', mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha')}
        </div>}
        {mode === 'recover' && <Button onClick={() => select('login')} disabled={busy}>Voltar ao login</Button>}
        <Button type="submit" className="auth-submit" variant="contained" disabled={busy} fullWidth>{formState.isSubmitting ? 'Enviando…' : mode === 'register' ? 'Criar conta e entrar' : mode === 'recover' ? 'Enviar link de recuperação' : 'Entrar com e-mail'}</Button>
      </form></div>
      </>}
      {!googleOnly && <div className="auth-guest"><Button onClick={() => setGuest(true)} disabled={busy}>Entrar como visitante</Button></div>}
    </section>
  </div></main>
}
