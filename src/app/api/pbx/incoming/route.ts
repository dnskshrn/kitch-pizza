import {
  brandSlugFromPbxBody,
  diversionFieldFromPbxBody,
} from "@/lib/pbx/diversion-brand-slug"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

function textOk(): Response {
  return new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const data: unknown = await req.json()
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }
    return {}
  }
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}

/** Цифры для сопоставления с profiles.phone (молд.: 0… / +373…) */
function normalizePbxPhoneDigits(input: string): string {
  let d = input.replace(/\s+/g, "").replace(/\+/g, "").replace(/\D/g, "")
  if (d.startsWith("373")) d = d.slice(3)
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

function strField(body: Record<string, unknown>, key: string): string | null {
  const v = body[key]
  if (v === null || v === undefined) return null
  if (typeof v === "string") return v
  return String(v)
}

async function insertPbxCall(
  supabase: ReturnType<typeof createServiceRoleClient>,
  row: {
    callid: string | null
    cmd: string
    event_type: string | null
    caller: string | null
    raw_body: Record<string, unknown>
    profile_id: string | null
    brand_slug: string | null
  },
): Promise<void> {
  const { error } = await (supabase.from("pbx_calls") as any).insert({
    callid: row.callid,
    cmd: row.cmd,
    event_type: row.event_type,
    caller: row.caller,
    raw_body: row.raw_body,
    profile_id: row.profile_id,
    brand_slug: row.brand_slug,
  })
  if (error) {
    console.error("[pbx/incoming] pbx_calls insert", error.message)
  }
}

async function findProfileForPbxPhone(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rawPhone: string,
): Promise<{ id: string; name: string | null } | null> {
  const trimmed = rawPhone.trim()
  if (!trimmed) return null

  const norm = normalizePbxPhoneDigits(trimmed)
  const candidates = new Set<string>([trimmed])
  if (norm) {
    candidates.add(norm)
    candidates.add(`+373${norm}`)
    candidates.add(`373${norm}`)
    candidates.add(`0${norm}`)
  }

  try {
    const { data: exactRows, error: exactErr } = await supabase
      .from("profiles")
      .select("id, name, phone")
      .in("phone", [...candidates])
      .limit(1)

    if (exactErr) {
      console.error("[pbx/incoming] profiles exact lookup", exactErr.message)
    } else if (exactRows?.length) {
      const r = exactRows[0] as { id: string; name: string | null }
      return { id: r.id, name: r.name }
    }

    if (norm.length < 8) return null
    const last8 = norm.slice(-8)

    const { data: fuzzy, error: fuzzyErr } = await supabase
      .from("profiles")
      .select("id, name, phone")
      .ilike("phone", `%${last8}`)
      .limit(80)

    if (fuzzyErr) {
      console.error("[pbx/incoming] profiles suffix fuzzy", fuzzyErr.message)
      return null
    }

    const match = (fuzzy ?? []).find((row) => {
      const p = row as { phone: string | null }
      if (!p.phone?.trim()) return false
      return normalizePbxPhoneDigits(p.phone).slice(-8) === last8
    }) as { id: string; name: string | null } | undefined

    return match ? { id: match.id, name: match.name } : null
  } catch (e) {
    console.error("[pbx/incoming] findProfileForPbxPhone", e)
    return null
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await parseBody(req)
  } catch (e) {
    console.error("[pbx/incoming] parse body", e)
    return textOk()
  }

  const expected = process.env.PBX_WEBHOOK_TOKEN
  const token = strField(body, "crm_token")
  if (!expected || token !== expected) {
    return Response.json({ error: "Invalid token" }, { status: 401 })
  }

  const cmdRaw = strField(body, "cmd") ?? ""
  if (cmdRaw !== "contact" && cmdRaw !== "event" && cmdRaw !== "history") {
    return Response.json({ error: "Unknown cmd" }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()

    if (cmdRaw === "contact") {
      const phoneRaw = strField(body, "phone") ?? ""
      const callid = strField(body, "callid")

      const brand_slug = brandSlugFromPbxBody(body)
      if (!brand_slug && !diversionFieldFromPbxBody(body)) {
        console.error(
          "[pbx/incoming] contact: нет diversion/called/to, ключи:",
          Object.keys(body),
        )
      } else if (!brand_slug && diversionFieldFromPbxBody(body)) {
        console.error(
          "[pbx/incoming] contact: diversion не сопоставлен с брендом, raw_body:",
          JSON.stringify(body),
        )
      }

      let profile: { id: string; name: string | null } | null = null
      try {
        profile = await findProfileForPbxPhone(supabase, phoneRaw)
      } catch (e) {
        console.error("[pbx/incoming] contact profile lookup", e)
      }

      await insertPbxCall(supabase, {
        callid,
        cmd: "contact",
        event_type: null,
        caller: phoneRaw || null,
        raw_body: body,
        profile_id: profile?.id ?? null,
        brand_slug,
      })

      const displayPhone = phoneRaw.trim() || phoneRaw
      const contactName =
        profile?.name?.trim() ||
        (displayPhone ? displayPhone : "—")

      return Response.json({
        contact_name: contactName,
        responsible: "pos",
      })
    }

    if (cmdRaw === "event") {
      const brand_slug = brandSlugFromPbxBody(body)
      if (!brand_slug && !diversionFieldFromPbxBody(body)) {
        console.error(
          "[pbx/incoming] event: нет diversion/called/to, ключи:",
          Object.keys(body),
        )
      } else if (!brand_slug && diversionFieldFromPbxBody(body)) {
        console.error(
          "[pbx/incoming] event: diversion не сопоставлен с брендом, raw_body:",
          JSON.stringify(body),
        )
      }

      await insertPbxCall(supabase, {
        callid: strField(body, "callid"),
        cmd: "event",
        event_type: strField(body, "type"),
        caller: strField(body, "phone"),
        raw_body: body,
        profile_id: null,
        brand_slug,
      })
      return textOk()
    }

    await insertPbxCall(supabase, {
      callid: strField(body, "callid"),
      cmd: "history",
      event_type: null,
      caller: strField(body, "phone"),
      raw_body: body,
      profile_id: null,
      brand_slug: null,
    })
    return textOk()
  } catch (e) {
    console.error("[pbx/incoming] handler", e)
    return textOk()
  }
}
