import type { QuestionnaireSection, QuestionnaireRuntimeSpecification, SectionId } from "./types.ts"
import type { QuestionnaireState } from "./answer-state.ts"
import { getGatingQuestion, resolveQuestionnaireForTier } from "./resolver.ts"

export function getNavigationSections(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): QuestionnaireSection[] {
  if (state.effectiveTier !== null) {
    return resolveQuestionnaireForTier(spec, state.effectiveTier).sections
  }

  const gatingQuestion = getGatingQuestion(spec)
  return spec.sections.flatMap((section) => {
    const question = section.qs.find((item) => item.id === gatingQuestion.id)
    return question ? [{ ...section, qs: [question] }] : []
  })
}

export function getFirstApplicableSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): SectionId | null {
  return getNavigationSections(spec, state)[0]?.id ?? null
}

export function getLastApplicableSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): SectionId | null {
  const sections = getNavigationSections(spec, state)
  return sections[sections.length - 1]?.id ?? null
}

export function goToApplicableSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  sectionId: SectionId,
): QuestionnaireState {
  const allowed = getNavigationSections(spec, state).some((section) => section.id === sectionId)
  if (!allowed) throw new Error(`Section ${sectionId} is not applicable to the current questionnaire path.`)
  return { ...state, currentSectionId: sectionId }
}

function moveSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  direction: -1 | 1,
): QuestionnaireState {
  const sections = getNavigationSections(spec, state)
  const currentIndex = sections.findIndex((section) => section.id === state.currentSectionId)
  if (currentIndex < 0) return state

  const nextSection = sections[currentIndex + direction]
  return nextSection ? { ...state, currentSectionId: nextSection.id } : state
}

export function nextSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): QuestionnaireState {
  return moveSection(spec, state, 1)
}

export function previousSection(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): QuestionnaireState {
  return moveSection(spec, state, -1)
}

export function hasReachedEnd(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): boolean {
  return state.currentSectionId !== null && state.currentSectionId === getLastApplicableSection(spec, state)
}

