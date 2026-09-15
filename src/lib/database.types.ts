export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      approved_staff_emails: {
        Row: {
          email: string;
          added_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          added_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          added_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          user_id: string;
          email: string;
          whatsapp_number: string | null;
          whatsapp_status: Database["public"]["Enums"]["whatsapp_registration_status"];
          access_status: Database["public"]["Enums"]["staff_access_status"];
          role: Database["public"]["Enums"]["staff_role"];
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          whatsapp_number?: string | null;
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_registration_status"];
          access_status?: Database["public"]["Enums"]["staff_access_status"];
          role?: Database["public"]["Enums"]["staff_role"];
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string;
          whatsapp_number?: string | null;
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_registration_status"];
          access_status?: Database["public"]["Enums"]["staff_access_status"];
          role?: Database["public"]["Enums"]["staff_role"];
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_profiles_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      work_assignments: {
        Row: {
          id: string;
          title: string;
          reference_id: string | null;
          description: string | null;
          assigner_id: string;
          assignee_id: string;
          status: Database["public"]["Enums"]["work_assignment_status"];
          assigned_at: string;
          target_deadline: string | null;
          established_deadline: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          reference_id?: string | null;
          description?: string | null;
          assigner_id: string;
          assignee_id: string;
          status?: Database["public"]["Enums"]["work_assignment_status"];
          assigned_at?: string;
          target_deadline?: string | null;
          established_deadline?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          reference_id?: string | null;
          description?: string | null;
          assigner_id?: string;
          assignee_id?: string;
          status?: Database["public"]["Enums"]["work_assignment_status"];
          assigned_at?: string;
          target_deadline?: string | null;
          established_deadline?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      in_app_notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          assignment_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          assignment_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          assignment_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_work: {
        Args: { p_id: string; p_established_deadline: string };
        Returns: undefined;
      };
      decline_work: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      complete_work: {
        Args: { p_id: string };
        Returns: undefined;
      };
      cancel_work: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      override_deadline: {
        Args: { p_id: string; p_new_deadline: string; p_reason: string };
        Returns: undefined;
      };
      bootstrap_first_admin: {
        Args: {
          whatsapp_num: string;
        };
        Returns: undefined;
      };
      has_system_admins: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_approved_staff_email: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_staff_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      work_assignment_status: "pending" | "active" | "completed" | "declined" | "cancelled";
      assignment_event_type: "created" | "accepted" | "declined" | "cancelled" | "completed" | "deadline_updated" | "details_updated";
      notification_type: "assigned" | "accepted" | "declined" | "completed" | "cancelled" | "deadline_override";
      staff_access_status: "pending" | "approved" | "rejected";
      staff_role: "admin" | "manager" | "employee";
      whatsapp_registration_status: "pending" | "verified" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

