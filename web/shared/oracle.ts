import { z } from 'zod'
export const oracleQuestionSchema = z.object({
  question: z.string().trim().min(1).max(300),
  includeHealth: z.boolean().default(false),
}).strict()
