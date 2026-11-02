# Qontrac Industries client portal

## Routes

- `/` is the branded Qontrac Industries introduction and preparation checklist. The interactive preview link is shown only in development.
- `/preview` is a local development-only walkthrough. The route returns not found in production builds. It loads the canonical YAML on the server and passes the parsed specification to the interactive client experience.
- `/q/[token]` currently returns one generic unavailable message for every token. It does not load questions, disclose token validity, or perform database access. This route is a placeholder for the later server-side private-link integration.

## Visual system

The approved visual target is **Enchanted Jewel — Premium Glass**: a midnight-purple atmospheric background, amethyst and smoky-aubergine translucent panels, emerald selected states, silver-lilac highlights, and ambient light visible through the surfaces. Frosting, reflections, dimensional depth, and layered shadows should vary by component rather than making every surface alike. Interactions should feel fluid but restrained. Maintain mobile-first spacing, readable contrast, clear focus states, comfortable touch targets, and reduced-motion support. The current code has an initial glass treatment, but it may need refinement and visual verification; no browser testing is claimed here. Geist is used for interface text, with a limited serif accent on the landing page. The design uses typographic Qontrac branding only; it does not invent a logo or slogan.

## Questionnaire rendering and state

Question content, labels, choices, recommendations, helper notes, tier visibility, fallback configuration, and wireframe references come from `requirements_form_spec.yaml`. The client experience uses the existing domain functions for tier resolution, answer updates, navigation, progress, and submission preparation. It shows one applicable section at a time, preserves answers across section navigation and tier changes in the current page session, and keeps client notes separate from answer values. Suggested options are display-only. The review step exposes unanswered items and supports returning to any applicable section.

Question wireframe references render as expandable, responsive previews in the portal's purple palette with the source disclaimer. The YAML's `also_optional` list is displayed as optional reference ideas; the source does not provide separate drawing descriptions for those items.

## Local preview and persistence boundary

`/preview` is intentionally a non-persistent local preview. It shows a banner explaining that answers live only in browser memory and are cleared on refresh or exit. Its completion step calls the existing pure `prepareSubmission()` domain function and supports copy, text-file download, and native file sharing when available. A WhatsApp action appears only if the source contains a valid configured phone number; the current placeholder is not used as a number.

The existing `QuestionnairePersistenceBoundary` in `lib/questionnaire/repository.ts` remains the contract for a future adapter. No browser code accesses Supabase tables. No autosave, draft creation, token validation, durable submission, or valid private-link creation is implemented in this milestone.

## Security and next integration

The database documentation describes RLS policies limited to admin-authenticated access, while the client flow intentionally has no Supabase Auth session. The Supabase management connection did not permit policy introspection during this implementation. The implementation therefore does not make anonymous database requests, add a service-role client, modify schema/RLS, or claim a private token is valid. A future integration must agree on a server-side access design that preserves RLS and then implement token hashing/lookup, expiry and submitted-state checks, safe draft loading, ordered saves, and an atomic submission operation. Until then, production `/q/[token]` requests receive the generic unavailable response.

## Configuration

The only Supabase environment variable names currently configured are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Their values are not documented here. They are sufficient for the existing public client factories but do not provide the token-scoped database access required for private questionnaire persistence under the current policies.
