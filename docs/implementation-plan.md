# Implementation plan

Use `requirements_form_spec.yaml` (revision 2) as the source of truth. It defines 86 questions in sections A–P, with expected applicable counts of T1 49, T2 78, and T3 85. Read A1's structured `fallback` from YAML: “Not sure” resolves to tier 2 and should be flagged for the call.

1. **Visual design foundation:** refine and verify the mobile-first **Enchanted Jewel — Premium Glass** target: midnight-plum atmosphere, translucent amethyst and smoky-aubergine surfaces, emerald selected states, visible ambient lighting, reflective edges, layered shadows, readable type, touch targets, and fluid motion. Initial glass styling exists; visual refinement and verification remain open.
2. **Welcome screen:** build the “Please keep ready” checklist from the source.
3. **Section flow:** render all sections in YAML order, with progress based on visible questions.
4. **Tier branching:** use A1 to choose T1/T2/T3; resolve its YAML `fallback` for “Not sure”, then apply that tier's section/question `t` rules and flag for clarification. Do not add a fourth tier.
5. **Question controls:** render single/multi-select options, source recommendations, exact “Not sure” options, client note fields, and source helper notes.
6. **Wireframes:** render the ten named examples and optional wireframe references in the source, including the sketch disclaimer.
7. **Autosave and resume:** implement server-side token validation, draft loading, idempotent answer/note saves, and return through the same link.
8. **Submission:** validate visible answers according to rules agreed from the YAML, atomically mark submitted, prevent further edits, and implement the confirmation/share fallback.
9. **Developer review:** protect the page and handlers with the existing password-session foundation; show submissions, answers, notes, uncertainty, unanswered items, and tier.
10. **Exports and release:** implement Excel/PDF/JSON, then verify branching, autosave races, token handling, review access, sharing, and deployment.

Implemented: Qontrac landing and preparation screens, development-only interactive questionnaire preview, all YAML-driven tier/section/question rendering, A1 fallback, option and write-in controls, client notes, recommendations, progress/navigation, example wireframes, review, local submission preparation, copy/share/file actions, and generic private-link unavailable handling.

Still planned: token validation backed by durable server-side persistence, draft loading and resume, autosave, durable submit/status transitions, developer review, and exports. These require a security-approved server-side database access path; the current database policies require admin-authenticated access and the client-facing flow has no Supabase Auth identity. Do not solve this by anonymous table writes, service-role exposure, or weakening RLS.
