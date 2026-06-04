import { getBrandBySlug } from "@/brands"

/** Any rating <= 4 = negative */
export function isNegativeFeedback(
  food_rating: number | null,
  service_rating: number | null,
): boolean {
  const ratings = [food_rating, service_rating].filter(
    (r): r is number => r !== null,
  )
  if (ratings.length === 0) return false
  return ratings.some((r) => r <= 4)
}

export function generateFeedbackShortCode(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz"
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes)
    .map((b) => chars[b % 36])
    .join("")
}

function brandHost(brandSlug: string): string {
  return getBrandBySlug(brandSlug).domain ?? "losos.md"
}

function normalizeBrandHost(host: string): string {
  return host.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}

/** Returns the public feedback URL for the given token + brand slug */
export function getFeedbackUrl(token: string, brandSlug: string): string {
  const host = brandHost(brandSlug)
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3000/${brandSlug}/feedback/${token}`
  }
  return `https://${host}/feedback/${token}`
}

export function getFeedbackShortUrl(
  shortCode: string,
  brandSlug: string,
): string {
  const host = normalizeBrandHost(brandHost(brandSlug))
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3000/${brandSlug}/f/${shortCode}`
  }
  return `https://${host}/f/${shortCode}`
}

/** SMS text sent to customer */
export function getFeedbackSmsText(shortCode: string, brandSlug: string): string {
  const url = getFeedbackShortUrl(shortCode, brandSlug)
  return `Va multumim pentru comanda! Va rugam sa ne acordati 30 de secunde pentru o recenzie: ${url}`
}
