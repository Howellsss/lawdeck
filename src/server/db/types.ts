// Shape of the Lawdeck database, written to match supabase/migrations (same format as
// Supabase's generated types). Update it in the same pull request as any migration.
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      plans: {
        Row: { id: string; name: string; price_ngn: number | null; monthly_message_limit: number | null; upload_limit: number | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: Timestamps & {
          id: string;
          full_name: string | null;
          campus: string | null;
          role: "student" | "reviewer" | "admin";
          plan_id: string | null;
          courses: string[];
        };
        Insert: never;
        Update: { full_name?: string | null; campus?: string | null; courses?: string[] };
        Relationships: [];
      };
      courses: {
        Row: { id: string; slug: string; name: string; position: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      topics: {
        Row: { id: string; course_id: string; slug: string; name: string; position: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      projects: {
        Row: Timestamps & { id: string; owner_id: string; name: string };
        Insert: { name: string };
        Update: { name?: string };
        Relationships: [];
      };
      conversations: {
        Row: Timestamps & {
          id: string;
          owner_id: string;
          project_id: string | null;
          title: string;
          mode: "learn" | "draft";
          course_id: string | null;
        };
        Insert: { project_id?: string | null; title?: string; mode?: "learn" | "draft"; course_id?: string | null };
        Update: { project_id?: string | null; title?: string; course_id?: string | null };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          owner_id: string;
          role: "user" | "assistant";
          content: Json;
          model: string | null;
          tokens_in: number | null;
          tokens_out: number | null;
          cost_usd: number | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: "user" | "assistant";
          content: Json;
          model?: string | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          cost_usd?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          owner_id: string;
          kind: string;
          model: string | null;
          tokens_in: number | null;
          tokens_out: number | null;
          cost_usd: number | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      app_role: "student" | "reviewer" | "admin";
      conversation_mode: "learn" | "draft";
      message_role: "user" | "assistant";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
