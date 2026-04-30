import { NextResponse } from "next/server"
import { clearStorefrontSession } from "@/lib/storefront-session"

export async function POST() {
  await clearStorefrontSession()
  return NextResponse.json({ success: true })
}
