import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function normalizeDiversionDigits(input: string): string {
  const noSpace = input.replace(/\s+/g, "")
  let d = noSpace.replace(/\D/g, "")
  if (d.startsWith("373")) d = d.slice(3)
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

function diversionToBrandSlug(diversion: unknown): string | null {
  if (typeof diversion !== "string") return null
  const key = normalizeDiversionDigits(diversion)
  if (!key) return null
  const map: Record<string, string> = {
    "79700290": "kitch-pizza",
    "79200190": "losos",
    "79200120": "the-spot",
  }
  return map[key] ?? null
}

function okResponse() {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text()
    body = Object.fromEntries(new URLSearchParams(text).entries())
  } else {
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return new Response("Bad Request", { status: 400 })
    }
  }

  const expected = process.env.PBX_WEBHOOK_TOKEN
  if (!expected) {
    console.error("PBX_WEBHOOK_TOKEN is not set")
    return new Response("Server misconfiguration", { status: 500 })
  }

  const token = body.crm_token
  if (typeof token !== "string" || token !== expected) {
    return new NextResponse(null, { status: 401 })
  }

  if (body.cmd !== "event") {
    return okResponse()
  }

  const call_id = body.callid ?? body.call_id
  if (typeof call_id !== "string" || !call_id.trim()) {
    return okResponse()
  }

  const event_type = typeof body.type === "string" ? body.type : null
  const caller_phone = typeof body.phone === "string" ? body.phone : null
  const diversion =
    typeof body.diversion === "string" ? body.diversion : null
  const brand_slug = diversionToBrandSlug(body.diversion)
  const updated_at = new Date().toISOString()

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from("incoming_calls").upsert(
    {
      call_id: call_id.trim(),
      event_type,
      caller_phone,
      diversion,
      brand_slug,
      updated_at,
    },
    { onConflict: "call_id" },
  )

  if (error) {
    console.error("[pbx-webhook] incoming_calls upsert", error.message)
    return new Response("Database error", { status: 500 })
  }

  return okResponse()
}
