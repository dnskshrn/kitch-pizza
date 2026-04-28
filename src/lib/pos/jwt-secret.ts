export function getPosJwtSecretKey(): Uint8Array {
  const secret = process.env.POS_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("POS_SESSION_SECRET must be set and at least 32 characters")
  }
  return new TextEncoder().encode(secret)
}
