import { notFound } from "next/navigation"
import { QuestionnaireExperience } from "@/components/questionnaire/questionnaire-experience"
import { toQuestionnaireClientSpecification } from "@/lib/questionnaire/client-spec"
import { loadQuestionnaireSpecification } from "@/lib/questionnaire/spec-loader"

export default async function LocalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  const spec = await loadQuestionnaireSpecification()

  return <QuestionnaireExperience spec={toQuestionnaireClientSpecification(spec)} />
}
