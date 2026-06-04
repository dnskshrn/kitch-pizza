import { getMaibAccessToken } from "./token"

const MAIB_BASE_URL =
  process.env.MAIB_BASE_URL ?? "https://api.maibmerchants.md"

type MaibApiError = { errorMessage?: string }

type MaibApiResponse<T> = {
  ok: boolean
  result?: T
  errors?: MaibApiError[]
}

export type MaibCreatePaymentParams = {
  amount: number
  currency: "MDL"
  clientIp: string
  language: "ro" | "en" | "ru"
  description?: string
  clientName?: string
  phone?: string
  orderId: string
  delivery?: number
  items?: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  callbackUrl: string
  okUrl: string
  failUrl: string
}

export type MaibCreatePaymentResult = {
  payId: string
  orderId: string
  payUrl: string
}

export type MaibPaymentInfo = {
  payId: string
  orderId?: string
  status: string
  statusCode?: string
  statusMessage?: string
  amount?: number
  currency?: string
  cardNumber?: string
}

export type MaibRefundResult = {
  payId: string
  orderId?: string
  status: string
  refundAmount?: number
}

async function maibJsonRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const token = await getMaibAccessToken()
  const res = await fetch(`${MAIB_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  const json = (await res.json()) as MaibApiResponse<T>
  if (!json.ok || json.result === undefined) {
    throw new Error(json.errors?.[0]?.errorMessage ?? "MAIB API request failed")
  }

  return json.result
}

export async function createMaibPayment(
  p: MaibCreatePaymentParams,
): Promise<MaibCreatePaymentResult> {
  const body: Record<string, unknown> = {
    amount: p.amount,
    currency: p.currency,
    clientIp: p.clientIp,
    language: p.language,
    orderId: p.orderId,
    callbackUrl: p.callbackUrl,
    okUrl: p.okUrl,
    failUrl: p.failUrl,
  }

  if (p.description) body.description = p.description
  if (p.clientName) body.clientName = p.clientName
  if (p.phone) body.phone = p.phone
  if (p.delivery != null && p.delivery > 0) body.delivery = p.delivery
  if (p.items?.length) body.items = p.items

  return maibJsonRequest<MaibCreatePaymentResult>("/v1/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function getMaibPaymentInfo(payId: string): Promise<MaibPaymentInfo> {
  const token = await getMaibAccessToken()
  const res = await fetch(`${MAIB_BASE_URL}/v1/pay-info/${encodeURIComponent(payId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })

  const json = (await res.json()) as MaibApiResponse<MaibPaymentInfo>
  if (!json.ok || json.result === undefined) {
    throw new Error(json.errors?.[0]?.errorMessage ?? "MAIB API request failed")
  }

  return json.result
}

export async function refundMaibPayment(
  payId: string,
  refundAmount?: number,
): Promise<MaibRefundResult> {
  const body: { payId: string; refundAmount?: number } = { payId }
  if (refundAmount != null) {
    body.refundAmount = refundAmount
  }

  return maibJsonRequest<MaibRefundResult>("/v1/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
