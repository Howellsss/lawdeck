// Shape of the Lawdeck database, written to match supabase/migrations (same format as
// Supabase's generated types). Update it in the same pull request as any migration.
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

type KbItemType = "course_material" | "note" | "draft" | "textbook" | "statute" | "rule_of_court" | "case";
type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";
type ReadingStatus = "waiting" | "reading" | "done" | "failed";
type ReadingMethod = "text" | "scan" | "mixed";

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
      kb_items: {
        Row: Timestamps & {
          id: string;
          title: string;
          type: KbItemType;
          course_id: string;
          topic_ids: string[];
          campus: string | null;
          year: number | null;
          source: string | null;
          storage_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          review_status: ReviewStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          law_current_as_of: string | null;
          created_by: string | null;
          reading_status: ReadingStatus;
          reading_method: ReadingMethod | null;
          reading_quality: number | null;
          page_count: number | null;
          read_at: string | null;
          reading_error: string | null;
          indexed_passages: number;
          index_model: string | null;
          indexed_at: string | null;
        };
        Insert: {
          title: string;
          type: KbItemType;
          course_id: string;
          topic_ids?: string[];
          campus?: string | null;
          year?: number | null;
          source?: string | null;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
        };
        Update: {
          review_status?: ReviewStatus;
          review_note?: string | null;
          law_current_as_of?: string | null;
          title?: string;
          type?: KbItemType;
          topic_ids?: string[];
          campus?: string | null;
          year?: number | null;
          source?: string | null;
          reading_status?: ReadingStatus;
          page_count?: number | null;
          reading_error?: string | null;
          // Search index details: written by the marked admin job only (src/server/retrieval/indexJob.ts).
          indexed_passages?: number;
          index_model?: string | null;
          indexed_at?: string | null;
        };
        Relationships: [];
      };
      kb_item_pages: {
        Row: { item_id: string; page: number; text: string; method: "text" | "scan"; created_at: string };
        Insert: { item_id: string; page: number; text: string; method: "text" | "scan" };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "kb_item_pages_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "kb_items";
            referencedColumns: ["id"];
          },
        ];
      };
      kb_passages: {
        Row: Timestamps & {
          id: string;
          item_id: string;
          position: number;
          heading: string | null;
          text: string;
          page_from: number | null;
          page_to: number | null;
          embedding: string | null;
          embedding_model: string | null;
        };
        Insert: {
          item_id: string;
          position: number;
          heading?: string | null;
          text: string;
          page_from?: number | null;
          page_to?: number | null;
        };
        // embedding and embedding_model: the marked admin job only (src/server/retrieval/indexJob.ts).
        Update: { heading?: string | null; text?: string; embedding?: string; embedding_model?: string };
        Relationships: [
          {
            foreignKeyName: "kb_passages_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "kb_items";
            referencedColumns: ["id"];
          },
        ];
      };
      law_changes: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          effective_on: string;
          note: string | null;
          source: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: { course_id: string; title: string; effective_on: string; note?: string | null; source?: string | null };
        Update: { title?: string; effective_on?: string; note?: string | null; source?: string | null };
        Relationships: [];
      };
      search_events: {
        Row: { id: number; owner_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      kb_items_needing_recheck: {
        Row: { item_id: string; change_id: string; change_title: string; effective_on: string };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_reviewer: { Args: Record<string, never>; Returns: boolean };
      search_library: {
        Args: {
          query_text: string;
          course: string;
          query_embedding?: string | null;
          model?: string | null;
          match_count?: number;
          include_pending?: boolean;
        };
        Returns: {
          passage_id: string;
          item_id: string;
          item_title: string;
          heading: string | null;
          text: string;
          page_from: number | null;
          page_to: number | null;
          score: number;
          meaning_rank: number | null;
          words_rank: number | null;
        }[];
      };
      replace_kb_passages: {
        Args: { target_item: string; passages: Json; method: ReadingMethod; quality: number; pages: number };
        Returns: number;
      };
    };
    Enums: {
      app_role: "student" | "reviewer" | "admin";
      conversation_mode: "learn" | "draft";
      message_role: "user" | "assistant";
      kb_item_type: KbItemType;
      review_status: ReviewStatus;
      reading_status: ReadingStatus;
      reading_method: ReadingMethod;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
