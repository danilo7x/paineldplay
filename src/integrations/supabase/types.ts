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
          severity: string
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
          severity?: string
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
          severity?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          contato: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          cor: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
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
          dia_cobranca: number | null
          id: string
          origem_id: string | null
          project_id: string | null
          recorrencia: string | null
          recorrencia_ate: string | null
          recorrente: boolean
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          dia_cobranca?: number | null
          id?: string
          origem_id?: string | null
          project_id?: string | null
          recorrencia?: string | null
          recorrencia_ate?: string | null
          recorrente?: boolean
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          dia_cobranca?: number | null
          id?: string
          origem_id?: string | null
          project_id?: string | null
          recorrencia?: string | null
          recorrencia_ate?: string | null
          recorrente?: boolean
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lucro_meta: number
          mes: string
          receita_meta: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lucro_meta?: number
          mes: string
          receita_meta?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lucro_meta?: number
          mes?: string
          receita_meta?: number
          updated_at?: string
        }
        Relationships: []
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
      notice_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          notice_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          notice_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          notice_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notice_attachments_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
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
          critico: boolean
          id: string
          mensagem: string
          prioridade: string
          titulo: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          critico?: boolean
          id?: string
          mensagem: string
          prioridade?: string
          titulo: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          critico?: boolean
          id?: string
          mensagem?: string
          prioridade?: string
          titulo?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida_em: string | null
          link: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_decisions: {
        Row: {
          contexto: string | null
          created_at: string
          created_by: string
          data: string
          decisao: string
          id: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          created_by: string
          data?: string
          decisao: string
          id?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          created_by?: string
          data?: string
          decisao?: string
          id?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      partner_events: {
        Row: {
          ata: string | null
          created_at: string
          created_by: string
          descricao: string | null
          fim: string | null
          id: string
          inicio: string
          link: string | null
          local: string | null
          pauta: string | null
          recorrencia: string
          tipo: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ata?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          fim?: string | null
          id?: string
          inicio: string
          link?: string | null
          local?: string | null
          pauta?: string | null
          recorrencia?: string
          tipo?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ata?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          link?: string | null
          local?: string | null
          pauta?: string | null
          recorrencia?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      partner_goals: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          meta_valor: number | null
          periodo: string
          progresso: number
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          meta_valor?: number | null
          periodo: string
          progresso?: number
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          meta_valor?: number | null
          periodo?: string
          progresso?: number
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      partner_leads: {
        Row: {
          client_id: string | null
          contato: string | null
          created_at: string
          created_by: string
          data_lembrete: string | null
          empresa: string | null
          etapa: string
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          proximo_passo: string | null
          updated_at: string
          updated_by: string | null
          valor_estimado: number | null
        }
        Insert: {
          client_id?: string | null
          contato?: string | null
          created_at?: string
          created_by: string
          data_lembrete?: string | null
          empresa?: string | null
          etapa?: string
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          proximo_passo?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number | null
        }
        Update: {
          client_id?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string
          data_lembrete?: string | null
          empresa?: string | null
          etapa?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          proximo_passo?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notes: {
        Row: {
          conteudo: string
          created_at: string
          created_by: string
          id: string
          status: string | null
          tipo: string
          titulo: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conteudo?: string
          created_at?: string
          created_by: string
          id?: string
          status?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      partner_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          descricao: string | null
          due_date: string | null
          id: string
          origem_event_id: string | null
          prioridade: string
          responsavel_ambos: boolean
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          origem_event_id?: string | null
          prioridade?: string
          responsavel_ambos?: boolean
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          origem_event_id?: string | null
          prioridade?: string
          responsavel_ambos?: boolean
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_tasks_origem_event_id_fkey"
            columns: ["origem_event_id"]
            isOneToOne: false
            referencedRelation: "partner_events"
            referencedColumns: ["id"]
          },
        ]
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
          cover_url: string | null
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
          cover_url?: string | null
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
          cover_url?: string | null
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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
          cliente?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      sale_subscriptions: {
        Row: {
          client_id: string | null
          cliente_contato: string | null
          cliente_email: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          data_inicio: string
          dia_cobranca: number
          duracao_meses: number | null
          id: string
          nf_emitida: boolean
          nf_numero: string | null
          observacoes: string | null
          project_id: string
          status: string
          updated_at: string
          valor_inicial: number
          valor_mensal: number
        }
        Insert: {
          client_id?: string | null
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          data_inicio: string
          dia_cobranca: number
          duracao_meses?: number | null
          id?: string
          nf_emitida?: boolean
          nf_numero?: string | null
          observacoes?: string | null
          project_id: string
          status?: string
          updated_at?: string
          valor_inicial?: number
          valor_mensal: number
        }
        Update: {
          client_id?: string | null
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          dia_cobranca?: number
          duracao_meses?: number | null
          id?: string
          nf_emitida?: boolean
          nf_numero?: string | null
          observacoes?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          valor_inicial?: number
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_id: string | null
          cliente_contato: string | null
          cliente_email: string | null
          cliente_nome: string
          competencia: string | null
          created_at: string
          created_by: string | null
          data: string
          id: string
          nf_emitida: boolean
          nf_numero: string | null
          observacoes: string | null
          project_id: string
          status: Database["public"]["Enums"]["sale_status"]
          subscription_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          client_id?: string | null
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome: string
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          nf_emitida?: boolean
          nf_numero?: string | null
          observacoes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["sale_status"]
          subscription_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          client_id?: string | null
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_nome?: string
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          nf_emitida?: boolean
          nf_numero?: string | null
          observacoes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subscription_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "sale_subscriptions"
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
      admin_delete_project: {
        Args: { _project_id: string }
        Returns: undefined
      }
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
      generate_recurrences: { Args: never; Returns: Json }
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
      log_activity:
        | {
            Args: {
              _acao: string
              _details?: Json
              _entity_id: string
              _entity_name: string
              _entity_type: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _acao: string
              _details: Json
              _entity_id: string
              _entity_name: string
              _entity_type: string
              _severity: string
            }
            Returns: undefined
          }
      partner_generate_reminders: { Args: never; Returns: Json }
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
