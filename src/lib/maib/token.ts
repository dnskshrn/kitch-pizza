import { createServiceSupabaseClient } from "@/lib/supabase/server"

const MAIB_BASE_URL =
  process.env.MAIB_BASE_URL ?? "https://api.maibmerchants.md"

const TOKEN_ROW_ID = 1
const EXPIRY_BUFFER_MS = 60_000

type MaibTokenRow = {
  access_token: string
  refresh_token: string
  expires_at: string
  refresh_expires_at: string
}

type MaibGenerateTokenResult = {
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}

type MaibApiError = { errorMessage?: string }

type MaibGenerateTokenResponse = {
  ok: boolean
  result?: MaibGenerateTokenResult
  errors?: MaibApiError[]
}

async function saveMaibTokens(data: {
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}): Promise<void> {
  const now = Date.now()
  const expiresAt = new Date(now + data.expiresIn * 1000).toISOString()
  const refreshExpiresAt = new Date(
    now + data.refreshExpiresIn * 1000,
  ).toISOString()

  const supabase = createServiceSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- maib_tokens not in generated types yet
  const { error } = await (supabase.from("maib_tokens") as any).upsert(
    {
      id: TOKEN_ROW_ID,
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  )

  if (error) {
    throw new Error(error.message)
  }
}

function isStillValid(isoDate: string): boolean {
  return new Date(isoDate).getTime() > Date.now() + EXPIRY_BUFFER_MS
}

async function fetchMaibTokens(
  body: Record<string, string>,
): Promise<MaibGenerateTokenResult> {
  const res = await fetch(`${MAIB_BASE_URL}/v1/generate-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as MaibGenerateTokenResponse
  if (!json.ok || !json.result) {
    throw new Error(json.errors?.[0]?.errorMessage ?? "MAIB token request failed")
  }

  return json.result
}

export async function getMaibAccessToken(): Promise<string> {
  const supabase = createServiceSupabaseClient()
  const { data: row, error } = await supabase
    .from("maib_tokens")
    .select("access_token, refresh_token, expires_at, refresh_expires_at")
    .eq("id", TOKEN_ROW_ID)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const cached = row as MaibTokenRow | null

  if (cached && isStillValid(cached.expires_at)) {
    return cached.access_token
  }

  if (cached && isStillValid(cached.refresh_expires_at)) {
    const result = await fetchMaibTokens({
      refreshToken: cached.refresh_token,
    })
    await saveMaibTokens(result)
    return result.accessToken
  }

  const projectId = process.env.MAIB_PROJECT_ID
  const projectSecret = process.env.MAIB_PROJECT_SECRET
  if (!projectId || !projectSecret) {
    throw new Error("Missing MAIB_PROJECT_ID or MAIB_PROJECT_SECRET")
  }

  const result = await fetchMaibTokens({ projectId, projectSecret })
  await saveMaibTokens(result)
  return result.accessToken
}
