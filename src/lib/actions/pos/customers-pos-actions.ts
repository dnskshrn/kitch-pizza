"use server"

import { getUserBalance } from "@/lib/bonus"
import {
  getCustomerByPhone,
  normalizeCustomerPhone,
  saveCustomer,
  saveCustomerAddress,
  type CustomerAddressInput,
  type CustomerAddressRow,
  type CustomerWithAddresses,
} from "@/lib/customers"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { CustomerAddress } from "@/types/database"

function toCustomerAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    address: row.address,
    label: row.label ?? null,
    entrance: row.entrance ?? null,
    floor: row.floor ?? null,
    apartment: row.apartment ?? null,
    intercom: row.intercom ?? null,
    delivery_lat: row.delivery_lat ?? null,
    delivery_lng: row.delivery_lng ?? null,
    is_default: row.is_default,
  }
}

const DEFAULT_MAX_REDEMPTION_RATE = 0.3

async function fetchMaxRedemptionRateFromDb(): Promise<number> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("bonus_settings")
      .select("max_redemption_rate")
      .eq("id", 1)
      .maybeSingle()
    if (error || !data) return DEFAULT_MAX_REDEMPTION_RATE
    const raw = (data as { max_redemption_rate: unknown }).max_redemption_rate
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_REDEMPTION_RATE
  } catch {
    return DEFAULT_MAX_REDEMPTION_RATE
  }
}

export type PosLookupCustomerResult =
  | { ok: false; error: string }
  | {
      ok: true
      customer: CustomerWithAddresses | null
      addresses: CustomerAddress[]
      bonusBalance: number | null
      maxRedemptionRate: number | null
    }

export async function posLookupCustomer(
  phoneRaw: string,
): Promise<PosLookupCustomerResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: "Сессия кассира недействительна" }

  const normalized = normalizeCustomerPhone(phoneRaw)
  if (!normalized || normalized.replace(/\D/g, "").length < 10) {
    return {
      ok: true,
      customer: null,
      addresses: [],
      bonusBalance: null,
      maxRedemptionRate: null,
    }
  }

  const customer = await getCustomerByPhone(phoneRaw)
  if (!customer) {
    return {
      ok: true,
      customer: null,
      addresses: [],
      bonusBalance: null,
      maxRedemptionRate: null,
    }
  }

  const addresses = customer.addresses.map(toCustomerAddress)

  const [bonusBalance, maxRedemptionRate] = await Promise.all([
    getUserBalance(customer.profile.id),
    fetchMaxRedemptionRateFromDb(),
  ])

  return {
    ok: true,
    customer,
    addresses,
    bonusBalance,
    maxRedemptionRate,
  }
}

export async function posSaveCustomer(input: {
  phone: string
  name?: string
  address?: string
}): Promise<
  | { ok: true; profile: CustomerWithAddresses["profile"] }
  | { ok: false; error: string }
> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: "Сессия кассира недействительна" }
  try {
    const profile = await saveCustomer({
      phone: input.phone,
      name: input.name,
      address: input.address,
    })
    return { ok: true, profile }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось сохранить клиента",
    }
  }
}

export async function posSaveCustomerAddress(input: {
  profileId: string
  address: CustomerAddressInput
  setAsDefault?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: "Сессия кассира недействительна" }
  try {
    await saveCustomerAddress(
      input.profileId,
      input.address,
      input.setAsDefault,
    )
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Не удалось сохранить адрес",
    }
  }
}
