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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_display_name: string | null
          author_id: string
          author_role_label: string | null
          category: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          published: boolean
          read_time: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_display_name?: string | null
          author_id: string
          author_role_label?: string | null
          category?: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          read_time?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_display_name?: string | null
          author_id?: string
          author_role_label?: string | null
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          read_time?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_feedback: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          diet_request_id: string
          id: string
          rating: number
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          diet_request_id: string
          id?: string
          rating: number
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          diet_request_id?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_diet_request_id_fkey"
            columns: ["diet_request_id"]
            isOneToOne: false
            referencedRelation: "diet_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_requests: {
        Row: {
          ai_draft: Json | null
          assigned_nutritionist_id: string | null
          client_data: Json | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          nutritionist_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_draft?: Json | null
          assigned_nutritionist_id?: string | null
          client_data?: Json | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          nutritionist_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_draft?: Json | null
          assigned_nutritionist_id?: string | null
          client_data?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          nutritionist_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_analytics: {
        Row: {
          amount: number | null
          client_id: string | null
          code: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          owner_id: string | null
          session_key: string | null
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          code: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          session_key?: string | null
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          code?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          owner_id?: string | null
          session_key?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_code: string | null
          allergies: string | null
          approved: boolean
          avatar_url: string | null
          birth_date: string | null
          clinic_logo_url: string | null
          created_at: string
          deleted_at: string | null
          credits: number
          crn_number: string | null
          full_name: string
          goals: Json | null
          id: string
          onboarding_done: boolean | null
          pix_key: Json | null
          plan_tier: string
          referred_by: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          allergies?: string | null
          approved?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          clinic_logo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          credits?: number
          crn_number?: string | null
          full_name?: string
          goals?: Json | null
          id?: string
          onboarding_done?: boolean | null
          pix_key?: Json | null
          plan_tier?: string
          referred_by?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          allergies?: string | null
          approved?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          clinic_logo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          credits?: number
          crn_number?: string | null
          full_name?: string
          goals?: Json | null
          id?: string
          onboarding_done?: boolean | null
          pix_key?: Json | null
          plan_tier?: string
          referred_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          commission: number
          created_at: string
          id: string
          referred_email: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          commission?: number
          created_at?: string
          id?: string
          referred_email?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          commission?: number
          created_at?: string
          id?: string
          referred_email?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      soft_delete_own_profile: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      request_own_role_transition: {
        Args: { target_role: string; p_crn_number?: string | null }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      admin_set_professional_approval: {
        Args: { target_user_id: string; p_approved: boolean }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      ensure_trial_credits: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      consume_job_credit: {
        Args: { request_id: string }
        Returns: Json
      }
      admin_adjust_credits: {
        Args: { target_user_id: string; delta: number; reason: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      downgrade_own_plan_to_freemium: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      activate_plan_with_internal_balance: {
        Args: { target_tier: string; billing_period?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
