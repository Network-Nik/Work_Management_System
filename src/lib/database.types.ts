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
          is_admin: boolean;
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
          is_admin?: boolean;
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
          is_admin?: boolean;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
      staff_access_status: "pending" | "approved" | "rejected";
      whatsapp_registration_status: "pending" | "verified" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

