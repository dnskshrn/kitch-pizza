export type Database = {
  public: {
    Tables: {
      aggregator_settings: {
        Row: {
          id: number
          commission_percent: number
          vat_on_commission_percent: number
          default_prep_minutes: number
          updated_at: string
        }
        Insert: {
          id?: number
          commission_percent?: number
          vat_on_commission_percent?: number
          default_prep_minutes?: number
          updated_at?: string
        }
        Update: {
          id?: number
          commission_percent?: number
          vat_on_commission_percent?: number
          default_prep_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_item_variants: {
        Row: {
          aggregator_price_bani: number | null
        }
        Insert: {
          aggregator_price_bani?: number | null
        }
        Update: {
          aggregator_price_bani?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          aggregator_price_bani: number | null
        }
        Insert: {
          aggregator_price_bani?: number | null
        }
        Update: {
          aggregator_price_bani?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: number
          brand_id: string | null
          operator_id: string | null
          source: string
          user_name: string | null
          user_phone: string | null
          status: string
          delivery_mode: "delivery" | "pickup" | "aggregator"
          delivery_address: string | null
          payment_method: "cash" | "card" | "aggregator_card"
          change_from: number | null
          total: number
          delivery_fee: number
          discount: number
          promo_code: string | null
          scheduled_time: string | null
          comment: string | null
          tg_message_id: string | null
          created_at: string
          updated_at: string
          cancel_reason: string | null
          address_entrance: string | null
          address_floor: string | null
          address_apartment: string | null
          address_intercom: string | null
          aggregator: "glovo" | null
          prep_deadline_at: string | null
          ready_at: string | null
        }
        Insert: {
          id?: string
          order_number?: number
          brand_id?: string | null
          operator_id?: string | null
          source?: string
          user_name?: string | null
          user_phone?: string | null
          status?: string
          delivery_mode?: "delivery" | "pickup" | "aggregator"
          delivery_address?: string | null
          payment_method?: "cash" | "card" | "aggregator_card"
          change_from?: number | null
          total?: number
          delivery_fee?: number
          discount?: number
          promo_code?: string | null
          scheduled_time?: string | null
          comment?: string | null
          tg_message_id?: string | null
          created_at?: string
          updated_at?: string
          cancel_reason?: string | null
          address_entrance?: string | null
          address_floor?: string | null
          address_apartment?: string | null
          address_intercom?: string | null
          aggregator?: "glovo" | null
          prep_deadline_at?: string | null
          ready_at?: string | null
        }
        Update: {
          id?: string
          order_number?: number
          brand_id?: string | null
          operator_id?: string | null
          source?: string
          user_name?: string | null
          user_phone?: string | null
          status?: string
          delivery_mode?: "delivery" | "pickup" | "aggregator"
          delivery_address?: string | null
          payment_method?: "cash" | "card" | "aggregator_card"
          change_from?: number | null
          total?: number
          delivery_fee?: number
          discount?: number
          promo_code?: string | null
          scheduled_time?: string | null
          comment?: string | null
          tg_message_id?: string | null
          created_at?: string
          updated_at?: string
          cancel_reason?: string | null
          address_entrance?: string | null
          address_floor?: string | null
          address_apartment?: string | null
          address_intercom?: string | null
          aggregator?: "glovo" | null
          prep_deadline_at?: string | null
          ready_at?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          discount_type: "percent" | "fixed"
          discount_value: number
          min_order_bani: number | null
          max_uses: number | null
          uses_count: number
          valid_from: string | null
          valid_until: string | null
          is_active: boolean
          description: string | null
          created_at: string
          valid_channels: "own" | "aggregator" | "both"
        }
        Insert: {
          id?: string
          code?: string
          discount_type?: "percent" | "fixed"
          discount_value?: number
          min_order_bani?: number | null
          max_uses?: number | null
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          description?: string | null
          created_at?: string
          valid_channels?: "own" | "aggregator" | "both"
        }
        Update: {
          id?: string
          code?: string
          discount_type?: "percent" | "fixed"
          discount_value?: number
          min_order_bani?: number | null
          max_uses?: number | null
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
          is_active?: boolean
          description?: string | null
          created_at?: string
          valid_channels?: "own" | "aggregator" | "both"
        }
        Relationships: []
      }
      toppings: {
        Row: {
          aggregator_price_bani: number | null
        }
        Insert: {
          aggregator_price_bani?: number | null
        }
        Update: {
          aggregator_price_bani?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
