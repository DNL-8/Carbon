type TrainingSession = { sets: { exerciseId: string, weightKg: number, reps: number }[] }

export function summarizeTraining(sessions: readonly TrainingSession[]) {
  const byExercise = new Map<string, { weightKg: number, reps: number }[]>()
  for (const session of sessions) {
    const best = new Map<string, { weightKg: number, reps: number }>()
    for (const { exerciseId, weightKg, reps } of session.sets) {
      if (weightKg <= 0 || reps <= 0) continue
      const previous = best.get(exerciseId)
      if (!previous || weightKg > previous.weightKg || (weightKg === previous.weightKg && reps > previous.reps)) {
        best.set(exerciseId, { weightKg, reps })
      }
    }
    for (const [exerciseId, set] of best) {
      const history = byExercise.get(exerciseId) ?? []
      if (history.length < 3) history.push(set)
      byExercise.set(exerciseId, history)
    }
  }
  const comparable = [...byExercise.values()].filter(history => history.length === 3)
  const signals = comparable.filter(([latest, previous, oldest]) =>
    latest!.weightKg === previous!.weightKg && previous!.weightKg === oldest!.weightKg
    && latest!.reps <= previous!.reps && previous!.reps <= oldest!.reps,
  )
  return {
    sessionsCount: sessions.length,
    comparableExercises: comparable.length,
    possiblePlateaus: signals.length,
  }
}
