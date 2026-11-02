import type { QuestionAnswer, QuestionId, ScopeTier } from "./types.ts"
import type { PreparedSubmissionPayload } from "./submission.ts"

export type DraftAnswerSnapshot = {
  questionId: QuestionId
  answer: QuestionAnswer
  note: string | null
}

export type QuestionnaireDraftSnapshot = {
  selectedTier: ScopeTier | null
  answers: readonly DraftAnswerSnapshot[]
}

export type CreatedQuestionnaireDraft = {
  questionnaireUrl: string
  expiresAt: string | null
}

/**
 * UI-facing persistence boundary. An HTTP/server-action adapter can implement
 * this contract; UI code never receives a Supabase client or database row type.
 */
export interface QuestionnairePersistenceBoundary {
  createDraft(): Promise<CreatedQuestionnaireDraft>
  loadDraft(privateToken: string): Promise<QuestionnaireDraftSnapshot | null>
  saveAnswers(
    privateToken: string,
    tier: ScopeTier,
    answers: readonly DraftAnswerSnapshot[],
  ): Promise<void>
  submitDraft(privateToken: string, payload: PreparedSubmissionPayload): Promise<void>
}
