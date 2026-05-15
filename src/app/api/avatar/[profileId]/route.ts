import { createAvatar } from "@dicebear/core"
import * as thumbs from "@dicebear/thumbs"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: { profileId: string } },
) {
  const avatar = createAvatar(thumbs, {
    seed: params.profileId,
    size: 128,
    backgroundColor: ["ccff00", "ffcc00", "ff6b35", "a8e6cf"],
  })
  const svg = avatar.toString()
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000",
    },
  })
}
