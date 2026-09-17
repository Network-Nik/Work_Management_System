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
      approved_staff_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_staff_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          actor_id: string | null
          assignment_id: string
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          assignment_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          assignment_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "in_app_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "in_app_notifications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "work_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "in_app_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          access_status: Database["public"]["Enums"]["staff_access_status"]
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department_id: string | null
          display_name: string | null
          job_title: string | null
          organization_id: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["staff_access_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          job_title?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_status?: Database["public"]["Enums"]["staff_access_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          job_title?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_dept"
            columns: ["department_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "organization_members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_owner_audit: {
        Row: {
          action: Database["public"]["Enums"]["owner_audit_action"]
          actor_id: string | null
          created_at: string
          id: string
          organization_id: string
          target_user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["owner_audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          target_user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["owner_audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_owner_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_owner_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_owner_audit_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_owners: {
        Row: {
          assigned_by: string | null
          created_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_owners_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          access_status: Database["public"]["Enums"]["staff_access_status"]
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          whatsapp_status: Database["public"]["Enums"]["whatsapp_registration_status"]
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["staff_access_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_registration_status"]
        }
        Update: {
          access_status?: Database["public"]["Enums"]["staff_access_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_registration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_assignment_events: {
        Row: {
          actor_id: string | null
          assignment_id: string
          comment: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["assignment_event_type"]
          id: string
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          actor_id?: string | null
          assignment_id: string
          comment?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["assignment_event_type"]
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          actor_id?: string | null
          assignment_id?: string
          comment?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["assignment_event_type"]
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "work_assignment_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "work_assignment_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "work_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      work_assignments: {
        Row: {
          assigned_at: string
          assignee_id: string
          assigner_id: string
          completed_at: string | null
          description: string | null
          established_deadline: string | null
          id: string
          organization_id: string
          reference_id: string | null
          status: Database["public"]["Enums"]["work_assignment_status"]
          target_deadline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assignee_id: string
          assigner_id: string
          completed_at?: string | null
          description?: string | null
          established_deadline?: string | null
          id?: string
          organization_id: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["work_assignment_status"]
          target_deadline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assignee_id?: string
          assigner_id?: string
          completed_at?: string | null
          description?: string | null
          established_deadline?: string | null
          id?: string
          organization_id?: string
          reference_id?: string | null
          status?: Database["public"]["Enums"]["work_assignment_status"]
          target_deadline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "work_assignments_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "work_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_work: {
        Args: { p_established_deadline: string; p_id: string }
        Returns: undefined
      }
      add_organization_owner: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: undefined
      }
      admin_approve_staff_member: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: undefined
      }
      admin_reject_staff_member: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: undefined
      }
      admin_update_member_profile: {
        Args: { p_org_id: string; p_target_user_id: string; p_updates: Json }
        Returns: undefined
      }
      bootstrap_first_admin: {
        Args: { whatsapp_num: string }
        Returns: undefined
      }
      cancel_work: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      complete_work: { Args: { p_id: string }; Returns: undefined }
      decline_work: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      get_org_member_contacts: {
        Args: { p_org_id: string; p_user_ids: string[] }
        Returns: {
          email: string
          user_id: string
          whatsapp_number: string
        }[]
      }
      get_org_staff_profiles: {
        Args: {
          p_access_status: Database["public"]["Enums"]["staff_access_status"]
          p_org_id: string
        }
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
          whatsapp_number: string
        }[]
      }
      has_system_admins: { Args: never; Returns: boolean }
      is_approved_staff_email: { Args: never; Returns: boolean }
      is_manager_or_admin: { Args: never; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_manager: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { p_org_id: string }; Returns: boolean }
      is_staff_admin: { Args: never; Returns: boolean }
      is_staff_manager: { Args: never; Returns: boolean }
      manage_department: {
        Args: {
          p_dept_id?: string
          p_description?: string
          p_is_active?: boolean
          p_name: string
          p_org_id: string
        }
        Returns: string
      }
      override_deadline: {
        Args: { p_id: string; p_new_deadline: string; p_reason: string }
        Returns: undefined
      }
      register_staff_profile: {
        Args: { p_whatsapp_number: string }
        Returns: undefined
      }
      remove_organization_owner: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: undefined
      }
      update_self_profile: {
        Args: { p_display_name: string; p_org_id: string; p_username: string }
        Returns: undefined
      }
      update_staff_role: {
        Args: {
          new_role: Database["public"]["Enums"]["staff_role"]
          target_org_id: string
          target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      assignment_event_type:
        | "created"
        | "accepted"
        | "declined"
        | "cancelled"
        | "completed"
        | "deadline_updated"
        | "details_updated"
      notification_type:
        | "assigned"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled"
        | "deadline_override"
      owner_audit_action: "added" | "removed"
      staff_access_status: "pending" | "approved" | "rejected"
      staff_role: "admin" | "manager" | "employee"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "completed" | "blocked"
      whatsapp_registration_status: "pending" | "verified" | "rejected"
      work_assignment_status:
        | "pending"
        | "active"
        | "completed"
        | "declined"
        | "cancelled"
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
      app_role: ["admin", "manager", "employee"],
      assignment_event_type: [
        "created",
        "accepted",
        "declined",
        "cancelled",
        "completed",
        "deadline_updated",
        "details_updated",
      ],
      notification_type: [
        "assigned",
        "accepted",
        "declined",
        "completed",
        "cancelled",
        "deadline_override",
      ],
      owner_audit_action: ["added", "removed"],
      staff_access_status: ["pending", "approved", "rejected"],
      staff_role: ["admin", "manager", "employee"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "completed", "blocked"],
      whatsapp_registration_status: ["pending", "verified", "rejected"],
      work_assignment_status: [
        "pending",
        "active",
        "completed",
        "declined",
        "cancelled",
      ],
    },
  },
} as const
