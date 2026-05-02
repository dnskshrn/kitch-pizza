export type Database = {
  public: {
    Tables: {
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
          delivery_mode: string
          delivery_address: string | null
          payment_method: string
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
          delivery_mode?: string
          delivery_address?: string | null
          payment_method?: string
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
          delivery_mode?: string
          delivery_address?: string | null
          payment_method?: string
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
