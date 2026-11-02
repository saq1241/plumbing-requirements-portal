export const SCOPE_TIERS = [1, 2, 3] as const
export type ScopeTier = (typeof SCOPE_TIERS)[number]

export const QUESTIONNAIRE_SECTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "I", "J", "K", "L", "M", "N", "O", "P",
] as const
export type SectionId = (typeof QUESTIONNAIRE_SECTIONS)[number]
/** IDs are validated against section ownership and YAML naming rules at load time. */
export type QuestionId = string

export type QuestionnaireSourceMetadata = {
  doc: string
  purpose: string
  author_role: string
  consumers: readonly string[]
  revision: number
  revision_notes: string
}

export type ScopeTierDetails = {
  desc: string
  includes: readonly string[]
  excludes?: readonly string[]
}

/** YAML plain scalars containing `:` may parse as one-entry mappings. */
export type QuestionnaireTextEntry = string | Readonly<Record<string, string>>

export type QuestionnaireFallback = {
  when_answer: string
  tier: ScopeTier
}

export type ProjectContext = {
  client_business: string
  deliverable: string
  original_idea: readonly QuestionnaireTextEntry[]
  open_scope_question: string
  web_panel: string
}

export type ArchitectureNotes = {
  backend_required: boolean
  reason: string
  app_model: string
  auth: string
  price_logic: string
  payments: string
  gateway_options: readonly string[]
  gateway_notes: string
  notifications: string
  credit_edge_cases: readonly string[]
  order_flow: readonly string[]
  stock_edge: string
  play_store: string
  web_admin: string
}

/** Mirrors one source YAML question without changing its wording or options. */
export type QuestionnaireQuestion = {
  id: QuestionId
  q: string
  /** When omitted, inherit the containing section's tier list. */
  t?: readonly ScopeTier[]
  /** Options are their original YAML strings; multi is true only for multi-select. */
  opts: readonly string[]
  multi?: true
  /** Kept as written in the YAML; some recommendations describe multiple choices. */
  rec?: string
  gating?: true
  fallback?: QuestionnaireFallback
  required?: boolean
  /** Source-provided explanatory helper text, distinct from a client's answer note. */
  note?: string
  wf?: string
}

export type QuestionnaireSection = {
  id: SectionId
  title: string
  /** Optional because the current source YAML does not provide section introductions. */
  intro?: string
  t: readonly ScopeTier[]
  qs: readonly QuestionnaireQuestion[]
}

/** The YAML list also contains one `also_optional` array entry. */
export type WireframeEntry = Readonly<
  Record<string, string | readonly string[]>
>

export type QuestionnaireFormSpec = {
  type: string
  language: string
  length: string
  per_question: readonly string[]
  ux: readonly QuestionnaireTextEntry[]
  wireframe_style: string
  start_screen: {
    title: string
    checklist: readonly string[]
  }
  final_screen: readonly string[]
  summary_format: string
  excluded: string
}

export type QuestionnaireBackendSpec = {
  storage: string
  access: string
  secrets: string
  hosting_free_options: {
    pages: readonly string[]
    storage: readonly string[]
  }
  admin_view: string
  backup: string
  owner_whatsapp_number: string
  developer_stack: string
}

export type QuestionnaireProcess = {
  goal: string
  steps: readonly string[]
  scope_control: string
}

export type PricingGuidance = {
  note: string
  method: readonly string[]
  offer: string
  payment_milestones: readonly string[]
  recurring_separate: readonly string[]
  maintenance: string
  web_admin: string
  main_cost_drivers: readonly string[]
}

/** Typed shape of the complete revised YAML document; question content stays in YAML. */
export type QuestionnaireSpecification = {
  meta: QuestionnaireSourceMetadata
  project: ProjectContext
  architecture_notes: ArchitectureNotes
  scope_tiers: {
    T1_credit_tracker: ScopeTierDetails
    T2_ordering_app: ScopeTierDetails
    T3_full_ecommerce: ScopeTierDetails
    gating: string
  }
  form_spec: QuestionnaireFormSpec
  backend_spec: QuestionnaireBackendSpec
  sections: readonly QuestionnaireSection[]
  wireframes: {
    style: string
    list: readonly WireframeEntry[]
  }
  process: QuestionnaireProcess
  pricing_guidance: PricingGuidance
  tasks_for_ai: readonly string[]
}

export type QuestionnaireTierKey = "T1_credit_tracker" | "T2_ordering_app" | "T3_full_ecommerce"

/** Minimal runtime shape needed by visibility, answer, and submission logic. */
export type QuestionnaireRuntimeSpecification = {
  sections: readonly QuestionnaireSection[]
  scope_tiers: Readonly<Record<QuestionnaireTierKey, unknown>>
  form_spec: Pick<QuestionnaireFormSpec, "summary_format">
}

/** Deliberately excludes internal pricing, architecture, and project-planning data. */
export type QuestionnaireClientSpecification = QuestionnaireRuntimeSpecification & {
  wireframes: QuestionnaireSpecification["wireframes"]
  form_spec: Pick<QuestionnaireFormSpec, "summary_format" | "start_screen">
  backend_spec: Pick<QuestionnaireBackendSpec, "owner_whatsapp_number">
}

/** Tagged values distinguish a selected option from write-in text in JSONB. */
export type QuestionAnswer =
  | { kind: "single"; value: string }
  | { kind: "multiple"; values: string[] }
  | { kind: "text"; value: string }
  | null

export type QuestionnaireResponse = {
  questionId: QuestionId
  answer: QuestionAnswer
  /** Client-authored optional note; separate from a YAML question's helper note. */
  note?: string
}
