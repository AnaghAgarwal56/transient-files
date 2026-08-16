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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_name: string
          created_at: string
          id: string
          participant_id: string | null
          transfer_id: string
        }
        Insert: {
          action: string
          actor_name?: string
          created_at?: string
          id?: string
          participant_id?: string | null
          transfer_id: string
        }
        Update: {
          action?: string
          actor_name?: string
          created_at?: string
          id?: string
          participant_id?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_confirmations: {
        Row: {
          confirmed: boolean
          confirmed_at: string
          id: string
          participant_id: string
          transfer_id: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string
          id?: string
          participant_id: string
          transfer_id: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string
          id?: string
          participant_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_confirmations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_confirmations_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          filename: string
          id: string
          mime_type: string
          ready: boolean
          size: number
          storage_path: string
          transfer_id: string
          uploaded_at: string
          uploaded_by: string | null
          uploaded_by_name: string
        }
        Insert: {
          filename: string
          id?: string
          mime_type?: string
          ready?: boolean
          size?: number
          storage_path: string
          transfer_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string
        }
        Update: {
          filename?: string
          id?: string
          mime_type?: string
          ready?: boolean
          size?: number
          storage_path?: string
          transfer_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          last_active: string
          revoked: boolean
          role: string
          token_hash: string
          transfer_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          last_active?: string
          revoked?: boolean
          role?: string
          token_hash: string
          transfer_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          last_active?: string
          revoked?: boolean
          role?: string
          token_hash?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          plan_id: string | null
          provider: string
          provider_order_id: string
          provider_payment_id: string | null
          purpose: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          plan_id?: string | null
          provider?: string
          provider_order_id: string
          provider_payment_id?: string | null
          purpose: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          plan_id?: string | null
          provider?: string
          provider_order_id?: string
          provider_payment_id?: string | null
          purpose?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transfer_credits: {
        Row: {
          bytes_total: number
          bytes_used: number
          created_at: string
          id: string
          label: string
          max_duration_minutes: number
          max_participants: number
          paid_with: string
          plan_id: string
          price_paise: number
          status: string
          transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes_total: number
          bytes_used?: number
          created_at?: string
          id?: string
          label: string
          max_duration_minutes?: number
          max_participants?: number
          paid_with?: string
          plan_id: string
          price_paise: number
          status?: string
          transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes_total?: number
          bytes_used?: number
          created_at?: string
          id?: string
          label?: string
          max_duration_minutes?: number
          max_participants?: number
          paid_with?: string
          plan_id?: string
          price_paise?: number
          status?: string
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_credits_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          capacity_bytes: number
          created_at: string
          credit_id: string | null
          delete_permission: string
          deleted_at: string | null
          deletion_at: string | null
          download_permission: string
          expires_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          max_users: number
          name: string | null
          owner_user_id: string | null
          pin_hash: string
          pin_salt: string
          retention_minutes: number
          room_id: string
          status: string
          tier: string
          upload_permission: string
          used_bytes: number
        }
        Insert: {
          capacity_bytes?: number
          created_at?: string
          credit_id?: string | null
          delete_permission?: string
          deleted_at?: string | null
          deletion_at?: string | null
          download_permission?: string
          expires_at: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          max_users?: number
          name?: string | null
          owner_user_id?: string | null
          pin_hash: string
          pin_salt: string
          retention_minutes?: number
          room_id: string
          status?: string
          tier?: string
          upload_permission?: string
          used_bytes?: number
        }
        Update: {
          capacity_bytes?: number
          created_at?: string
          credit_id?: string | null
          delete_permission?: string
          deleted_at?: string | null
          deletion_at?: string | null
          download_permission?: string
          expires_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          max_users?: number
          name?: string | null
          owner_user_id?: string | null
          pin_hash?: string
          pin_salt?: string
          retention_minutes?: number
          room_id?: string
          status?: string
          tier?: string
          upload_permission?: string
          used_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfers_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "transfer_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_paise: number
          balance_after_paise: number
          created_at: string
          description: string
          id: string
          kind: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount_paise: number
          balance_after_paise: number
          created_at?: string
          description?: string
          id?: string
          kind: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount_paise?: number
          balance_after_paise?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_paise: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_paise?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_paise?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_transfer_capacity: {
        Args: { _bytes: number; _transfer_id: string }
        Returns: number
      }
      wallet_credit: {
        Args: {
          _amount_paise: number
          _description: string
          _kind: string
          _reference: string
          _user_id: string
        }
        Returns: number
      }
      wallet_debit: {
        Args: {
          _amount_paise: number
          _description: string
          _reference: string
          _user_id: string
        }
        Returns: number
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
