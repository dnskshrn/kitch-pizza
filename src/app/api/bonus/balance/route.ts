import { getUserBalance } from '@/lib/bonus'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ balance: 0 })
  const balance = await getUserBalance(profileId)
  return NextResponse.json({ balance })
}
