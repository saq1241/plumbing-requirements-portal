import "server-only"

import { createHmac, createHash, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "portal_admin_session"
const SESSION_DURATION_SECONDS = 60 * 60 * 8

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD || undefined
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest()
  const rightDigest = createHash("sha256").update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function signExpiry(expiry: string, password: string): string {
  return createHmac("sha256", password).update(expiry).digest("hex")
}

/** Verify the configured password and establish a signed, HttpOnly session. */
export async function startAdminSession(password: string): Promise<boolean> {
  const configuredPassword = getAdminPassword()
  if (!configuredPassword || !constantTimeEqual(password, configuredPassword)) {
    return false
  }

  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS)
  const value = `${expiry}.${signExpiry(expiry, configuredPassword)}`

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  })

  return true
}

/** Check the signed session cookie without trusting client-provided identity. */
export async function hasAdminSession(): Promise<boolean> {
  const configuredPassword = getAdminPassword()
  if (!configuredPassword) return false

  const value = (await cookies()).get(COOKIE_NAME)?.value
  if (!value) return false

  const [expiry, signature, ...extraParts] = value.split(".")
  if (!expiry || !signature || extraParts.length > 0 || !/^\d+$/.test(expiry)) {
    return false
  }

  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false

  return constantTimeEqual(signature, signExpiry(expiry, configuredPassword))
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME)
}
