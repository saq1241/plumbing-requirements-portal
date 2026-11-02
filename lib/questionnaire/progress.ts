import type { QuestionnaireRuntimeSpecification } from "./types.ts"
import { isQuestionAnswered, isQuestionComplete, type QuestionnaireState } from "./answer-state.ts"
import { getNavigationSections } from "./navigation.ts"

export type QuestionnaireProgress = {
  applicableQuestionCount: number
  answeredQuestionCount: number
  remainingUnansweredQuestionCount: number
  requiredUnansweredQuestionCount: number
  currentSectionPosition: number | null
  totalApplicableSections: number
  completionPercentage: number
  canSubmit: boolean
}

export function calculateQuestionnaireProgress(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): QuestionnaireProgress {
  const sections = getNavigationSections(spec, state)
  const questions = sections.flatMap((section) => section.qs)
  const answered = questions.filter((question) =>
    isQuestionAnswered(state.answers[question.id]),
  ).length
  const requiredUnanswered = questions.filter((question) =>
    !isQuestionComplete(question, state.answers[question.id]),
  ).length
  const currentPosition = sections.findIndex((section) => section.id === state.currentSectionId)
  const applicableQuestionCount = questions.length

  return {
    applicableQuestionCount,
    answeredQuestionCount: answered,
    remainingUnansweredQuestionCount: applicableQuestionCount - answered,
    requiredUnansweredQuestionCount: requiredUnanswered,
    currentSectionPosition: currentPosition < 0 ? null : currentPosition + 1,
    totalApplicableSections: sections.length,
    completionPercentage: applicableQuestionCount === 0
      ? 0
      : Math.round((answered / applicableQuestionCount) * 100),
    canSubmit: state.effectiveTier !== null && requiredUnanswered === 0,
  }
}

