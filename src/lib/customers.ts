import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CustomerAddressInput = {
  label?: string | null
  address: string
  entrance?: string | null
  floor?: string | null
  apartment?: string | null
  intercom?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
}

export type CustomerAddressRow = CustomerAddressInput & {
  id: string
  profile_id: string
  is_default: boolean
  created_at: string
}

export type CustomerProfileRow = {
  id: string
  phone: string
  name: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export type CustomerWithAddresses = {
  profile: CustomerProfileRow
  addresses: CustomerAddressRow[]
}

/** Как в POS: префикс +373, поле без «+» (см. buildPhoneForSave на клиенте). */
export function normalizeCustomerPhone(input: string): string {
  const s = input.replace(/[\s-]/g, "").trim()
  if (!s) return ""
  if (s.startsWith("+")) return s
  return `+373${s}`
}

function phoneHasEnoughDigitsForLookup(normalized: string): boolean {
  const digits = normalized.replace(/\D/g, "")
  return digits.length >= 10
}

function coordsAreValid(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  )
}

function geocodeQueryFromAddressInput(a: CustomerAddressInput): string {
  const main = a.address.trim()
  const extra = [a.entrance, a.floor, a.apartment]
    .map((x) => (x != null ? String(x).trim() : ""))
    .filter(Boolean)
    .join(", ")
  return extra ? `${main}, ${extra}` : main
}

/** Карта уже дала точку — сохраняем; иначе пробуем Nominatim (не бросает наружу). */
async function resolveCoordsForCustomerAddress(
  address: CustomerAddressInput,
): Promise<{ lat: number | null; lng: number | null }> {
  if (coordsAreValid(address.delivery_lat, address.delivery_lng)) {
    return {
      lat: Number(address.delivery_lat),
      lng: Number(address.delivery_lng),
    }
  }
  const q = geocodeQueryFromAddressInput(address)
  if (!q.trim()) return { lat: null, lng: null }
  try {
    const hit = await geocodeAddress(q)
    if (hit) return { lat: hit.lat, lng: hit.lng }
  } catch {
    /* best-effort */
  }
  return { lat: null, lng: null }
}

export async function getCustomerByPhone(
  phone: string,
): Promise<CustomerWithAddresses | null> {
  const normalized = normalizeCustomerPhone(phone)
  if (!normalized || !phoneHasEnoughDigitsForLookup(normalized)) return null

  const supabase = createServiceRoleClient()
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, phone, name, address, created_at, updated_at")
    .eq("phone", normalized)
    .maybeSingle()

  if (pErr || !profile) return null

  const { data: addresses, error: aErr } = await supabase
    .from("customer_addresses")
    .select(
      "id, profile_id, label, address, entrance, floor, apartment, intercom, delivery_lat, delivery_lng, is_default, created_at",
    )
    .eq("profile_id", profile.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (aErr) throw new Error(aErr.message)

  return {
    profile: profile as CustomerProfileRow,
    addresses: (addresses ?? []) as CustomerAddressRow[],
  }
}

export async function saveCustomer(data: {
  phone: string
  name?: string | null
  address?: string | null
}): Promise<CustomerProfileRow> {
  const phone = normalizeCustomerPhone(data.phone)
  if (!phone) throw new Error("phone_required")

  const supabase = createServiceRoleClient()
  const now = new Date().toISOString()
  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(
      {
        phone,
        name: data.name?.trim() || null,
        address: data.address?.trim() || null,
        updated_at: now,
      },
      { onConflict: "phone" },
    )
    .select("id, phone, name, address, created_at, updated_at")
    .single()

  if (error || !profile) throw new Error(error?.message ?? "upsert_failed")

  const row = profile as CustomerProfileRow

  const { count, error: cErr } = await supabase
    .from("customer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", row.id)

  if (cErr) throw new Error(cErr.message)

  if ((count ?? 0) === 0 && data.address?.trim()) {
    await saveCustomerAddress(
      row.id,
      { address: data.address.trim() },
      true,
    )
  }

  return row
}

export async function saveCustomerAddress(
  profileId: string,
  address: CustomerAddressInput,
  setAsDefault?: boolean,
): Promise<CustomerAddressRow> {
  const line = address.address?.trim()
  if (!line) throw new Error("address_required")

  const supabase = createServiceRoleClient()

  const { count, error: cErr } = await supabase
    .from("customer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)

  if (cErr) throw new Error(cErr.message)

  const isFirst = (count ?? 0) === 0
  const makeDefault = isFirst || setAsDefault === true

  if (makeDefault) {
    const { error: uErr } = await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("profile_id", profileId)
    if (uErr) throw new Error(uErr.message)
  }

  const { lat: geoLat, lng: geoLng } =
    await resolveCoordsForCustomerAddress(address)

  const { data: inserted, error: insErr } = await supabase
    .from("customer_addresses")
    .insert({
      profile_id: profileId,
      label: address.label?.trim() ?? null,
      address: line,
      entrance: address.entrance?.trim() || null,
      floor: address.floor?.trim() || null,
      apartment: address.apartment?.trim() || null,
      intercom: address.intercom?.trim() || null,
      delivery_lat: geoLat,
      delivery_lng: geoLng,
      is_default: makeDefault,
    })
    .select(
      "id, profile_id, label, address, entrance, floor, apartment, intercom, delivery_lat, delivery_lng, is_default, created_at",
    )
    .single()

  if (insErr || !inserted) throw new Error(insErr?.message ?? "insert_failed")

  return inserted as CustomerAddressRow
}

export async function setDefaultAddress(
  addressId: string,
  profileId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error: u1 } = await supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("profile_id", profileId)

  if (u1) throw new Error(u1.message)

  const { error: u2 } = await supabase
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("profile_id", profileId)

  if (u2) throw new Error(u2.message)
}

export async function getDefaultAddress(
  profileId: string,
): Promise<CustomerAddressRow | null> {
  const supabase = createServiceRoleClient()

  const { data: def, error: e1 } = await supabase
    .from("customer_addresses")
    .select(
      "id, profile_id, label, address, entrance, floor, apartment, intercom, delivery_lat, delivery_lng, is_default, created_at",
    )
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .maybeSingle()

  if (e1) throw new Error(e1.message)
  if (def) return def as CustomerAddressRow

  const { data: last, error: e2 } = await supabase
    .from("customer_addresses")
    .select(
      "id, profile_id, label, address, entrance, floor, apartment, intercom, delivery_lat, delivery_lng, is_default, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (e2) throw new Error(e2.message)
  return (last as CustomerAddressRow) ?? null
}
