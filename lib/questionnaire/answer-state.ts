import {
  type QuestionnaireQuestion,
  type QuestionnaireRuntimeSpecification,
  type QuestionAnswer,
  type QuestionId,
  type QuestionnaireSection,
  type ScopeTier,
} from "./types.ts"
import { getGatingQuestion, resolveQuestionnaireForTier, resolveTierFromA1 } from "./resolver.ts"

export type AnswerRecord = {
  answer: QuestionAnswer
  note: string | null
}

/** Stores all answers, including those for questions currently hidden by tier. */
export type AnswerState = Readonly<Record<string, AnswerRecord>>

export type QuestionnaireState = {
  selectedA1Answer: string | null
  effectiveTier: ScopeTier | null
  currentSectionId: QuestionnaireSection["id"] | null
  answers: AnswerState
}

function findQuestion(spec: QuestionnaireRuntimeSpecification, questionId: QuestionId): QuestionnaireQuestion {
  const question = spec.sections.flatMap((section) => section.qs).find((item) => item.id === questionId)
  if (!question) throw new Error(`Unknown questionnaire question: ${questionId}.`)
  return question
}

function withAnswer(
  answers: AnswerState,
  questionId: QuestionId,
  answer: QuestionAnswer,
): AnswerState {
  const previous = answers[questionId]
  return {
    ...answers,
    [questionId]: { answer, note: previous?.note ?? null },
  }
}

function getGateSectionId(spec: QuestionnaireRuntimeSpecification): QuestionnaireSection["id"] {
  const gate = getGatingQuestion(spec)
  return spec.sections.find((section) => section.qs.some((question) => question.id === gate.id))!.id
}

export function createQuestionnaireState(spec: QuestionnaireRuntimeSpecification): QuestionnaireState {
  return {
    selectedA1Answer: null,
    effectiveTier: null,
    currentSectionId: getGateSectionId(spec),
    answers: {},
  }
}

export function getAnswer(state: QuestionnaireState, questionId: QuestionId): AnswerRecord | undefined {
  return state.answers[questionId]
}

export function isQuestionAnswered(record: AnswerRecord | undefined): boolean {
  if (!record?.answer) return false
  switch (record.answer.kind) {
    case "single":
      return record.answer.value.length > 0
    case "multiple":
      return record.answer.values.length > 0
    case "text":
      return record.answer.value.trim().length > 0
  }
}

/** Questions are optional unless the YAML explicitly marks one `required`. */
export function isQuestionComplete(
  question: QuestionnaireQuestion,
  record: AnswerRecord | undefined,
): boolean {
  return question.required !== true || isQuestionAnswered(record)
}

export function setSingleSelectAnswer(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  option: string,
): QuestionnaireState {
  const question = findQuestion(spec, questionId)
  if (question.multi) throw new Error(`${questionId} is a multi-select question.`)
  if (question.gating) throw new Error(`Set ${questionId} through setA1Answer so tier visibility stays synchronized.`)
  if (!question.opts.includes(option)) throw new Error(`Unknown option for ${questionId}.`)

  return { ...state, answers: withAnswer(state.answers, questionId, { kind: "single", value: option }) }
}

export function setMultiSelectOption(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  option: string,
  selected: boolean,
): QuestionnaireState {
  const question = findQuestion(spec, questionId)
  if (!question.multi) throw new Error(`${questionId} is not a multi-select question.`)
  if (!question.opts.includes(option)) throw new Error(`Unknown option for ${questionId}.`)

  const existing = state.answers[questionId]?.answer
  if (existing && existing.kind !== "multiple") {
    throw new Error(`Stored answer for ${questionId} has the wrong answer kind.`)
  }
  const current = existing?.kind === "multiple" ? existing.values : []
  const values = selected
    ? current.includes(option) ? [...current] : [...current, option]
    : current.filter((value) => value !== option)

  return { ...state, answers: withAnswer(state.answers, questionId, { kind: "multiple", values }) }
}

export function addMultiSelectOption(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  option: string,
): QuestionnaireState {
  return setMultiSelectOption(spec, state, questionId, option, true)
}

export function removeMultiSelectOption(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  option: string,
): QuestionnaireState {
  return setMultiSelectOption(spec, state, questionId, option, false)
}

export function setFreeTextAnswer(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  value: string,
): QuestionnaireState {
  const question = findQuestion(spec, questionId)
  if (question.gating) throw new Error(`The gating question ${questionId} must use one of its configured options.`)
  const answer: QuestionAnswer = value.length === 0 ? null : { kind: "text", value }
  return { ...state, answers: withAnswer(state.answers, questionId, answer) }
}

export function updateClientNote(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
  note: string,
): QuestionnaireState {
  findQuestion(spec, questionId)
  const previous = state.answers[questionId]
  return {
    ...state,
    answers: {
      ...state.answers,
      [questionId]: { answer: previous?.answer ?? null, note: note.length > 0 ? note : null },
    },
  }
}

/** Clear the selected/write-in answer while preserving a separately entered note. */
export function clearAnswer(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
): QuestionnaireState {
  const question = findQuestion(spec, questionId)
  if (question.gating) return setA1Answer(spec, state, null)
  return { ...state, answers: withAnswer(state.answers, questionId, null) }
}

export function clearClientNote(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  questionId: QuestionId,
): QuestionnaireState {
  return updateClientNote(spec, state, questionId, "")
}

export function setA1Answer(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
  answer: string | null,
): QuestionnaireState {
  const gate = getGatingQuestion(spec)
  const nextAnswers = answer === null
    ? withAnswer(state.answers, gate.id, null)
    : (() => {
        if (!gate.opts.includes(answer)) throw new Error(`Unknown option for ${gate.id}.`)
        return withAnswer(state.answers, gate.id, { kind: "single", value: answer })
      })()
  const resolution = resolveTierFromA1(spec, answer)

  const visibleSections = resolution.effectiveTier === null
    ? []
    : spec.sections.flatMap((section) => {
        const visible = section.qs.some((question) =>
          (question.t ?? section.t).includes(resolution.effectiveTier!),
        )
        return visible ? [section.id] : []
      })
  const currentSectionId = state.currentSectionId && visibleSections.includes(state.currentSectionId)
    ? state.currentSectionId
    : visibleSections[0] ?? getGateSectionId(spec)

  return {
    ...state,
    selectedA1Answer: resolution.selectedA1Answer,
    effectiveTier: resolution.effectiveTier,
    currentSectionId,
    answers: nextAnswers,
  }
}

export function getVisibleAnswers(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): AnswerState {
  if (state.effectiveTier === null) return {}
  const visibleIds = new Set(
    resolveQuestionnaireForTier(spec, state.effectiveTier).sections.flatMap((section) =>
      section.qs.map((question) => question.id),
    ),
  )
  return Object.fromEntries(Object.entries(state.answers).filter(([id]) => visibleIds.has(id)))
}

