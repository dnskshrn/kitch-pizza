import { getBonusSettings } from "@/lib/bonus"
import { getAdminSession } from "@/lib/admin-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const s = await getBonusSettings()
    return NextResponse.json({
      isEnabled: s.isEnabled,
      accrualPercent: s.accrualRate * 100,
      maxRedemptionPercent: s.maxRedemptionRate * 100,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
