export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      collectors: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          billing_day: number
          billing_start_month: string
          created_at: string
          due_amount: number
          due_date: string
          id: string
          last_payment_amount: number | null
          last_payment_date: string | null
          lat: number
          lng: number
          monthly_bill: number
          name: string
          phone: string
          recurring_enabled: boolean
          zone_id: string | null
        }
        Insert: {
          address?: string
          billing_day?: number
          billing_start_month?: string
          created_at?: string
          due_amount?: number
          due_date?: string
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          lat: number
          lng: number
          monthly_bill?: number
          name: string
          phone?: string
          recurring_enabled?: boolean
          zone_id?: string | null
        }
        Update: {
          address?: string
          billing_day?: number
          billing_start_month?: string
          created_at?: string
          due_amount?: number
          due_date?: string
          id?: string
          last_payment_amount?: number | null
          last_payment_date?: string | null
          lat?: number
          lng?: number
          monthly_bill?: number
          name?: string
          phone?: string
          recurring_enabled?: boolean
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_bills: {
        Row: {
          amount: number
          billing_month: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          legacy_import: boolean
          opening_paid: number
        }
        Insert: {
          amount: number
          billing_month: string
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          legacy_import?: boolean
          opening_paid?: number
        }
        Update: {
          amount?: number
          billing_month?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          legacy_import?: boolean
          opening_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          bill_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bill_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "monthly_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          allocated: boolean
          amount: number
          collection_key: string | null
          collector_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: string
          paid_on: string
          receipt_no: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          allocated?: boolean
          amount: number
          collection_key?: string | null
          collector_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method?: string
          paid_on?: string
          receipt_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          allocated?: boolean
          amount?: number
          collection_key?: string | null
          collector_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: string
          paid_on?: string
          receipt_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          collector_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          collector_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          collector_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          collector_id: string | null
          color: string
          created_at: string
          id: string
          name: string
          polygon: Json
        }
        Insert: {
          collector_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          polygon?: Json
        }
        Update: {
          collector_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          polygon?: Json
        }
        Relationships: [
          {
            foreignKeyName: "zones_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bill_balances: {
        Row: {
          amount: number | null
          billing_month: string | null
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          id: string | null
          opening_paid: number | null
          outstanding: number | null
        }
        Insert: {
          amount?: number | null
          billing_month?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string | null
          opening_paid?: number | null
          outstanding?: never
        }
        Update: {
          amount?: number | null
          billing_month?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string | null
          opening_paid?: number | null
          outstanding?: never
        }
        Relationships: [
          {
            foreignKeyName: "monthly_bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_customer: { Args: { cid: string }; Returns: boolean }
      collect_months: {
        Args: {
          p_allocations: Json
          p_customer: string
          p_date: string
          p_key: string
          p_method: string
          p_receipt: string
        }
        Returns: string
      }
      generate_monthly_bills: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      list_staff_accounts: {
        Args: never
        Returns: {
          collector_id: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      set_staff_role: {
        Args: {
          p_collector?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: undefined
      }
      sync_billing: { Args: never; Returns: number }
      void_collection: {
        Args: { p_payment: string; p_reason: string }
        Returns: undefined
      }
      zone_contains: {
        Args: { latitude: number; longitude: number; poly: Json }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "collector"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "collector"],
    },
  },
} as const
