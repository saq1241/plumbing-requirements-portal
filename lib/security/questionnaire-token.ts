import "server-only"

import { createHash, randomBytes } from "node:crypto"

const TOKEN_BYTES = 32

/** Generate a URL-safe bearer token. Store only its hash, never the raw token. */
export function generateQuestionnaireToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url")
}

/** Hash a raw questionnaire token for lookup in the database. */
export function hashQuestionnaireToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
