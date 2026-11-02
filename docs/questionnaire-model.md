# Questionnaire domain model

## Canonical source and loader

`requirements_form_spec.yaml` is the content source of truth. The server-only `loadQuestionnaireSpecification()` reads the stable project YAML once at module initialization, validates it, and returns the parsed document. This avoids awaiting filesystem I/O during a rendered route with Next.js Cache Components enabled. The strict Zod schema checks section and question shapes, source order, unique IDs/options, tier values, gating/fallback consistency, recommendation resolution, and wireframe references. It reports YAML parse locations and field paths for validation failures. The parsed model preserves YAML values as parsed; for example, a plain YAML list item containing a colon can be a one-entry mapping, and the T3 scope currently has no `excludes` property.

The YAML defines 16 sections and 86 unique question definitions. Tier resolution currently yields T1 **49**, T2 **78**, and T3 **85** applicable questions. These totals describe questions on each path, not mandatory answers.

## Content and tier model

`lib/questionnaire/types.ts` mirrors all root-level source fields and the complete question, section, form guidance, context, wireframe, process, and pricing shapes. Question content is not duplicated in TypeScript. The loader's schema accepts only source structures the model supports and fails when a new unsupported field is added, so source evolution cannot be silently discarded.

Each question inherits its containing section's `t` list unless it supplies its own `t`, which overrides the section list. `resolveQuestionnaireForTier()` filters questions using those effective lists and preserves source ordering. It omits empty sections. `resolveQuestionnaireFromA1()` presents only the gate section before a tier is chosen.

A1's source-defined `fallback` is `{ when_answer: "Not sure", tier: 2 }`. `resolveTierFromA1()` reads that configuration directly and maps the answer to the existing T2 path. It does not create a fourth tier or hardcode the fallback answer in the resolver. The selected answer remains `Not sure` in state and in the prepared payload, while the resolved tier is 2.

Single-select answers use `{ kind: "single", value }`; multi-select answers use `{ kind: "multiple", values }`; free text uses `{ kind: "text", value }`. Client-entered notes are stored separately from answer values and from YAML helper notes. Suggested answers are returned by `getRecommendedOptions()` as display metadata and are never selected automatically. Helper notes, question recommendations, and wireframe references remain source metadata rather than client answers.

## State, navigation, and progress

`createQuestionnaireState()` initializes the unanswered gate. Answer helpers validate option membership and single/multi answer shape, add or remove multi-select choices, set free text, update or clear client notes, and clear answers. Changing A1 recalculates the effective tier and current section. Answers to questions hidden by a tier change stay in local state so switching back restores them; `getVisibleAnswers()` exposes only answers on the active path.

Navigation helpers expose applicable sections in YAML order, support direct section selection and previous/next movement, and keep movement at the start/end boundary when no adjacent section exists. Progress reports the applicable and answered question counts, unanswered questions, current section position, section count, percentage, and submission readiness. A question is required only when the YAML explicitly supplies `required: true`; no current question does so.

## Submission and persistence boundary

`prepareSubmission()` checks that A1 resolves consistently, validates visible answer values, enforces explicit required flags, and includes only answers/notes from the active tier path. It keeps the original A1 response and resolved tier. The human-readable summary follows `form_spec.summary_format`; the `Qn.` placeholder is numbered by included answer line. YAML helper notes and recommendations are not submitted as client response data. No backend or network request is made by this function.

`QuestionnairePersistenceBoundary` defines draft creation, private-token draft loading, answer saves, and submission without exposing a database client or database row types to UI code. It is an interface only: no adapter, autosave, API, token validation, or persistence behavior has been implemented here. Existing database schema and RLS are unchanged. A future adapter must validate private tokens server-side and enforce the existing security model.

## Wireframes and limitations

The loader preserves all wireframe entries, including `also_optional` as a list, and verifies every question `wf` points to a named entry. The client preview renders the ten named examples as expandable, responsive previews in the portal's purple palette and includes the source disclaimer. The three names in `also_optional` are shown as optional reference ideas because the source has no separate drawing descriptions for them.

The domain layer does not define behavior for fields absent from the YAML, such as conditional visibility based on answers other than A1. In particular, I5a inherits section I visibility and is currently shown even when I5 is answered "Only days"; the YAML has no answer-dependent visibility field. Do not infer or implement a condition until the requirement is confirmed and expressed in the canonical YAML. The domain also does not make answers required based on inference. The source describes autosave/resume and final sharing, while this implementation supplies only the local domain operations, a prepared submission value, and a persistence contract; integration is still future work.
