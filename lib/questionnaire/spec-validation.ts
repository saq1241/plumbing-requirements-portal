import "server-only"

import { parse, YAMLParseError } from "yaml"
import { z } from "zod"
import {
  QUESTIONNAIRE_SECTIONS,
  SCOPE_TIERS,
  type QuestionnaireQuestion,
  type QuestionnaireSpecification,
} from "./types.ts"
import { getRecommendedOptions } from "./resolver.ts"

const tierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
const stringListSchema = z.array(z.string())
const textEntrySchema = z.union([z.string(), z.record(z.string(), z.string())])
const textEntryListSchema = z.array(textEntrySchema)

const questionSchema = z
  .object({
    id: z.string().regex(/^[A-P]\d+[a-z]*$/).max(12),
    q: z.string().min(1),
    t: z.array(tierSchema).min(1).max(3).optional(),
    opts: stringListSchema.min(1),
    multi: z.literal(true).optional(),
    rec: z.string().min(1).optional(),
    gating: z.literal(true).optional(),
    fallback: z
      .object({
        when_answer: z.string().min(1),
        tier: tierSchema,
      })
      .strict()
      .optional(),
    note: z.string().optional(),
    wf: z.string().regex(/^wf_[a-z0-9_]+$/).optional(),
    required: z.boolean().optional(),
  })
  .strict()

const sectionSchema = z
  .object({
    id: z.enum(QUESTIONNAIRE_SECTIONS),
    title: z.string().min(1),
    intro: z.string().optional(),
    t: z.array(tierSchema).min(1).max(3),
    qs: z.array(questionSchema).min(1),
  })
  .strict()

const wireframeEntrySchema = z
  .record(z.string(), z.union([z.string(), stringListSchema]))
  .superRefine((entry, ctx) => {
    const keys = Object.keys(entry)
    if (keys.length !== 1) {
      ctx.addIssue({ code: "custom", message: "Each wireframe list entry must contain exactly one key." })
      return
    }

    const [key] = keys
    const value = entry[key]
    if (key === "also_optional") {
      if (!Array.isArray(value)) {
        ctx.addIssue({ code: "custom", path: [key], message: "also_optional must be a list of wireframe names." })
      }
    } else if (!/^wf_[a-z0-9_]+$/.test(key) || typeof value !== "string") {
      ctx.addIssue({ code: "custom", path: [key], message: "Named wireframes must use a wf_* key and a string description." })
    }
  })

const metadataSchema = z
  .object({
    doc: z.string(),
    purpose: z.string(),
    author_role: z.string(),
    consumers: stringListSchema,
    revision: z.number().int().positive(),
    revision_notes: z.string(),
  })
  .strict()

const projectSchema = z
  .object({
    client_business: z.string(),
    deliverable: z.string(),
    original_idea: textEntryListSchema,
    open_scope_question: z.string(),
    web_panel: z.string(),
  })
  .strict()

const architectureNotesSchema = z
  .object({
    backend_required: z.boolean(),
    reason: z.string(),
    app_model: z.string(),
    auth: z.string(),
    price_logic: z.string(),
    payments: z.string(),
    gateway_options: stringListSchema,
    gateway_notes: z.string(),
    notifications: z.string(),
    credit_edge_cases: stringListSchema,
    order_flow: stringListSchema,
    stock_edge: z.string(),
    play_store: z.string(),
    web_admin: z.string(),
  })
  .strict()

const scopeTiersSchema = z
  .object({
    T1_credit_tracker: z.object({ desc: z.string(), includes: stringListSchema, excludes: stringListSchema.optional() }).strict(),
    T2_ordering_app: z.object({ desc: z.string(), includes: stringListSchema, excludes: stringListSchema.optional() }).strict(),
    T3_full_ecommerce: z.object({ desc: z.string(), includes: stringListSchema, excludes: stringListSchema.optional() }).strict(),
    gating: z.string().min(1),
  })
  .strict()

const formSpecSchema = z
  .object({
    type: z.string(),
    language: z.string(),
    length: z.string(),
    per_question: stringListSchema,
    ux: textEntryListSchema,
    wireframe_style: z.string(),
    start_screen: z.object({ title: z.string(), checklist: stringListSchema }).strict(),
    final_screen: stringListSchema,
    summary_format: z.string(),
    excluded: z.string(),
  })
  .strict()

const backendSpecSchema = z
  .object({
    storage: z.string(),
    access: z.string(),
    secrets: z.string(),
    hosting_free_options: z.object({ pages: stringListSchema, storage: stringListSchema }).strict(),
    admin_view: z.string(),
    backup: z.string(),
    owner_whatsapp_number: z.string(),
    developer_stack: z.string(),
  })
  .strict()

const processSchema = z
  .object({ goal: z.string(), steps: stringListSchema, scope_control: z.string() })
  .strict()

const pricingGuidanceSchema = z
  .object({
    note: z.string(),
    method: stringListSchema,
    offer: z.string(),
    payment_milestones: stringListSchema,
    recurring_separate: stringListSchema,
    maintenance: z.string(),
    web_admin: z.string(),
    main_cost_drivers: stringListSchema,
  })
  .strict()

function questionDefinitions(spec: QuestionnaireSpecification) {
  return spec.sections.flatMap((section) =>
    section.qs.map((question) => ({ section, question })),
  )
}

export const questionnaireSpecificationSchema: z.ZodType<QuestionnaireSpecification> = z
  .object({
    meta: metadataSchema,
    project: projectSchema,
    scope_tiers: scopeTiersSchema,
    architecture_notes: architectureNotesSchema,
    form_spec: formSpecSchema,
    backend_spec: backendSpecSchema,
    sections: z.array(sectionSchema).length(QUESTIONNAIRE_SECTIONS.length),
    wireframes: z.object({ style: z.string(), list: z.array(wireframeEntrySchema).min(1) }).strict(),
    process: processSchema,
    pricing_guidance: pricingGuidanceSchema,
    tasks_for_ai: stringListSchema,
  })
  .strict()
  .superRefine((spec, ctx) => {
    const sectionIds = spec.sections.map((section) => section.id)
    if (sectionIds.some((id, index) => id !== QUESTIONNAIRE_SECTIONS[index])) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: `Sections must appear once each in source order (${QUESTIONNAIRE_SECTIONS.join(", ")}).`,
      })
    }

    const allQuestions = questionDefinitions(spec)
    const ids = new Set<string>()
    const gates: Array<{ sectionId: string; question: QuestionnaireQuestion }> = []

    for (const { section, question } of allQuestions) {
      const questionPath = ["sections", sectionIds.indexOf(section.id), "qs", section.qs.indexOf(question)]
      if (ids.has(question.id)) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "id"], message: `Duplicate question ID ${question.id}.` })
      }
      ids.add(question.id)

      if (!question.id.startsWith(section.id)) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "id"], message: `Question ID ${question.id} must belong to section ${section.id}.` })
      }

      if (new Set(question.opts).size !== question.opts.length) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "opts"], message: "Question options must be unique." })
      }

      if (question.t && new Set(question.t).size !== question.t.length) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "t"], message: "Question tier values must be unique." })
      }

      if (question.gating) gates.push({ sectionId: section.id, question })
      if (question.gating && !question.fallback) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "fallback"], message: "A gating question must define its fallback in YAML." })
      }
      if (question.fallback && !question.gating) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "fallback"], message: "Fallback configuration is only valid on a gating question." })
      }
      if (question.fallback && !question.opts.includes(question.fallback.when_answer)) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "fallback", "when_answer"], message: "Fallback answer must exactly match one of the question options." })
      }
      if (question.rec && getRecommendedOptions(spec, question).length === 0) {
        ctx.addIssue({ code: "custom", path: [...questionPath, "rec"], message: "Recommended answer does not resolve to any configured option." })
      }
    }

    if (gates.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["sections"], message: `Expected exactly one gating question; found ${gates.length}.` })
    }

    const wireframeNames = new Set<string>()
    for (const entry of spec.wireframes.list) {
      for (const name of Object.keys(entry)) {
        if (name === "also_optional") continue
        if (wireframeNames.has(name)) {
          ctx.addIssue({ code: "custom", path: ["wireframes", "list"], message: `Duplicate wireframe reference ${name}.` })
        }
        wireframeNames.add(name)
      }
    }

    for (const { section, question } of allQuestions) {
      if (question.wf && !wireframeNames.has(question.wf)) {
        ctx.addIssue({ code: "custom", path: ["sections", sectionIds.indexOf(section.id), "qs", section.qs.indexOf(question), "wf"], message: `Unknown wireframe reference ${question.wf}.` })
      }
    }

    const optionalWireframes = spec.wireframes.list.find((entry) => "also_optional" in entry)?.also_optional
    if (optionalWireframes && !Array.isArray(optionalWireframes)) {
      ctx.addIssue({ code: "custom", path: ["wireframes", "list"], message: "also_optional must be an array of names." })
    }

    for (const tier of SCOPE_TIERS) {
      const tierKey = `T${tier}_`
      if (!Object.keys(spec.scope_tiers).some((key) => key.startsWith(tierKey))) {
        ctx.addIssue({ code: "custom", path: ["scope_tiers"], message: `Missing scope configuration for tier ${tier}.` })
      }
    }
  })

export function parseQuestionnaireSpecification(source: string): QuestionnaireSpecification {
  let parsed: unknown
  try {
    parsed = parse(source)
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const position = error.linePos?.[0]
      const location = position ? ` at line ${position.line}, column ${position.col}` : ""
      throw new Error(`Could not parse requirements_form_spec.yaml${location}: ${error.message}`)
    }
    throw new Error(`Could not parse requirements_form_spec.yaml: ${error instanceof Error ? error.message : String(error)}`)
  }

  const result = questionnaireSpecificationSchema.safeParse(parsed)
  if (!result.success) {
    const details = result.error.issues
      .map(({ path, message }) => `- ${path.length ? path.join(".") : "<root>"}: ${message}`)
      .join("\n")
    throw new Error(`Invalid requirements_form_spec.yaml:\n${details}`)
  }

  return result.data
}
