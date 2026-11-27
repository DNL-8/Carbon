'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { WorkoutTemplate } from '../../src/types/fitness'
import { customWorkoutSchema, workoutTypes, type CustomWorkoutInput } from '../shared/training'
import { api, read, workoutResult } from '../lib/api'
import { errorMessage } from '../lib/auth'

const blank = (): CustomWorkoutInput => ({
  name: '', description: '', type: 'forca', durationMinutes: 30, exercises: [{ name: '', prescription: '' }],
})

const labels = { forca: 'Força', cardio: 'Cardio', hiit: 'HIIT', core: 'Abdômen', mobilidade: 'Mobilidade', corpo_inteiro: 'Corpo inteiro' }
const optionalNumber = (value: string) => value === '' ? undefined : Number(value)

export function CustomWorkouts({ workouts }: { workouts: WorkoutTemplate[] }) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<WorkoutTemplate>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')
  const draft = useRef<string>(null)
  const form = useForm({ resolver: zodResolver(customWorkoutSchema), defaultValues: blank() })
  const rows = useFieldArray({ control: form.control, name: 'exercises' })
  const fields = form.formState.errors
  function select(workout?: WorkoutTemplate) {
    draft.current = workout?.id ?? null
    setSelected(workout)
    form.reset(workout ? customWorkoutSchema.parse(workout) : blank())
    setMessage('')
    mutation.reset()
  }

  const mutation = useMutation({
    mutationFn: async (action: { id: string; data: CustomWorkoutInput } | { id: string }) => {
      const params = { path: { id: action.id } }
      if ('data' in action) return read(await api.PUT('/api/treinos/personalizados/{id}', { params, body: action.data }), workoutResult)
      read(await api.DELETE('/api/treinos/personalizados/{id}', { params }), z.object({ deleted: z.literal(true) }))
      return null
    },
    onSuccess: async saved => {
      draft.current = saved?.id ?? null
      setSelected(saved ?? undefined)
      form.reset(saved ? customWorkoutSchema.parse(saved) : blank())
      setConfirmDelete(false)
      setMessage(saved ? 'Treino salvo.' : 'Treino excluído. Seu histórico foi preservado.')
      await client.invalidateQueries({ queryKey: ['custom'] })
    },
  })
  const { ref: nameRef, ...nameInput } = form.register('name')
  const { ref: descRef, ...descInput } = form.register('description')
  const { ref: durationRef, ...durationInput } = form.register('durationMinutes', { valueAsNumber: true })

  return <section className="surface overview" aria-labelledby="custom-heading">
    <h2 id="custom-heading">Treinos personalizados</h2>
    <details className="workout-editor">
      <summary>Montar ou editar treino</summary>
      <div className="editor-fields">
        <div className="row">
          <Button variant="outlined" disabled={mutation.isPending} onClick={() => select()}>Novo treino</Button>
          {workouts.map(workout => <Button key={workout.id} variant="outlined" aria-pressed={selected?.id === workout.id}
            disabled={mutation.isPending} onClick={() => select(workout)}>Editar {workout.name}</Button>)}
        </div>
        {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        {message && <p className="green" role="status">{message}</p>}
        <form className="editor-fields" noValidate onSubmit={form.handleSubmit(data => {
          setMessage('')
          draft.current ??= crypto.randomUUID()
          mutation.mutate({ id: draft.current, data })
        })}>
          <TextField {...nameInput} inputRef={nameRef} label="Nome do treino" size="small" error={!!fields.name} helperText={fields.name?.message} />
          <TextField {...descInput} inputRef={descRef} label="Descrição" size="small" error={!!fields.description} helperText={fields.description?.message} />
          <div className="editor-grid">
            <Controller name="type" control={form.control} render={({ field: { ref, ...field } }) => (
              <TextField {...field} inputRef={ref} select fullWidth size="small" label="Tipo">
                {workoutTypes.map(type => <MenuItem key={type} value={type}>{labels[type]}</MenuItem>)}
              </TextField>
            )} />
            <TextField {...durationInput} inputRef={durationRef} fullWidth size="small" type="number" label="Duração (min)"
              error={!!fields.durationMinutes} helperText={fields.durationMinutes?.message} slotProps={{ htmlInput: { min: 1, max: 300 } }} />
          </div>
          {rows.fields.map((row, index) => <fieldset key={row.id} className="surface inset editor-fields">
            <legend>Exercício {index + 1}</legend>
            <div className="editor-grid">
              {(['name', 'prescription', 'equipment', 'restSeconds', 'loadKg', 'executionTip'] as const).map(key => {
                const isNumeric = key === 'restSeconds' || key === 'loadKg'
                const field = form.register(`exercises.${index}.${key}`, isNumeric ? { setValueAs: optionalNumber } : undefined)
                const issue = fields.exercises?.[index]?.[key]
                const labels = { name: 'Nome do exercício', prescription: 'Prescrição', equipment: 'Equipamento', restSeconds: 'Descanso (s)', loadKg: 'Carga (kg)', executionTip: 'Dicas técnicas' }
                const { ref, ...input } = field
                return <TextField {...input} inputRef={ref} key={key} size="small" label={labels[key]} error={!!issue} helperText={issue?.message}
                  type={isNumeric ? 'number' : 'text'} multiline={key === 'executionTip'} minRows={key === 'executionTip' ? 2 : undefined}
                  slotProps={{ htmlInput: isNumeric ? { min: 0, step: key === 'loadKg' ? 0.01 : 1 } : undefined }} />
              })}
              <Controller name={`exercises.${index}.unilateral`} control={form.control} render={({ field }) => (
                <FormControlLabel label="Unilateral" control={<Checkbox checked={!!field.value} onChange={(_, checked) => field.onChange(checked)} />} />
              )} />
            </div>
            {rows.fields.length > 1 && <Button type="button" color="error" onClick={() => rows.remove(index)} disabled={mutation.isPending}>Remover exercício {index + 1}</Button>}
          </fieldset>)}
          <div className="row">
            <Button variant="outlined" disabled={mutation.isPending || rows.fields.length >= 30} onClick={() => rows.append({ name: '', prescription: '' })}>Adicionar exercício</Button>
            <Button variant="contained" type="submit" disabled={mutation.isPending}>Salvar treino</Button>
            {selected && <Button color="error" disabled={mutation.isPending} onClick={() => setConfirmDelete(true)}>Excluir treino</Button>}
          </div>
        </form>
      </div>
    </details>
    <Dialog open={confirmDelete} onClose={() => { if (!mutation.isPending) setConfirmDelete(false) }} aria-labelledby="delete-workout">
      <DialogTitle id="delete-workout">Excluir treino personalizado?</DialogTitle>
      <DialogContent>Seu histórico e recordes serão preservados.
        {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={() => setConfirmDelete(false)}>Cancelar</Button>
        <Button color="error" disabled={mutation.isPending} onClick={() => { if (selected) mutation.mutate({ id: selected.id }) }}>Confirmar exclusão</Button></DialogActions>
    </Dialog>
  </section>
}
