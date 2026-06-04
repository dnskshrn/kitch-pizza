import { createHash } from "crypto"

function collectSortedLeafValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [""]
  }

  if (typeof value !== "object") {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      out.push(...collectSortedLeafValues(item))
    }
    return out
  }

  const obj = value as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const out: string[] = []

  for (const key of sortedKeys) {
    out.push(...collectSortedLeafValues(obj[key]))
  }

  return out
}

export function validateMaibSignature(
  result: Record<string, unknown>,
  signature: string,
  signatureKey: string,
): boolean {
  const values = collectSortedLeafValues(result)
  const payload = `${values.join(":")}:${signatureKey}`
  const hash = createHash("sha256").update(payload, "utf8").digest()
  const computed = hash.toString("base64")
  return computed === signature
}
