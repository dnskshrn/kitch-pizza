/** Cookie активного бренда POS/KDS (совпадает с маской из админских клиентских диалогов). */
export const POS_BRAND_SLUG_COOKIE_NAME = "pos-brand-slug"

const POS_COOKIE_PATH = "/pos"
const POS_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400

export function readPosBrandSlugFromCookie(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)pos-brand-slug=([^;]*)/)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

export function writePosBrandSlugCookie(slug: string): void {
  if (typeof document === "undefined") return
  const trimmed = slug.trim()
  if (!trimmed) return
  const v = encodeURIComponent(trimmed)
  document.cookie = `${POS_BRAND_SLUG_COOKIE_NAME}=${v}; path=${POS_COOKIE_PATH}; max-age=${POS_COOKIE_MAX_AGE_SEC}; SameSite=Lax`
}
