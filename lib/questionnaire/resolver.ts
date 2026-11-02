import {
  SCOPE_TIERS,
  type QuestionnaireQuestion,
  type QuestionnaireRuntimeSpecification,
  type QuestionnaireSection,
  type ScopeTier,
} from "./types.ts"

export type TierResolution = {
  selectedA1Answer: string | null
  effectiveTier: ScopeTier | null
  fallbackApplied: boolean
}

export type ResolvedQuestionnaire = {
  tier: ScopeTier
  sections: QuestionnaireSection[]
}

export function getGatingQuestion(spec: QuestionnaireRuntimeSpecification): QuestionnaireQuestion {
  const question = spec.sections.flatMap((section) => section.qs).find((item) => item.gating)
  if (!question) throw new Error("Questionnaire specification has no gating question.")
  return question
}

function tierFromSelectedOption(
  spec: QuestionnaireRuntimeSpecification,
  option: string,
): ScopeTier | null {
  const marker = option.match(/\((T\d+)\)\s*$/)?.[1] ?? (/^T\d+$/.test(option) ? option : null)
  if (!marker) return null

  const tier = Number(marker.slice(1))
  const configured = Object.keys(spec.scope_tiers).some((key) => key.startsWith(`${marker}_`))
  return configured && SCOPE_TIERS.includes(tier as ScopeTier) ? (tier as ScopeTier) : null
}

/** Resolve A1 from its selected option and its YAML-defined fallback. */
export function resolveTierFromA1(
  spec: QuestionnaireRuntimeSpecification,
  selectedAnswer: string | null | undefined,
): TierResolution {
  const answer = selectedAnswer || null
  if (answer === null) {
    return { selectedA1Answer: null, effectiveTier: null, fallbackApplied: false }
  }

  const gatingQuestion = getGatingQuestion(spec)
  if (!gatingQuestion.opts.includes(answer)) {
    throw new Error(`Invalid answer for gating question ${gatingQuestion.id}: the value is not one of its configured options.`)
  }

  if (gatingQuestion.fallback?.when_answer === answer) {
    return {
      selectedA1Answer: answer,
      effectiveTier: gatingQuestion.fallback.tier,
      fallbackApplied: true,
    }
  }

  const effectiveTier = tierFromSelectedOption(spec, answer)
  if (effectiveTier === null) {
    throw new Error(`Could not resolve a scope tier from the selected ${gatingQuestion.id} option.`)
  }

  return { selectedA1Answer: answer, effectiveTier, fallbackApplied: false }
}

/** Resolve visibility without mutating or normalizing any source data. */
export function resolveQuestionnaireForTier(
  spec: QuestionnaireRuntimeSpecification,
  tier: ScopeTier,
): ResolvedQuestionnaire {
  const sections = spec.sections.flatMap((section) => {
    const questions = section.qs.filter((question) =>
      (question.t ?? section.t).includes(tier),
    )

    return questions.length > 0 ? [{ ...section, qs: questions }] : []
  })

  return { tier, sections }
}

export function resolveQuestionnaireFromA1(
  spec: QuestionnaireRuntimeSpecification,
  selectedAnswer: string | null | undefined,
): TierResolution & { sections: QuestionnaireSection[] } {
  const resolution = resolveTierFromA1(spec, selectedAnswer)
  const sections = resolution.effectiveTier === null
    ? spec.sections.flatMap((section) => {
        const gate = section.qs.find((question) => question.gating)
        return gate ? [{ ...section, qs: [gate] }] : []
      })
    : resolveQuestionnaireForTier(spec, resolution.effectiveTier).sections

  return { ...resolution, sections }
}

/** Return option labels marked by `rec`, without selecting or changing any answer. */
export function getRecommendedOptions(
  spec: QuestionnaireRuntimeSpecification,
  question: QuestionnaireQuestion,
): string[] {
  if (!question.rec) return []

  const labelsByLowerCase = new Map(question.opts.map((option) => [option.toLocaleLowerCase(), option]))
  const exact = labelsByLowerCase.get(question.rec.toLocaleLowerCase())
  if (exact) return [exact]

  const combined = question.rec.split(/\s+\+\s+/)
  if (combined.length > 1) {
    const resolved = combined.map((part) => labelsByLowerCase.get(part.toLocaleLowerCase()))
    if (resolved.every((option): option is string => option !== undefined)) return resolved
  }

  const tierLabel = question.opts.find((option) =>
    option.match(/\((T\d+)\)\s*$/)?.[1] === question.rec,
  )
  if (tierLabel && tierFromSelectedOption(spec, tierLabel) !== null) return [tierLabel]

  return []
}
