import Image from "next/image"

const LOGOS: Record<string, string> = {
  "kitch-pizza": "/kitch-pizza-logo.svg",
  losos: "/Losos_Logo.svg",
  "the-spot": "/the-spot-logo.svg",
}

interface Props {
  slug: string
  name: string
}

export function BrandLogoCell({ slug, name }: Props) {
  const src = LOGOS[slug]
  return src ? (
    <Image
      src={src}
      alt={name}
      width={72}
      height={24}
      className="object-contain"
    />
  ) : (
    <span className="text-sm font-medium">{name}</span>
  )
}
