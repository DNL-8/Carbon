'use client'

import { useState } from 'react'
import { Alert, Button, MenuItem, TextField } from '@mui/material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, type ProfileInput } from '../../web/shared/training'
import { api, profileResult, read } from '../lib/api'
import { errorMessage } from '../lib/auth'

const initial: ProfileInput = { name: '', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante' }
const pick = {
  heroClass: ['Guerreiro', 'Arqueiro', 'Mago'],
  objective: ['Emagrecer', 'Condicionamento', 'Ambos'],
  experience: ['Iniciante', 'Intermediário', 'Avançado'],
}

export function Profile({ profile, onSave, onSignOut }: {
  profile?: ProfileInput; onSave: (profile: ProfileInput) => void; onSignOut: () => void
}) {
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema), defaultValues: profile ?? initial,
  })
  return <section className="surface profile-card" aria-labelledby="profile-title">
    <h1 id="profile-title">{profile ? 'Seu perfil' : 'Crie sua ficha de personagem'}</h1>
    {!profile && <p>Preencha sua ficha para abrir o painel. As medidas de saúde são opcionais.</p>}
    {error && <Alert severity="error">{error}</Alert>}
    <form noValidate className="profile-form" onSubmit={handleSubmit(async values => {
      try {
        setError('')
        const { profile: saved } = read(await api.PUT('/api/heroi', { body: values }), profileResult)
        if (saved) onSave(saved)
      } catch (cause) { setError(errorMessage(cause)) }
    })}>
      <TextField name="name" label="Nome do herói" defaultValue={profile?.name}
        inputRef={register('name').ref} onChange={register('name').onChange} onBlur={register('name').onBlur}
        autoComplete="nickname" error={!!errors.name} helperText={errors.name?.message} size="small" />
      {([['heroClass', 'Classe'], ['objective', 'Objetivo'], ['experience', 'Experiência']] as const).map(([key, label]) => {
        const { ref, ...input } = register(key)
        return <TextField key={key} {...input} inputRef={ref} select label={label} size="small" defaultValue={(profile ?? initial)[key]}>
          {pick[key].map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
        </TextField>
      })}
      <details><summary>Medidas de saúde opcionais</summary><div className="profile-form measures">
        {([['heightCm', 'Altura (cm)'], ['weightKg', 'Peso (kg)'], ['restingHrBaseline', 'FC de repouso'], ['maxHrEstimated', 'FC máxima']] as const).map(([key, label]) => {
          const { ref, ...input } = register(key, { setValueAs: (value: string) => value === '' ? null : Number(value) })
          return <TextField key={key} {...input} inputRef={ref} type="number" label={label} size="small"
            defaultValue={profile?.[key] ?? ''} error={!!errors[key]} helperText={errors[key]?.message} />
        })}
      </div></details>
      <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : profile ? 'Salvar ficha' : 'Criar ficha'}</Button>
      <Button onClick={onSignOut} disabled={isSubmitting}>Sair da conta</Button>
    </form>
  </section>
}
