'use client'

import { useState } from 'react'
import { Alert, Button } from '@mui/material'
import { authRequest, errorMessage } from '../lib/auth'
import { Glyph } from './glyph'

export function Login() {
  const [error, setError] = useState('')
  const [social, setSocial] = useState(false)

  async function google() {
    setSocial(true); setError('')
    try {
      const result = await authRequest('sign-in/social', { provider: 'google', callbackURL: '/', disableRedirect: true })
      const target = new URL(result.url ?? '')
      if (target.origin !== 'https://accounts.google.com') throw new Error('Não foi possível conectar ao Google.')
      window.location.assign(target.href)
    } catch (cause) { setError(errorMessage(cause)); setSocial(false) }
  }

  return <main className="auth-page"><div className="auth-card">
    <section aria-labelledby="auth-title" className="auth-intro">
      <div className="brand"><span><Glyph name="bolt" /></span>Carbon · Murim</div>
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
      <Button className="google-button" onClick={google} disabled={social} fullWidth><b aria-hidden="true">G</b>{social ? 'Conectando…' : 'Entrar com Google'}</Button>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <p>Somente as duas contas Google autorizadas têm acesso.</p>
    </section>
  </div></main>
}
