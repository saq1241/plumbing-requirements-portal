import "server-only"

import type {
  QuestionnaireClientSpecification,
  QuestionnaireSpecification,
  QuestionnaireTierKey,
} from "./types.ts"

const TIER_PREFIX = /^T[123]_/
const WHATSAPP_E164 = /^\+?[1-9]\d{7,14}$/

/** Project only question content and presentation data into the browser bundle. */
export function toQuestionnaireClientSpecification(
  spec: QuestionnaireSpecification,
): QuestionnaireClientSpecification {
  const scope_tiers = Object.fromEntries(
    Object.keys(spec.scope_tiers)
      .filter((key) => TIER_PREFIX.test(key))
      .map((key) => [key, true]),
  ) as Record<QuestionnaireTierKey, true>

  return {
    sections: spec.sections,
    scope_tiers,
    form_spec: {
      summary_format: spec.form_spec.summary_format,
      start_screen: spec.form_spec.start_screen,
    },
    wireframes: spec.wireframes,
    backend_spec: {
      owner_whatsapp_number: WHATSAPP_E164.test(spec.backend_spec.owner_whatsapp_number)
        ? spec.backend_spec.owner_whatsapp_number
        : "",
    },
  }
}
