import { expect, test } from 'vitest'
import { oracleQuestionSchema } from '../shared/oracle'
test('oracle validates prompt, limits data and disables sharing by default', () => {
  expect(oracleQuestionSchema.parse({ question: 'Treino hoje?' })).toEqual({ question: 'Treino hoje?', includeHealth: false })
  expect(oracleQuestionSchema.safeParse({ question: 'x'.repeat(301) }).success).toBe(false)
  expect(oracleQuestionSchema.safeParse({ question: ' ', includeHealth: true }).success).toBe(false)
  expect(oracleQuestionSchema.safeParse({ question: 'Treino hoje?', userId: 'other-user' }).success).toBe(false)
})
