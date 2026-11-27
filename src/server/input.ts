import { z } from 'zod';
import type { Context } from 'hono';
import { ApiHttpError } from './apiError.ts';
import { MAX_AI_CONTEXT_CHARS, readJsonBody, type AppEnv } from './shared.ts';

export const documentId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const dateKey = z.iso.date();
const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().nonnegative();
const workoutType = z.enum(['cardio', 'forca', 'hiit', 'core', 'mobilidade', 'corpo_inteiro']);

export const input = {
  oracleContext: z.object({
    question: text(400),
    contextText: z.string().trim().max(MAX_AI_CONTEXT_CHARS).optional(),
  }),
  insights: z.object({
    summary: text(MAX_AI_CONTEXT_CHARS),
  }),
  loadAdjustments: z.object({
    recentLogs: z
      .array(
        z.object({
          dateKey,
          workoutId: documentId,
          workoutName: text(120),
          workoutType,
          completedExercises: count,
          totalExercises: count,
          durationMinutes: z.number().nonnegative(),
          xpEarned: z.number().nonnegative(),
        })
      )
      .min(1)
      .max(12),
    candidateWorkouts: z
      .array(
        z.object({
          workoutId: documentId,
          workoutName: text(120),
          recentCount: count,
          avgCompletionPercent: z.number().min(0).max(100),
          exercises: z
            .array(
              z.object({
                exerciseId: documentId,
                name: text(120),
                equipment: z.string().max(80).optional(),
                currentLoadKg: z.number().min(0).max(400),
                prescription: z.string().max(120),
                unilateral: z.boolean().optional(),
                loadNote: z.string().max(140).optional(),
              })
            )
            .min(1)
            .max(10),
        })
      )
      .min(1)
      .max(6),
    stagnation: z
      .object({
        signalKind: z.enum(['none', 'repeated_incomplete', 'frequency_drop', 'stalled_xp']),
        reason: z.string().max(300),
        avgCompletionPercent: z.number().min(0).max(100),
        daysSinceLastSession: count.nullable(),
      })
      .optional(),
  }),
  stravaSync: z.object({
    days: z.number().min(7).max(90).optional(),
    maxHr: z.number().min(100).max(240).optional(),
  }),
};

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const field = result.error.issues[0]?.path.join('.');
  throw new ApiHttpError(
    400,
    field ? `Campo "${field}" inválido.` : 'Dados da requisição inválidos.',
    'invalid_request_body'
  );
}

export async function readJsonInput<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T> {
  return parseInput(schema, await readJsonBody(c));
}

export function singleQuery(c: Context<AppEnv>, name: string): string | undefined {
  const values = c.req.queries(name);
  if (values && values.length > 1) {
    throw new ApiHttpError(400, `Informe apenas um valor para "${name}".`, 'duplicate_query_parameter');
  }
  return values?.[0];
}
