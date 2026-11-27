import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, test } from 'vitest'
import OriginalWorkoutCatalog from '../app/components/OriginalWorkoutCatalog.vue'
import { INITIAL_WORKOUTS, WARRIOR_AWAKENING_WORKOUT_IDS } from '../../src/utils/rpgLogic'

test('o catálogo original mantém a trilha inicial e filtra por rank, categoria e busca', async () => {
  const catalog = await mountSuspended(OriginalWorkoutCatalog, { props: { workouts: [...INITIAL_WORKOUTS], disabled: false } })
  try {
    expect(catalog.findAll('article')).toHaveLength(INITIAL_WORKOUTS.length)
    expect(catalog.findAll('article[data-starter-track="true"]')).toHaveLength(WARRIOR_AWAKENING_WORKOUT_IDS.length)
    await catalog.get('[aria-label="Filtrar por Rank F (Trilha inicial)"]').trigger('click')
    expect(catalog.findAll('article')).toHaveLength(WARRIOR_AWAKENING_WORKOUT_IDS.length)
    await catalog.get('[aria-label="Mostrar todos os ranks"]').trigger('click')
    await catalog.findAll('button').find(button => button.text() === 'Cardio')!.trigger('click')
    expect(catalog.findAll('article')).toHaveLength(INITIAL_WORKOUTS.filter(workout => workout.type === 'cardio').length)
    await catalog.get('[aria-label="Buscar treino"]').setValue('sem-resultados-123')
    expect(catalog.findAll('article')).toHaveLength(0)
    expect(catalog.text()).toContain('Nenhum treino encontrado')
    await catalog.findAll('button').find(button => button.text() === 'Limpar filtros')!.trigger('click')
    expect(catalog.findAll('article')).toHaveLength(INITIAL_WORKOUTS.length)
  } finally {
    catalog.unmount()
  }
})

test('expandir exercícios e iniciar treino mantêm os IDs reais do catálogo', async () => {
  const catalog = await mountSuspended(OriginalWorkoutCatalog, { props: { workouts: [...INITIAL_WORKOUTS], disabled: false } })
  try {
    const first = catalog.findAll('article')[0]!
    await first.get('button[aria-expanded]').trigger('click')
    const expected = INITIAL_WORKOUTS.find(workout => workout.id === WARRIOR_AWAKENING_WORKOUT_IDS[0])!
    expect(first.text()).toContain(expected.exercises[0]!.name)
    await first.findAll('button').find(button => button.text().includes('Iniciar treino'))!.trigger('click')
    expect(catalog.emitted('start')?.[0]).toEqual([expected])
  } finally {
    catalog.unmount()
  }
})
