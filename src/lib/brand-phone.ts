import { getBrandBySlug } from "@/brands"

export function getBrandPhone(brandSlug: string): string {
  return getBrandBySlug(brandSlug).phone
}

export function getBrandPhoneHref(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, "")

  if (trimmed.startsWith("+")) {
    return `tel:+${digits}`
  }

  if (digits.startsWith("0") && digits.length === 9) {
    return `tel:+373${digits.slice(1)}`
  }

  return `tel:${digits}`
}

export function getBrandCallLabel(phone: string, lang: "RU" | "RO"): string {
  return lang === "RO" ? `Sună la ${phone}` : `Позвонить ${phone}`
}
