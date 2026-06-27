import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type ExpireBonusLotsResult = {
  profiles_affected: number
  total_expired: number
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const auth = req.headers.get("authorization")
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.rpc("expire_bonus_lots")

  if (error) {
    console.error("[expire-bonuses] rpc error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const row = (Array.isArray(data) ? data[0] : data) as ExpireBonusLotsResult | null

  return NextResponse.json({
    ok: true,
    profilesAffected: Number(row?.profiles_affected ?? 0),
    totalExpired: Number(row?.total_expired ?? 0),
  })
}
