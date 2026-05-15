import { getBonusSettings } from "@/lib/bonus"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const { accrualRate, maxRedemptionRate, isEnabled } = await getBonusSettings()
  return NextResponse.json({ accrualRate, maxRedemptionRate, isEnabled })
}
