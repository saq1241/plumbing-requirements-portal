# Application architecture

## Implemented foundation

The project uses Next.js 16 App Router with separate, typed Supabase browser and server factories. The browser factory uses only the public Supabase URL and publishable key. `lib/security/questionnaire-token.ts` contains token generation/hash helpers, and `lib/auth/admin-session.ts` contains a server-side password-session helper. Neither is yet wired into questionnaire or developer routes.

The current questionnaire source is revision 2 in `requirements_form_spec.yaml`. The server-only loader validates and parses all YAML fields; pure domain utilities resolve tiers, manage answer state, navigate sections, calculate progress, and prepare a filtered submission payload. The model contains no duplicated question definitions. It defines 86 questions over sections A–P and applicable counts T1 49, T2 78, T3 85. A1's YAML `fallback` maps “Not sure” to tier 2.

The home page is branded for Qontrac Industries. `/preview` provides a development-only guided flow with section navigation, notes, suggestions, wireframe examples, review, completion, and local copy/share actions. Answers remain in memory in this preview. `/q/[token]` returns a generic unavailable page until token validation and persistence are integrated; it does not reveal whether a token exists. The existing `QuestionnairePersistenceBoundary` remains the integration contract.

## Private questionnaire access (planned)

The client does not register or log in. The server will generate a long random token, put the raw token in the private link, and store only the SHA-256 hash in `questionnaire_submissions.token_hash`. Every load or save must validate the token server-side, check expiry and draft status, and refuse edits after submission. Invalid links should receive a generic response. The browser must not query questionnaire tables directly.

The database has RLS enabled and no anonymous table privileges. Questionnaire operations must use a server-side access mechanism; do not broaden anonymous table privileges. Save answers idempotently by submission and question, include client notes, update `last_saved_at`, and submit through an atomic draft-to-submitted transition. Those APIs, transactions, and autosave behavior are not implemented.

## Developer review (planned)

The planned review area uses one strong server-side password and a signed, expiring, HttpOnly session cookie. It should check authorization in both pages and route handlers. No client account system, Supabase Auth flow, dashboard, or export is implemented. Future review includes submissions, selected tier, answers grouped by YAML section, unanswered/“Not sure” items, notes, and server-generated Excel/PDF/JSON exports.

## Experience requirements

The revised YAML specifies a mobile-first form, one section per screen, progress, suggested answers, optional note fields, expandable grey wireframes, autosave/resume, and a final submit/share flow. The approved visual target is **Enchanted Jewel — Premium Glass**: an atmospheric midnight-plum environment with translucent amethyst and smoky-aubergine panels, emerald selected states, visible ambient lighting, reflective edges, layered shadows, and fluid interactions. Preserve strong contrast, clear hierarchy, large touch targets, and progressive disclosure. This is the approved design target; the implementation may still need refinement and visual verification. **Complexity should live in the technology, not in the experience.** It is not a production client questionnaire yet because private-token reads/writes, autosave, and durable submission remain unimplemented.
