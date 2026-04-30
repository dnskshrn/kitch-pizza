import { getStorefrontSession } from "@/lib/storefront-session"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getStorefrontSession()
  if (!session) {
    return NextResponse.json({ profile: null })
  }

  return NextResponse.json({
    profile: {
      profileId: session.profileId,
      phone: session.phone,
    },
  })
}
