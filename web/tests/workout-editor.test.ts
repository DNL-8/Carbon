import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, test } from 'vitest'
import CustomWorkoutEditor from '../app/components/CustomWorkoutEditor.vue'
import { customWorkoutSchema } from '../shared/training'

test('o editor carrega o treino existente e permite acrescentar uma série de exercícios', async () => {
  const workout = {
    id: 'treino', name: 'Treino do herói', description: '', durationMinutes: 20,
    type: 'forca', rank: 'F', difficulty: 'Iniciante', baseXp: 100,
    exercises: [{
      id: 'remada', name: 'Remada', prescription: '3 séries x 10',
      restSeconds: 60, muscleGroups: [], executionTip: '',
    }],
  } as const
  const editor = await mountSuspended(CustomWorkoutEditor, {
    props: { workouts: [{ ...workout, exercises: workout.exercises.map(exercise => ({ ...exercise, muscleGroups: [] })) }] },
  })
  try {
    await editor.findAll('button').find(button => button.text() === 'Editar Treino do herói')!.trigger('click')
    expect(editor.find<HTMLInputElement>('input').element.value).toBe(workout.name)
    expect(editor.findAll('fieldset')).toHaveLength(1)
    await editor.findAll('button').find(button => button.text() === 'Adicionar exercício')!.trigger('click')
    expect(editor.findAll('fieldset')).toHaveLength(2)
  } finally {
    editor.unmount()
  }
})

test('a API rejeita um treino com dois exercícios usando o mesmo ID', () => {
  const exercise = { id: 'd38c5244-e4fd-41c0-a159-2a035b66e82e', name: 'Remada', prescription: '3 séries x 10' }
  expect(customWorkoutSchema.safeParse({
    name: 'Treino', description: '', type: 'forca', durationMinutes: 20,
    exercises: [exercise, exercise],
  }).success).toBe(false)
})
