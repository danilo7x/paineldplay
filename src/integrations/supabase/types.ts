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
      activity_logs: {
        Row: {
          acao: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          acao: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          acao?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          project_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          id?: string
          project_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          project_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          mensagem: string
          titulo: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          mensagem: string
          titulo: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          titulo?: string
        }
        Relationships: []
      }
      personal_files: {
        Row: {
          created_at: string
          descricao: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          owner_id: string
          size: number | null
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          owner_id: string
          size?: number | null
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          size?: number | null
          titulo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          bio: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_credentials: {
        Row: {
          created_at: string
          id: string
          login: string | null
          nome_acesso: string
          notas: string | null
          project_id: string
          senha: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          login?: string | null
          nome_acesso: string
          notas?: string | null
          project_id: string
          senha?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          login?: string | null
          nome_acesso?: string
          notas?: string | null
          project_id?: string
          senha?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_credentials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notes: {
        Row: {
          autor_id: string | null
          conteudo: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          autor_id?: string | null
          conteudo: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_steps: {
        Row: {
          autor_id: string | null
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          project_id: string
          status: Database["public"]["Enums"]["project_step_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          project_id: string
          status?: Database["public"]["Enums"]["project_step_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          project_id?: string
          status?: Database["public"]["Enums"]["project_step_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cliente: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      rani_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rani_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "rani_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      rani_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_attachments: {
        Row: {
          created_at: string
          id: string
          mime: string | null
          nome: string
          path: string
          sale_id: string
          size: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime?: string | null
          nome: string
          path: string
          sale_id: string
          size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime?: string | null
          nome?: string
          path?: string
          sale_id?: string
          size?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_attachments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cliente_contato: string | null
          cliente_email: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          observacoes: string | null
          project_id: string
          status: Database["public"]["Enums"]["sale_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          os: string | null
          session_key: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string | null
          session_key: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          os?: string | null
          session_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_ativo: {
        Args: { _ativo: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _acao: string
          _details?: Json
          _entity_id: string
          _entity_name: string
          _entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "contador"
      project_status:
        | "em_desenvolvimento"
        | "em_manutencao"
        | "concluido"
        | "pausado"
      project_step_status: "pendente" | "em_andamento" | "concluido"
      sale_status: "pendente" | "pago" | "cancelado"
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
    Enums: {
      app_role: ["admin", "staff", "contador"],
      project_status: [
        "em_desenvolvimento",
        "em_manutencao",
        "concluido",
        "pausado",
      ],
      project_step_status: ["pendente", "em_andamento", "concluido"],
      sale_status: ["pendente", "pago", "cancelado"],
    },
  },
} as const
