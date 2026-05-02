export type BrandConfig = {
  slug: string
  name: string
  domain: string // production domain
  devDomain?: string // e.g. 'localhost:3000'
  logo: string // path in /public
  phone: string
  hours: string
  cartKey: string // localStorage key for cart
  deliveryKey: string // localStorage key for delivery
  colors: {
    accent: string
    accentBg: string
    cartPill: string
    activeDot: string
  }
}

export const brands: BrandConfig[] = [
  {
    slug: 'kitch-pizza',
    name: 'Kitch! Pizza',
    domain: 'kitch-pizza.md',
    devDomain: 'localhost:3000',
    logo: '/kitch-pizza-logo.svg',
    phone: '079 700 290',
    hours: '11:00 – 23:00',
    cartKey: 'kitch-pizza-cart',
    deliveryKey: 'kitch-pizza-delivery',
    colors: {
      accent: '#5F7600',
      accentBg: '#ECFFA1',
      cartPill: '#ccff00',
      activeDot: '#8DC63F',
    },
  },
  {
    slug: 'losos',
    name: 'LOSOS',
    domain: 'losos.md',
    devDomain: 'www.losos.md',
    logo: '/Losos_Logo.svg',
    phone: '079 200 190',
    hours: '11:00 – 23:00', // TODO
    cartKey: 'losos-cart',
    deliveryKey: 'losos-delivery',
    colors: {
      accent: '#f25130',
      accentBg: '#ffe2dc',
      cartPill: '#ff6b5f',
      activeDot: '#ff6b5f',
    },
  },
  {
    slug: 'the-spot',
    name: 'The Spot',
    domain: 'thespot.md',
    devDomain: '192.168.50.137',
    logo: '/the-spot-logo.svg',
    phone: '079 200 120',
    hours: '11:00 – 23:00', // TODO
    cartKey: 'kitch-pizza-cart', // TODO
    deliveryKey: 'kitch-pizza-delivery', // TODO
    colors: {
      accent: '#f25130',
      accentBg: '#ffebe7',
      cartPill: '#f25130',
      activeDot: '#f25130',
    },
  },
]

export function getBrandByHost(host: string): BrandConfig {
  const hostname = (host.split(":")[0] ?? host).replace(/^www\./, '')
  const brand = brands.find(
    (b) => b.domain === hostname || b.devDomain === hostname
  )
  return brand ?? brands[0] // fallback to first brand
}

/** Привести slug из БД к каноническому виду из `brands` (расхождения в данных / старые записи). */
export function normalizePosBrandSlug(slug: string): string {
  const t = slug.trim().toLowerCase()
  if (!t) return ""
  const aliases: Record<string, string> = {
    thespot: "the-spot",
    "the_spot": "the-spot",
    "the spot": "the-spot",
  }
  return aliases[t] ?? slug.trim()
}

export function getBrandBySlug(slug: string): BrandConfig {
  const key = slug.trim()
  if (!key) return brands[0]
  const normalized = normalizePosBrandSlug(key)
  return brands.find((b) => b.slug === normalized) ?? brands[0]
}
