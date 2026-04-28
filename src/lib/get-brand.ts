import { headers } from 'next/headers'
import type { BrandConfig } from '@/brands'
import { getBrandBySlug } from '@/brands'

export async function getBrand(): Promise<BrandConfig> {
  const headersList = await headers()
  const slug = headersList.get('x-brand-slug') ?? 'kitch-pizza'
  return getBrandBySlug(slug)
}
