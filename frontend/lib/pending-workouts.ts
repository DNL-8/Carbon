import { z } from 'zod'
import { finishTrainingSchema } from '../shared/training'
import type { FinishInput } from './api'

const schema = z.object({ version: z.literal(1), owner: z.string(), name: z.string(), body: finishTrainingSchema })
export type PendingWorkout = z.infer<typeof schema>
const prefix = (owner: string) => 'murim-pending-v1:' + encodeURIComponent(owner) + ':'
const key = (owner: string, id: string) => prefix(owner) + id

// Only the completed submission is retained; never store session tokens.
export function savePendingWorkout(owner: string, name: string, body: FinishInput): boolean {
  try {
    localStorage.setItem(key(owner, body.id), JSON.stringify(schema.parse({ version: 1, owner, name, body })))
    return true
  } catch { return false }
}

export function removePendingWorkout(owner: string, id: string) {
  try { localStorage.removeItem(key(owner, id)) } catch { /* The server can safely replay the same ID. */ }
}

export function listPendingWorkouts(owner: string): PendingWorkout[] {
  const entries: PendingWorkout[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const ident = localStorage.key(i)
      if (!ident?.startsWith(prefix(owner))) continue
      try {
        const entry = schema.safeParse(JSON.parse(localStorage.getItem(ident) ?? 'null'))
        if (entry.success && entry.data.owner === owner && ident === key(owner, entry.data.body.id)) entries.push(entry.data)
      } catch { /* Do not submit invalid stored data. */ }
    }
  } catch { /* Storage may be unavailable. */ }
  return entries
}
