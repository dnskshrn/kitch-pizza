import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { BRAND_SEO } from '@/lib/seo/brand-seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const brandSlug = headersList.get('x-brand-slug') ?? 'kitch-pizza'
  const seo = BRAND_SEO[brandSlug]
  if (!seo) return []

  const baseUrl = seo.canonicalUrl

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  return staticRoutes
}
