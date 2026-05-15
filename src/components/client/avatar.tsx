"use client"

interface AvatarProps {
  profileId: string
  size?: number
}

export function Avatar({ profileId, size = 32 }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic SVG from `/api/avatar`, not suitable for next/image
    <img
      src={`/api/avatar/${encodeURIComponent(profileId)}`}
      width={size}
      height={size}
      alt="avatar"
      style={{ borderRadius: "50%", display: "block" }}
    />
  )
}
