import type {
  QuestionnaireQuestion,
  QuestionnaireRuntimeSpecification,
  QuestionAnswer,
  QuestionId,
  ScopeTier,
} from "./types.ts"
import type { QuestionnaireState } from "./answer-state.ts"
import { isQuestionAnswered } from "./answer-state.ts"
import { resolveQuestionnaireForTier, resolveTierFromA1 } from "./resolver.ts"

export type PreparedQuestionAnswer = {
  questionId: QuestionId
  answer: QuestionAnswer
  note: string | null
}

export type PreparedSubmissionPayload = {
  selectedTier: ScopeTier
  selectedA1Answer: string
  answers: PreparedQuestionAnswer[]
  summary: string
}

export type SubmissionPreparation =
  | { ready: true; payload: PreparedSubmissionPayload }
  | { ready: false; reason: "tier_unresolved" }
  | { ready: false; reason: "required_unanswered"; questionIds: QuestionId[] }

function validateAnswer(question: QuestionnaireQuestion, answer: QuestionAnswer): void {
  if (answer === null) return

  if (answer.kind === "single") {
    if (question.multi || !question.opts.includes(answer.value)) {
      throw new Error(`Invalid single-select answer for ${question.id}.`)
    }
  } else if (answer.kind === "multiple") {
    if (!question.multi || answer.values.some((value) => !question.opts.includes(value))) {
      throw new Error(`Invalid multi-select answer for ${question.id}.`)
    }
  } else if (question.gating) {
    throw new Error(`The gating question ${question.id} must use one of its configured options.`)
  }
}

function displayAnswer(answer: QuestionAnswer): string {
  if (answer === null) return ""
  switch (answer.kind) {
    case "single":
    case "text":
      return answer.value
    case "multiple":
      return answer.values.join(", ")
  }
}

function formatSummaryLine(
  template: string,
  ordinal: number,
  question: QuestionnaireQuestion,
  answer: QuestionAnswer,
  note: string | null,
): string {
  const values: Record<string, string> = {
    "Qn.": `Q${ordinal}.`,
    "question?": question.q,
    option: displayAnswer(answer),
    text: note ?? "",
  }
  return template.replace(/Qn\.|question\?|option|text/g, (placeholder) => values[placeholder])
}

export function prepareSubmission(
  spec: QuestionnaireRuntimeSpecification,
  state: QuestionnaireState,
): SubmissionPreparation {
  if (state.effectiveTier === null || state.selectedA1Answer === null) {
    return { ready: false, reason: "tier_unresolved" }
  }

  const resolution = resolveTierFromA1(spec, state.selectedA1Answer)
  if (resolution.effectiveTier !== state.effectiveTier) {
    throw new Error("Questionnaire state tier does not match the A1 answer and YAML fallback configuration.")
  }

  const sections = resolveQuestionnaireForTier(spec, state.effectiveTier).sections
  const visibleQuestions = sections.flatMap((section) => section.qs)
  const requiredUnanswered = visibleQuestions
    .filter((question) => question.required === true && !isQuestionAnswered(state.answers[question.id]))
    .map((question) => question.id)
  if (requiredUnanswered.length > 0) {
    return { ready: false, reason: "required_unanswered", questionIds: requiredUnanswered }
  }

  const preparedAnswers: PreparedQuestionAnswer[] = []
  const summaryLines: string[] = []

  for (const question of visibleQuestions) {
    const record = state.answers[question.id]
    if (!record) continue
    validateAnswer(question, record.answer)

    const note = record.note || null
    if (!isQuestionAnswered(record) && note === null) continue

    preparedAnswers.push({ questionId: question.id, answer: record.answer, note })
    summaryLines.push(
      formatSummaryLine(spec.form_spec.summary_format, summaryLines.length + 1, question, record.answer, note),
    )
  }

  return {
    ready: true,
    payload: {
      selectedTier: state.effectiveTier,
      selectedA1Answer: state.selectedA1Answer,
      answers: preparedAnswers,
      summary: summaryLines.join("\n"),
    },
  }
}

