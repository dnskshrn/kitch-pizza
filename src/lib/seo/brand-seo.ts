export interface BrandSeoConfig {
  title: string
  titleRo: string
  description: string
  descriptionRo: string
  keywords: string[]
  canonicalUrl: string
  siteName: string
  locale: string
  type: string
}

export const BRAND_SEO: Record<string, BrandSeoConfig> = {
  'kitch-pizza': {
    title: 'Kitch! — Доставка пиццы в Кишинёве',
    titleRo: 'Kitch! — Livrare Pizza în Chișinău',
    description: 'Заказать пиццу с доставкой по Кишинёву. Свежая пицца за 35 минут. Работаем с 11:00 до 03:00. Звоните: 079 700 290.',
    descriptionRo: 'Comandă pizza cu livrare în Chișinău. Pizza proaspătă în 35 de minute. Lucrăm de la 11:00 până la 03:00. Sună: 079 700 290.',
    keywords: [
      'доставка пиццы кишинёв', 'пицца кишинёв', 'заказать пиццу кишинёв',
      'pizza chisinau', 'livrare pizza chisinau', 'kitch', 'kitch pizza',
      'доставка еды кишинёв', 'livrare mancare chisinau'
    ],
    canonicalUrl: 'https://kitch.md',
    siteName: 'Kitch!',
    locale: 'ro_MD',
    type: 'website',
  },
  'losos': {
    title: 'LOSOS — Доставка роллов и суши в Кишинёве',
    titleRo: 'LOSOS — Livrare Sushi și Rulouri în Chișinău',
    description: 'Заказать суши и роллы с доставкой по Кишинёву. Свежие ингредиенты, быстрая доставка. Работаем с 15:00 до 03:00. Звоните: 079 200 190.',
    descriptionRo: 'Comandă sushi și rulouri cu livrare în Chișinău. Ingrediente proaspete, livrare rapidă. Lucrăm de la 15:00 până la 03:00. Sună: 079 200 190.',
    keywords: [
      'доставка суши кишинёв', 'роллы кишинёв', 'заказать суши кишинёв',
      'sushi chisinau', 'livrare sushi chisinau', 'rulouri chisinau', 'losos',
      'доставка еды кишинёв', 'livrare mancare chisinau'
    ],
    canonicalUrl: 'https://losos.md',
    siteName: 'LOSOS',
    locale: 'ro_MD',
    type: 'website',
  },
  'the-spot': {
    title: 'The Spot — Доставка кебаба и шаурмы в Кишинёве',
    titleRo: 'The Spot — Livrare Kebab și Shaorma în Chișinău',
    description: 'Заказать кебаб и шаурму с доставкой по Кишинёву. Сочный кебаб за 35 минут. Работаем с 11:00 до 03:00. Звоните: 079 200 120.',
    descriptionRo: 'Comandă kebab și shaorma cu livrare în Chișinău. Kebab suculent în 35 de minute. Lucrăm de la 11:00 până la 03:00. Sună: 079 200 120.',
    keywords: [
      'доставка кебаба кишинёв', 'шаурма кишинёв', 'кебаб кишинёв',
      'kebab chisinau', 'shaorma chisinau', 'livrare kebab chisinau', 'the spot',
      'доставка еды кишинёв', 'livrare mancare chisinau'
    ],
    canonicalUrl: 'https://thespot.md',
    siteName: 'The Spot',
    locale: 'ro_MD',
    type: 'website',
  },
}

export function getBrandSeo(slug: string): BrandSeoConfig {
  return BRAND_SEO[slug] ?? BRAND_SEO['kitch-pizza']
}
