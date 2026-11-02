import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { QuestionnaireSpecification } from "./types.ts"
import { parseQuestionnaireSpecification } from "./spec-validation.ts"

export const QUESTIONNAIRE_SPEC_FILENAME = "requirements_form_spec.yaml"

const specificationFilePath = join(process.cwd(), QUESTIONNAIRE_SPEC_FILENAME)

let specificationSource: string
try {
  // This is stable project configuration, so read it once outside render-time work.
  specificationSource = await readFile(specificationFilePath, "utf8")
} catch (error) {
  throw new Error(
    `Could not read ${QUESTIONNAIRE_SPEC_FILENAME} from the project root: ${error instanceof Error ? error.message : String(error)}`,
  )
}

const questionnaireSpecification = parseQuestionnaireSpecification(specificationSource)

/** Return the server-loaded, validated canonical questionnaire specification. */
export async function loadQuestionnaireSpecification(): Promise<QuestionnaireSpecification> {
  return questionnaireSpecification
}
