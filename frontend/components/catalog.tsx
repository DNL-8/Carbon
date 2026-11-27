'use client'

import { useState } from 'react'
import { Button, Chip, TextField } from '@mui/material'
import type { WorkoutTemplate } from '../../src/types/fitness'

const types = [['all', 'Todos'], ['cardio', 'Cardio'], ['forca', 'Força'], ['hiit', 'HIIT'], ['core', 'Abdômen'], ['mobilidade', 'Mobilidade'], ['corpo_inteiro', 'Corpo inteiro']] as const

export function Catalog({ workouts, onStart }: { workouts: WorkoutTemplate[]; onStart: (workout: WorkoutTemplate) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<(typeof types)[number][0]>('all')
  const term = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = workouts.filter(workout => (category === 'all' || workout.type === category) &&
    [workout.name, workout.description, ...workout.exercises.flatMap(e => [e.name, ...e.muscleGroups])].some(value => value.toLocaleLowerCase('pt-BR').includes(term)))
  return <section aria-labelledby="catalog-title" className="view">
    <header className="view-heading"><h1 id="catalog-title">Catálogo de treinos</h1>
      <p>Conclua os exercícios no Modo Foco para ganhar XP e moedas.</p>
    </header>
    <div className="surface catalog-filter">
      <TextField label="Buscar treino" placeholder="Treino, exercício ou músculo" fullWidth size="small" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="filter-row" role="group" aria-label="Categoria">
        {types.map(([id, label]) => <Button variant={category === id ? 'contained' : 'outlined'} aria-pressed={category === id} onClick={() => setCategory(id)} key={id}>{label}</Button>)}
      </div>
    </div>
    <p className="muted" role="status">{filtered.length} {filtered.length === 1 ? 'treino disponível' : 'treinos disponíveis'}</p>
    <div className="workout-grid">
      {filtered.map(workout => <article className="surface workout-card" key={workout.id}>
        <Chip label={'Rank ' + workout.rank} size="small" variant="outlined" color="primary" />
        <h2>{workout.name}</h2><p>{workout.description}</p>
        <p className="workout-meta">{workout.durationMinutes} min · {workout.exercises.length} exercícios · {workout.difficulty}</p>
        <Button variant="contained" onClick={() => onStart(workout)} aria-label={'Iniciar treino: ' + workout.name}>Iniciar treino</Button>
      </article>)}
    </div>
  </section>
}
