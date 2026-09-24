import { defineEventHandler, readBody } from 'h3'
import { generateAiSuggestedQuestions, type SuggestedQuestionsPayload } from '../../utils/sentinel/voyage/suggested-questions'

export default defineEventHandler(async (event) => {
  const body = await readBody<SuggestedQuestionsPayload>(event)
  return await generateAiSuggestedQuestions(body || {})
})
