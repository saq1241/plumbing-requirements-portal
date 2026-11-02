# Database schema

## Source and changes

This inventory follows the verified schema summary supplied for project `elximumqrqiyixiyycgn` (PostgreSQL 17, `ap-south-1`). No migrations or remote database changes were made. The generated TypeScript representation is in `lib/supabase/database.types.ts`.

The final project audit could not independently re-read the live schema or policies: the connected Supabase management tools returned a permission error for table listing and read-only policy queries. Treat this file as the previously supplied verified summary until someone with project access confirms the live state.

## `public.questionnaire_submissions`

| Column | PostgreSQL type | Nullable | Insert default |
|---|---|---:|---|
| `id` | uuid | No | `gen_random_uuid()` |
| `token_hash` | text | No | None |
| `status` | text | No | `'draft'` |
| `selected_tier` | smallint | Yes | None |
| `created_at` | timestamptz | No | `now()` |
| `updated_at` | timestamptz | No | `now()` |
| `last_saved_at` | timestamptz | No | `now()` |
| `submitted_at` | timestamptz | Yes | None |
| `expires_at` | timestamptz | Yes | None |

Constraints: primary key on `id`; unique `token_hash`; `token_hash` must be 64 lowercase hexadecimal characters; `status` is `draft` or `submitted`; `selected_tier`, when set, is 1–3.

## `public.questionnaire_answers`

| Column | PostgreSQL type | Nullable | Insert default |
|---|---|---:|---|
| `id` | uuid | No | `gen_random_uuid()` |
| `submission_id` | uuid | No | None |
| `question_id` | text | No | None |
| `answer` | jsonb | No | JSON `null` |
| `note` | text | Yes | None |
| `updated_at` | timestamptz | No | `now()` |

Constraints: primary key on `id`; `submission_id` references `questionnaire_submissions.id` with cascading delete; `question_id` length 2–12; unique `(submission_id, question_id)`.

## Existing security and database infrastructure

- RLS is enabled on both tables.
- Each table has an authenticated admin-only `FOR ALL` policy. It checks the trusted `app_metadata.role = 'admin'` claim in both `USING` and `WITH CHECK`.
- Anonymous users have no direct table privileges. `authenticated` has CRUD grants subject to RLS; `service_role` has required database privileges.
- Both tables have `BEFORE UPDATE` triggers invoking `set_updated_at()`.
- Indexes exist. Their names and exact definitions were not included in the supplied verified summary.
- The security advisor reported zero security lints.

No policy, trigger, index, or table definition was changed. Future anonymous client questionnaire access must be mediated server-side; do not grant direct anonymous table access.
