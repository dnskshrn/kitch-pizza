/**
 * One-time SMS campaign + bonus accrual.
 * Run: npx tsx -r dotenv/config scripts/send-campaign.ts dotenv_config_path=.env.local
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const CAMPAIGN_ID = "e3da841e-eefd-4f7b-b858-238f0a79be15"
const BATCH_SIZE = 10
const DELAY_MS = 1000

type SegmentConfig = {
  min_orders: number
  order_period_days: number
  inactive_days: number
  bonus_amount: number
}

type CampaignRow = {
  id: string
  name: string
  sms_text: string
  segment_config: SegmentConfig
  status: string
}

type Recipient = {
  id: string
  phone: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`Missing env: ${name}`)
  }
  return value.trim()
}

function normalizePhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, "")
  return normalized.startsWith("+") ? normalized : `+${normalized}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function lastActivityAt(
  posterLastOrderAt: string | null,
  lastDoneOrderAt: string | undefined,
): Date | null {
  const poster = posterLastOrderAt ? new Date(posterLastOrderAt) : null
  const done = lastDoneOrderAt ? new Date(lastDoneOrderAt) : null
  if (poster && done) {
    return poster > done ? poster : done
  }
  return poster ?? done ?? null
}

async function fetchLastDoneOrderByProfile(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (profileIds.length === 0) return map

  const CHUNK = 200
  for (let i = 0; i < profileIds.length; i += CHUNK) {
    const slice = profileIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("orders")
      .select("profile_id, created_at")
      .in("profile_id", slice)
      .eq("status", "done")

    if (error) {
      throw new Error(`orders lookup: ${error.message}`)
    }

    for (const row of data ?? []) {
      const pid = row.profile_id as string | null
      const createdAt = row.created_at as string
      if (!pid) continue
      const prev = map.get(pid)
      if (!prev || createdAt > prev) {
        map.set(pid, createdAt)
      }
    }
  }

  return map
}

async function resolveRecipients(
  supabase: SupabaseClient,
  config: SegmentConfig,
): Promise<Recipient[]> {
  const now = Date.now()
  const periodStart = new Date(
    now - config.order_period_days * 24 * 60 * 60 * 1000,
  ).toISOString()
  const inactiveCutoff = new Date(
    now - config.inactive_days * 24 * 60 * 60 * 1000,
  )

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, phone, poster_orders_count, poster_last_order_at")
    .gte("poster_orders_count", config.min_orders)
    .gte("poster_last_order_at", periodStart)

  if (error) {
    throw new Error(`profiles segment: ${error.message}`)
  }

  const candidates = (profiles ?? []).filter(
    (p) => typeof p.phone === "string" && p.phone.trim().length > 0,
  )

  const lastDoneMap = await fetchLastDoneOrderByProfile(
    supabase,
    candidates.map((p) => p.id as string),
  )

  const recipients: Recipient[] = []

  for (const p of candidates) {
    const activity = lastActivityAt(
      p.poster_last_order_at as string | null,
      lastDoneMap.get(p.id as string),
    )
    if (!activity || activity >= inactiveCutoff) continue
    recipients.push({
      id: p.id as string,
      phone: (p.phone as string).trim(),
    })
  }

  return recipients
}

async function getCurrentBalance(
  supabase: SupabaseClient,
  profileId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("bonus_transactions")
    .select("balance_after")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const raw = data?.balance_after
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0
}

async function accrueCampaignBonus(
  supabase: SupabaseClient,
  profileId: string,
  amount: number,
  note: string,
): Promise<void> {
  const currentBalance = await getCurrentBalance(supabase, profileId)
  const { error } = await supabase.from("bonus_transactions").insert({
    profile_id: profileId,
    order_id: null,
    type: "manual_add",
    amount,
    balance_after: currentBalance + amount,
    note,
    created_by: null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function sendSms(phone: string, message: string): Promise<void> {
  const normalized = normalizePhone(phone)
  const smsUrl = new URL("https://api.sms.md/v1/send")
  smsUrl.searchParams.set("from", requireEnv("SMS_MD_SENDER"))
  smsUrl.searchParams.set("to", normalized)
  smsUrl.searchParams.set("message", message)
  smsUrl.searchParams.set("token", requireEnv("SMS_MD_API_KEY"))

  const smsRes = await fetch(smsUrl.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
  })

  if (!smsRes.ok) {
    const body = await smsRes.text().catch(() => "")
    throw new Error(body || `SMS.md HTTP ${smsRes.status}`)
  }
}

async function isRecipientAlreadyProcessed(
  supabase: SupabaseClient,
  campaignId: string,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await (supabase.from("campaign_sends") as any)
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error) {
    throw new Error(`campaign_sends check: ${error.message}`)
  }

  return data != null
}

async function logCampaignSend(
  supabase: SupabaseClient,
  params: {
    campaignId: string
    profileId: string
    phone: string
    status: "sent" | "failed"
    errorMsg?: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await (supabase.from("campaign_sends") as any).insert({
    campaign_id: params.campaignId,
    profile_id: params.profileId,
    phone: params.phone,
    status: params.status,
    sent_at: now,
    ...(params.errorMsg ? { error_msg: params.errorMsg } : {}),
  })

  if (error) {
    console.error(
      `[campaign_sends] ${params.profileId}:`,
      error.message,
    )
  }
}

async function markCampaignFailed(supabase: SupabaseClient): Promise<void> {
  const { error } = await (supabase.from("campaigns") as any)
    .update({ status: "failed" })
    .eq("id", CAMPAIGN_ID)

  if (error) {
    console.error("[campaign] failed status update:", error.message)
  }
}

async function run(): Promise<void> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  requireEnv("SMS_MD_SENDER")
  requireEnv("SMS_MD_API_KEY")

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: campaignRaw, error: campaignError } = await (
    supabase.from("campaigns") as any
  )
    .select("id, name, sms_text, segment_config, status")
    .eq("id", CAMPAIGN_ID)
    .single()

  if (campaignError || !campaignRaw) {
    throw new Error(
      campaignError?.message ?? `Campaign ${CAMPAIGN_ID} not found`,
    )
  }

  const campaign = campaignRaw as CampaignRow
  const segment = campaign.segment_config
  if (
    !segment ||
    typeof segment.min_orders !== "number" ||
    typeof segment.order_period_days !== "number" ||
    typeof segment.inactive_days !== "number" ||
    typeof segment.bonus_amount !== "number"
  ) {
    throw new Error("Invalid campaign.segment_config")
  }

  const bonusAmount = segment.bonus_amount
  if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) {
    throw new Error("Invalid campaign.segment_config.bonus_amount")
  }

  const smsText = campaign.sms_text?.trim()
  if (!smsText) {
    throw new Error("campaign.sms_text is empty")
  }

  const recipients = await resolveRecipients(supabase, segment)
  console.log(`Campaign: ${campaign.name} | Recipients: ${recipients.length}`)

  let sent = 0
  let failed = 0
  let bonusesAccrued = 0

  const batches = chunk(recipients, BATCH_SIZE)

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    let batchSent = 0
    let batchFailed = 0
    const batch = batches[batchIndex]

    for (const recipient of batch) {
      if (
        await isRecipientAlreadyProcessed(
          supabase,
          CAMPAIGN_ID,
          recipient.id,
        )
      ) {
        continue
      }

      try {
        await accrueCampaignBonus(
          supabase,
          recipient.id,
          bonusAmount,
          campaign.name,
        )
        bonusesAccrued += 1
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[bonus] ${recipient.id}:`, msg)
        await logCampaignSend(supabase, {
          campaignId: CAMPAIGN_ID,
          profileId: recipient.id,
          phone: recipient.phone,
          status: "failed",
          errorMsg: msg,
        })
        failed += 1
        batchFailed += 1
        continue
      }

      try {
        await sendSms(recipient.phone, smsText)
        await logCampaignSend(supabase, {
          campaignId: CAMPAIGN_ID,
          profileId: recipient.id,
          phone: recipient.phone,
          status: "sent",
        })
        sent += 1
        batchSent += 1
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[sms] ${recipient.id}:`, msg)
        await logCampaignSend(supabase, {
          campaignId: CAMPAIGN_ID,
          profileId: recipient.id,
          phone: recipient.phone,
          status: "failed",
          errorMsg: msg,
        })
        failed += 1
        batchFailed += 1
      }
    }

    console.log(
      `Batch ${batchIndex + 1}/${batches.length} — sent ${batchSent}, failed ${batchFailed}`,
    )

    if (batchIndex < batches.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await (supabase.from("campaigns") as any)
    .update({
      status: "sent",
      sent_at: now,
      total_recipients: sent,
    })
    .eq("id", CAMPAIGN_ID)

  if (updateError) {
    throw new Error(`campaign update: ${updateError.message}`)
  }

  console.log(
    `Done. Sent: ${sent} | Failed: ${failed} | Bonuses accrued: ${bonusesAccrued}`,
  )
}

run().catch(async (err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err)

  try {
    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await markCampaignFailed(supabase)
  } catch (markErr) {
    console.error(
      "Could not mark campaign failed:",
      markErr instanceof Error ? markErr.message : markErr,
    )
  }

  process.exit(1)
})
