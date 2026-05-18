interface BrandJsonLdProps {
  brandSlug: string
}

const BRAND_SCHEMA_DATA: Record<string, object> = {
  'kitch-pizza': {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FoodDelivery'],
    name: 'Kitch!',
    description: 'Livrare pizza în Chișinău. Доставка пиццы по Кишинёву.',
    url: 'https://kitch.md',
    telephone: '+37379700290',
    servesCuisine: ['Pizza', 'Пицца'],
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Chișinău',
      addressCountry: 'MD',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 47.0245,
      longitude: 28.8322,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        opens: '11:00',
        closes: '03:00',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Меню пицц / Meniu pizza',
    },
    areaServed: {
      '@type': 'City',
      name: 'Chișinău',
    },
    offers: {
      '@type': 'Offer',
      description: 'Доставка пиццы по Кишинёву / Livrare pizza în Chișinău',
    },
  },
  'losos': {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FoodDelivery'],
    name: 'LOSOS',
    description: 'Livrare sushi și rulouri în Chișinău. Доставка суши и роллов по Кишинёву.',
    url: 'https://losos.md',
    telephone: '+37379200190',
    servesCuisine: ['Sushi', 'Japanese', 'Суши', 'Японская кухня'],
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Chișinău',
      addressCountry: 'MD',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 47.0245,
      longitude: 28.8322,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        opens: '15:00',
        closes: '03:00',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Меню суши / Meniu sushi',
    },
    areaServed: {
      '@type': 'City',
      name: 'Chișinău',
    },
  },
  'the-spot': {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FoodDelivery'],
    name: 'The Spot',
    description: 'Livrare kebab și shaorma în Chișinău. Доставка кебаба и шаурмы по Кишинёву.',
    url: 'https://thespot.md',
    telephone: '+37379200120',
    servesCuisine: ['Kebab', 'Shawarma', 'Middle Eastern', 'Кебаб', 'Шаурма'],
    priceRange: '$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Chișinău',
      addressCountry: 'MD',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 47.0245,
      longitude: 28.8322,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        opens: '11:00',
        closes: '03:00',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Меню кебаб / Meniu kebab',
    },
    areaServed: {
      '@type': 'City',
      name: 'Chișinău',
    },
  },
}

export function BrandJsonLd({ brandSlug }: BrandJsonLdProps) {
  const schema = BRAND_SCHEMA_DATA[brandSlug]
  if (!schema) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
