import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { parseQuestionnaireSpecification } from "../lib/questionnaire/spec-validation.ts"
import { loadQuestionnaireSpecification } from "../lib/questionnaire/spec-loader.ts"
import { toQuestionnaireClientSpecification } from "../lib/questionnaire/client-spec.ts"
import {
  addMultiSelectOption,
  createQuestionnaireState,
  getAnswer,
  getVisibleAnswers,
  setA1Answer,
  setFreeTextAnswer,
  setSingleSelectAnswer,
  updateClientNote,
} from "../lib/questionnaire/answer-state.ts"
import {
  getFirstApplicableSection,
  getLastApplicableSection,
  goToApplicableSection,
  hasReachedEnd,
  nextSection,
  previousSection,
} from "../lib/questionnaire/navigation.ts"
import { calculateQuestionnaireProgress } from "../lib/questionnaire/progress.ts"
import {
  getRecommendedOptions,
  resolveQuestionnaireForTier,
  resolveQuestionnaireFromA1,
  resolveTierFromA1,
} from "../lib/questionnaire/resolver.ts"
import { prepareSubmission } from "../lib/questionnaire/submission.ts"
import type { ScopeTier } from "../lib/questionnaire/types.ts"

const specPromise = loadQuestionnaireSpecification()

test("loads canonical YAML with the expected sections, definitions, order, and unique IDs", async () => {
  const spec = await specPromise
  const questions = spec.sections.flatMap((section) => section.qs)
  assert.equal(spec.sections.length, 16)
  assert.deepEqual(spec.sections.map(({ id }) => id), [..."ABCDEFGHIJKLMNOP"])
  assert.equal(questions.length, 86)
  assert.equal(new Set(questions.map(({ id }) => id)).size, 86)
})

test("preserves parsed YAML mappings and optional fields instead of coercing them", async () => {
  const spec = await specPromise
  assert.deepEqual(spec.project.original_idea[2], {
    "payment gateway": "credit card with EMI (EMI handled by customer's bank + gateway; owner receives full amount minus fees)",
  })
  assert.deepEqual(spec.form_spec.ux[4], {
    "sketch disclaimer under wireframes": "Sample only. Final design may differ.",
  })
  assert.equal(spec.scope_tiers.T3_full_ecommerce.excludes, undefined)
  assert.equal(spec.wireframes.list.length, 11)
})

test("client specification projection omits internal project and pricing guidance", async () => {
  const source = await specPromise
  const client = toQuestionnaireClientSpecification(source)
  assert.equal(client.sections.flatMap((section) => section.qs).length, 86)
  assert.equal("pricing_guidance" in client, false)
  assert.equal("architecture_notes" in client, false)
  assert.equal("project" in client, false)
  assert.equal("tasks_for_ai" in client, false)
  assert.equal(client.backend_spec.owner_whatsapp_number, "")
})

test("computes tier counts from section inheritance and question overrides", async () => {
  const spec = await specPromise
  const expected: Record<ScopeTier, number> = { 1: 49, 2: 78, 3: 85 }
  for (const tier of [1, 2, 3] as const) {
    assert.equal(
      resolveQuestionnaireForTier(spec, tier).sections.reduce((count, section) => count + section.qs.length, 0),
      expected[tier],
    )
  }
})

test("A1 resolves explicit tiers and YAML-defined Not sure fallback", async () => {
  const spec = await specPromise
  const gate = spec.sections[0].qs[0]
  assert.equal(gate.id, "A1")
  assert.deepEqual(gate.fallback, { when_answer: "Not sure", tier: 2 })
  assert.equal(resolveTierFromA1(spec, gate.opts[0]).effectiveTier, 1)
  assert.equal(resolveTierFromA1(spec, gate.opts[1]).effectiveTier, 2)
  assert.equal(resolveTierFromA1(spec, gate.opts[2]).effectiveTier, 3)
  assert.deepEqual(resolveTierFromA1(spec, "Not sure"), {
    selectedA1Answer: "Not sure", effectiveTier: 2, fallbackApplied: true,
  })
  assert.equal(resolveQuestionnaireFromA1(spec, null).sections[0].qs.length, 1)
  assert.equal(resolveQuestionnaireFromA1(spec, "Not sure").sections.reduce((n, s) => n + s.qs.length, 0), 78)
  assert.throws(() => resolveTierFromA1(spec, "invalid"), /not one of its configured options/)
})

test("validates source changes and reports invalid YAML or invalid structure", async () => {
  const source = await readFile("requirements_form_spec.yaml", "utf8")
  assert.throws(() => parseQuestionnaireSpecification("sections: [unterminated"), /Could not parse requirements_form_spec.yaml/)
  assert.throws(() => parseQuestionnaireSpecification(source.replace("revision: 2", "revision: nope")), /meta.revision/)
})

test("answer state supports single, multiple, free text, and separate client notes", async () => {
  const spec = await specPromise
  let state = setA1Answer(spec, createQuestionnaireState(spec), "Customers order in app, I record payments and manage credit (T2)")
  state = setSingleSelectAnswer(spec, state, "B1", "Under 50")
  state = addMultiSelectOption(spec, state, "D2", "Shop name and phone")
  state = addMultiSelectOption(spec, state, "D2", "GST number")
  state = addMultiSelectOption(spec, state, "D2", "Shop name and phone")
  state = setFreeTextAnswer(spec, state, "A2", "Please call me")
  state = updateClientNote(spec, state, "B1", "About 40 active customers")
  assert.deepEqual(getAnswer(state, "B1"), {
    answer: { kind: "single", value: "Under 50" }, note: "About 40 active customers",
  })
  assert.deepEqual(getAnswer(state, "D2")?.answer, {
    kind: "multiple", values: ["Shop name and phone", "GST number"],
  })
  assert.deepEqual(getAnswer(state, "A2")?.answer, { kind: "text", value: "Please call me" })
  assert.throws(() => setSingleSelectAnswer(spec, state, "D2", "GST number"), /multi-select/)
})

test("tier changes hide answers from the path without deleting them", async () => {
  const spec = await specPromise
  let state = setA1Answer(spec, createQuestionnaireState(spec), "Complete online shop with stock, online payment, auto GST bills and reports (T3)")
  state = setSingleSelectAnswer(spec, state, "C5", "Yes, reduce stock automatically on each order")
  const stored = getAnswer(state, "C5")
  state = setA1Answer(spec, state, "Only track credit: I make bills myself, app keeps customer credit days and reminders (T1)")
  assert.equal(getAnswer(state, "C5"), stored)
  assert.equal(getVisibleAnswers(spec, state).C5, undefined)
  state = setA1Answer(spec, state, "Complete online shop with stock, online payment, auto GST bills and reports (T3)")
  assert.equal(getVisibleAnswers(spec, state).C5?.answer, stored?.answer)
})

test("navigation uses only applicable non-empty sections and respects its boundaries", async () => {
  const spec = await specPromise
  let state = createQuestionnaireState(spec)
  assert.equal(getFirstApplicableSection(spec, state), "A")
  assert.equal(getLastApplicableSection(spec, state), "A")
  assert.equal(hasReachedEnd(spec, state), true)
  state = setA1Answer(spec, state, "Only track credit: I make bills myself, app keeps customer credit days and reminders (T1)")
  assert.equal(getLastApplicableSection(spec, state), "P")
  assert.equal(hasReachedEnd(spec, state), false)
  assert.equal(previousSection(spec, state).currentSectionId, "A")
  assert.equal(nextSection(spec, state).currentSectionId, "B")
  assert.throws(() => goToApplicableSection(spec, state, "C"), /not applicable/)
  state = goToApplicableSection(spec, state, "P")
  assert.equal(hasReachedEnd(spec, state), true)
  assert.equal(nextSection(spec, state).currentSectionId, "P")
})

test("progress is based on the selected applicable path and YAML required flags", async () => {
  const spec = await specPromise
  let state = createQuestionnaireState(spec)
  let progress = calculateQuestionnaireProgress(spec, state)
  assert.equal(progress.applicableQuestionCount, 1)
  assert.equal(progress.canSubmit, false)
  state = setA1Answer(spec, state, "Not sure")
  progress = calculateQuestionnaireProgress(spec, state)
  assert.equal(progress.applicableQuestionCount, 78)
  assert.equal(progress.requiredUnansweredQuestionCount, 0)
  assert.equal(progress.completionPercentage, 1)
  assert.equal(progress.canSubmit, true)
})

test("recommendations are resolved as metadata and do not auto-select answers", async () => {
  const spec = await specPromise
  const d1 = spec.sections.flatMap((section) => section.qs).find(({ id }) => id === "D1")!
  assert.deepEqual(getRecommendedOptions(spec, d1), ["Anyone can sign up, I approve before they can order"])
  assert.equal(createQuestionnaireState(spec).answers.D1, undefined)
})

test("submission keeps A1 and visible answers, includes client notes, omits hidden answers", async () => {
  const spec = await specPromise
  let state = setA1Answer(spec, createQuestionnaireState(spec), "Not sure")
  state = setSingleSelectAnswer(spec, state, "B1", "Under 50")
  state = updateClientNote(spec, state, "B1", "Client note")
  state = setFreeTextAnswer(spec, state, "A2", "Call next week")
  const result = prepareSubmission(spec, state)
  assert.equal(result.ready, true)
  if (!result.ready) return
  assert.equal(result.payload.selectedTier, 2)
  assert.equal(result.payload.selectedA1Answer, "Not sure")
  assert.deepEqual(result.payload.answers.map(({ questionId }) => questionId), ["A1", "A2", "B1"])
  assert.equal(result.payload.answers[1].answer?.kind, "text")
  assert.equal(result.payload.answers[2].note, "Client note")
  assert.match(result.payload.summary, /Q1\. Which one sounds closest to what you want\? Answer: Not sure/)
  assert.doesNotMatch(result.payload.summary, /helper note|Suggested/)
})

test("submission refuses an unresolved tier", async () => {
  const spec = await specPromise
  assert.deepEqual(prepareSubmission(spec, createQuestionnaireState(spec)), {
    ready: false, reason: "tier_unresolved",
  })
})
