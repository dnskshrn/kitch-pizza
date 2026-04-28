import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getBrand } from './get-brand'

export async function getBrandId(): Promise<string> {
  const brand = await getBrand()
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', brand.slug)
    .single()
  if (!data) throw new Error(`Brand not found: ${brand.slug}`)
  return data.id
}
