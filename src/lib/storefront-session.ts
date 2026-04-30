import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const COOKIE = "storefront-session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface StorefrontSession {
  profileId: string
  phone: string
}

function getStorefrontJwtSecretKey(): Uint8Array {
  const secret = process.env.POS_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("POS_SESSION_SECRET must be set and at least 32 characters")
  }

  return new TextEncoder().encode(secret)
}

export async function signStorefrontSession(payload: StorefrontSession) {
  return new SignJWT({
    profileId: payload.profileId,
    phone: payload.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getStorefrontJwtSecretKey())
}

export async function getStorefrontSession(): Promise<StorefrontSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, getStorefrontJwtSecretKey())
    if (
      typeof payload.profileId !== "string" ||
      typeof payload.phone !== "string"
    ) {
      return null
    }

    return {
      profileId: payload.profileId,
      phone: payload.phone,
    }
  } catch {
    return null
  }
}

export async function setStorefrontSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearStorefrontSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
}
