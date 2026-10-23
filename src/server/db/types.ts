// Shape of the Lawdeck database, written to match supabase/migrations (same format as
// Supabase's generated types). Update it in the same pull request as any migration.
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { created_at: string; updated_at: string };

type KbItemType =
  | "course_material"
  | "note"
  | "draft"
  | "textbook"
  | "statute"
  | "rule_of_court"
  | "case";
type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";
type ReadingStatus = "waiting" | "reading" | "done" | "failed";
type ReadingMethod = "text" | "scan" | "mixed";
type PracticeKind = "mcq" | "scenario" | "flashcards";
type ForumKind = "court" | "registry";
type VersionAuthor = "student" | "ai";
type Reviewed = {
  status: ReviewStatus;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      // Students' private uploads (migration 24). Owners only.
      uploads: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          status: "processing" | "ready" | "failed";
          ocr_confidence: number | null;
          page_count: number | null;
          problem: string | null;
        } & Timestamps;
        Insert: { project_id?: string | null; file_name: string; mime_type: string; size_bytes: number; storage_path: string };
        Update: never;
        Relationships: [];
      };
      upload_pages: {
        Row: { upload_id: string; owner_id: string; page: number; text: string; method: "text" | "scan"; created_at: string };
        Insert: { upload_id: string; page: number; text: string; method: "text" | "scan" };
        Update: never;
        Relationships: [];
      };
      scan_page_usage: {
        Row: { id: string; owner_id: string; pages: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      upload_passages: {
        Row: {
          id: string;
          upload_id: string;
          owner_id: string;
          position: number;
          heading: string | null;
          text: string;
          page_from: number | null;
          page_to: number | null;
          embedding: string | null;
          embedding_model: string | null;
          created_at: string;
        };
        Insert: {
          upload_id: string;
          position: number;
          heading?: string | null;
          text: string;
          page_from?: number | null;
          page_to?: number | null;
          embedding?: string | null;
          embedding_model?: string | null;
        };
        Update: { embedding?: string | null; embedding_model?: string | null };
        Relationships: [];
      };
      // View-only share links (migration 27). Owners only; viewers read through the share functions.
      shares: {
        Row: {
          id: string;
          owner_id: string;
          kind: "document" | "project";
          document_id: string | null;
          project_id: string | null;
          token: string;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: { kind: "document" | "project"; document_id?: string | null; project_id?: string | null };
        Update: { revoked_at?: string | null };
        Relationships: [];
      };
      // Report a problem (migration 28). Students see their own; reviewers see all and resolve them.
      problem_reports: {
        Row: {
          id: string;
          owner_id: string;
          target_kind: "answer" | "document" | "brief" | "practice_item";
          target_id: string;
          category: "wrong_law" | "outdated" | "unclear" | "formatting" | "other";
          note: string | null;
          status: "open" | "resolved";
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          target_kind: "answer" | "document" | "brief" | "practice_item";
          target_id: string;
          category: "wrong_law" | "outdated" | "unclear" | "formatting" | "other";
          note?: string | null;
        };
        Update: { status?: "open" | "resolved" };
        Relationships: [];
      };
      // Takedown requests (migration 28). Reviewers only; anyone submits through submit_takedown().
      takedown_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          material: string;
          reason: string;
          status: "open" | "done";
          done_by: string | null;
          done_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { status?: "open" | "done" };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price_ngn: number | null;
          monthly_message_limit: number | null;
          upload_limit: number | null;
          monthly_scan_page_limit: number | null;
          created_at: string;
        };
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
          upload_notice_accepted_at: string | null;
        };
        Insert: never;
        Update: {
          full_name?: string | null;
          campus?: string | null;
          courses?: string[];
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          course_id: string;
          slug: string;
          name: string;
          position: number;
          created_at: string;
        };
        // Admins only (migration 13). The slug never changes once made.
        Insert: {
          course_id: string;
          slug: string;
          name: string;
          position?: number;
        };
        Update: { name?: string; position?: number };
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
          auto_routed: boolean;
          use_uploads: boolean;
        };
        Insert: {
          project_id?: string | null;
          title?: string;
          mode?: "learn" | "draft";
          course_id?: string | null;
          auto_routed?: boolean;
          use_uploads?: boolean;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          course_id?: string | null;
          use_uploads?: boolean;
        };
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
      message_sources: {
        Row: {
          id: string;
          message_id: string;
          owner_id: string;
          label: number;
          kb_passage_id: string | null;
          item_title: string;
          heading: string | null;
          page_from: number | null;
          page_to: number | null;
          origin: "library" | "upload";
          upload_passage_id: string | null;
          created_at: string;
        };
        Insert: {
          message_id: string;
          label: number;
          kb_passage_id?: string | null;
          origin?: "library" | "upload";
          upload_passage_id?: string | null;
          item_title: string;
          heading?: string | null;
          page_from?: number | null;
          page_to?: number | null;
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
          archive_path: string | null;
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
          // The archived original (Q-03): written once by the reading step (admins); never changed.
          archive_path?: string;
        };
        Relationships: [];
      };
      kb_item_pages: {
        Row: {
          item_id: string;
          page: number;
          text: string;
          method: "text" | "scan";
          created_at: string;
        };
        Insert: {
          item_id: string;
          page: number;
          text: string;
          method: "text" | "scan";
        };
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
        Update: {
          heading?: string | null;
          text?: string;
          embedding?: string;
          embedding_model?: string;
        };
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
        Insert: {
          course_id: string;
          title: string;
          effective_on: string;
          note?: string | null;
          source?: string | null;
        };
        Update: {
          title?: string;
          effective_on?: string;
          note?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      // Case and statute briefs (migration 18). Owners only; never edited.
      briefs: {
        Row: {
          id: string;
          owner_id: string;
          course_id: string | null;
          kind: "case" | "statute";
          name: string;
          sections: Json;
          sources: Json;
          model: string | null;
          created_at: string;
        };
        Insert: {
          course_id?: string | null;
          kind: "case" | "statute";
          name: string;
          sections: Json;
          sources?: Json;
          model?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      // Drafting (migration 21). Students read approved forums and templates; documents are owners' only.
      forums: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: ForumKind;
          state: string | null;
          profile: Json;
        } & Reviewed &
          Timestamps;
        Insert: {
          slug: string;
          name: string;
          kind: ForumKind;
          state?: string | null;
          profile?: Json;
        };
        Update: {
          name?: string;
          kind?: ForumKind;
          state?: string | null;
          profile?: Json;
          status?: ReviewStatus;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          slug: string;
          title: string;
          course_id: string;
          spec: Json;
          rule_source: string | null;
          version: number;
        } & Reviewed &
          Timestamps;
        Insert: {
          slug: string;
          title: string;
          course_id: string;
          spec?: Json;
          rule_source?: string | null;
        };
        Update: {
          title?: string;
          course_id?: string;
          spec?: Json;
          rule_source?: string | null;
          status?: ReviewStatus;
        };
        Relationships: [];
      };
      template_forums: {
        Row: { template_id: string; forum_id: string };
        Insert: { template_id: string; forum_id: string };
        Update: never;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          template_id: string | null;
          template_version: number | null;
          forum_id: string | null;
          title: string;
          current_version_id: string | null;
        } & Timestamps;
        Insert: {
          project_id?: string | null;
          template_id: string;
          forum_id?: string | null;
          title: string;
        };
        Update: {
          title?: string;
          project_id?: string | null;
          current_version_id?: string | null;
        };
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          number: number;
          content: Json;
          created_by: VersionAuthor;
          model: string | null;
          created_at: string;
        };
        Insert: {
          document_id: string;
          content: Json;
          created_by: VersionAuthor;
          model?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      // Practice (migration 17). Owners only; rubrics are for reviewers and admins.
      practice_sets: {
        Row: {
          id: string;
          owner_id: string;
          course_id: string;
          topic_id: string | null;
          kind: PracticeKind;
          title: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          course_id: string;
          topic_id?: string | null;
          kind: PracticeKind;
          title: string;
          model?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      practice_items: {
        Row: {
          id: string;
          set_id: string;
          owner_id: string;
          position: number;
          question: string;
          choices: Json | null;
          correct_choice: number | null;
          answer: string;
          sources: Json;
          known: boolean | null;
          created_at: string;
        };
        Insert: {
          set_id: string;
          position: number;
          question: string;
          choices?: Json | null;
          correct_choice?: number | null;
          answer: string;
          sources?: Json;
        };
        Update: { known?: boolean | null };
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          owner_id: string;
          item_id: string;
          rubric_id: string | null;
          choice: number | null;
          answer_text: string | null;
          score: number | null;
          feedback: Json | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          item_id: string;
          rubric_id?: string | null;
          choice?: number | null;
          answer_text?: string | null;
          score?: number | null;
          feedback?: Json | null;
          model?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      rubrics: {
        Row: Timestamps & {
          id: string;
          course_id: string;
          topic_id: string | null;
          title: string;
          // The exam-style question the guide marks (migration 19).
          question: string | null;
          criteria: Json;
          status: ReviewStatus;
          created_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          course_id: string;
          topic_id?: string | null;
          title: string;
          question?: string | null;
          criteria?: Json;
        };
        Update: {
          title?: string;
          topic_id?: string | null;
          question?: string | null;
          criteria?: Json;
          status?: ReviewStatus;
        };
        Relationships: [];
      };
      eval_runs: {
        Row: {
          id: string;
          prompt_version: string;
          models: string[];
          case_count: number;
          status: "running" | "done" | "failed";
          started_at: string;
          finished_at: string | null;
        };
        // Written by the marked admin job only (jobs/explain-eval.job.ts).
        Insert: {
          prompt_version: string;
          models: string[];
          case_count: number;
          status?: "running" | "done" | "failed";
        };
        Update: {
          status?: "running" | "done" | "failed";
          finished_at?: string | null;
        };
        Relationships: [];
      };
      eval_answers: {
        Row: {
          id: string;
          run_id: string;
          case_id: string;
          case_kind: "question" | "pushback";
          pushback_type:
            | "wrong_statement"
            | "holds_position"
            | "fake_authority"
            | "valid_correction"
            | null;
          topic: string | null;
          level: "simple" | "exam" | null;
          turns: Json;
          question: string;
          must_include: Json;
          expect: string | null;
          model: string;
          answer: string | null;
          // Claude's wording before the citation check (migration 16).
          raw_answer: string | null;
          not_enough: boolean | null;
          removed_authorities: number | null;
          sources: Json;
          grade: Json | null;
          first_text_ms: number | null;
          total_ms: number | null;
          tokens_in: number | null;
          tokens_out: number | null;
          cost_usd: number | null;
          error: string | null;
          created_at: string;
          rating: "approved" | "needs_fix" | null;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        // Written by the marked admin job only; reviewers update rating and review_note.
        Insert: {
          run_id: string;
          case_id: string;
          case_kind: "question" | "pushback";
          pushback_type?:
            | "wrong_statement"
            | "holds_position"
            | "fake_authority"
            | "valid_correction"
            | null;
          topic?: string | null;
          level?: "simple" | "exam" | null;
          turns?: Json;
          question: string;
          must_include?: Json;
          expect?: string | null;
          model: string;
          answer?: string | null;
          raw_answer?: string | null;
          not_enough?: boolean | null;
          removed_authorities?: number | null;
          sources?: Json;
          grade?: Json | null;
          first_text_ms?: number | null;
          total_ms?: number | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          cost_usd?: number | null;
          error?: string | null;
        };
        Update: {
          rating?: "approved" | "needs_fix" | null;
          review_note?: string | null;
        };
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
        Row: {
          item_id: string;
          change_id: string;
          change_title: string;
          effective_on: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_upload_notice: { Args: Record<string, never>; Returns: string };
      delete_my_account: { Args: { confirm: string }; Returns: undefined };
      auth_wait_seconds: { Args: { kind: string; email_hash: string; ip_hash: string }; Returns: number };
      record_auth_attempt: { Args: { kind: string; email_hash: string; ip_hash: string }; Returns: undefined };
      problem_report_context: { Args: { report: string }; Returns: { title: string; body: string }[] };
      submit_takedown: { Args: { name: string; email: string; material: string; reason: string }; Returns: undefined };
      open_share: {
        Args: { share_token: string };
        Returns: { kind: "document" | "project"; title: string | null; document_id: string | null; project_id: string | null; shared_at: string; is_owner: boolean }[];
      };
      shared_document: {
        Args: { share_token: string; document: string };
        Returns: {
          title: string;
          forum_name: string | null;
          forum_slug: string | null;
          forum_profile: Json | null;
          forum_status: "pending" | "approved" | "rejected" | "withdrawn" | null;
          template_spec: Json | null;
          template_status: "pending" | "approved" | "rejected" | "withdrawn" | null;
          content: Json | null;
          updated_at: string;
        }[];
      };
      shared_project_items: {
        Args: { share_token: string };
        Returns: { item_kind: "document" | "chat"; id: string; title: string; updated_at: string }[];
      };
      shared_chat_messages: {
        Args: { share_token: string; chat: string };
        Returns: { role: "user" | "assistant"; content: Json; created_at: string; sources: Json }[];
      };
      share_viewers: {
        Args: { share: string };
        Returns: { viewer_name: string; first_seen_at: string; last_seen_at: string }[];
      };
      upload_notice_accepted: { Args: Record<string, never>; Returns: boolean };
      restart_upload_reading: { Args: { target: string }; Returns: undefined };
      set_upload_page_count: { Args: { target: string; pages: number }; Returns: undefined };
      replace_upload_passages: { Args: { target: string; passages: Json; quality: number; pages: number }; Returns: number };
      finish_upload_reading: { Args: { target: string }; Returns: undefined };
      fail_upload_reading: { Args: { target: string; reason: string }; Returns: undefined };
      scan_pages_left: { Args: Record<string, never>; Returns: number | null };
      record_scan_pages: { Args: { pages: number }; Returns: undefined };
      search_uploads: {
        Args: { query_text: string; query_embedding?: string | null; model?: string | null; match_count?: number };
        Returns: {
          passage_id: string;
          upload_id: string;
          file_name: string;
          heading: string | null;
          text: string;
          page_from: number | null;
          page_to: number | null;
          score: number;
          meaning_rank: number | null;
          words_rank: number | null;
        }[];
      };
      record_download: { Args: { kind: "document_docx" | "study_export" }; Returns: undefined };
      unusual_activity: { Args: { minutes?: number }; Returns: { metric: string; value: number }[] };
      record_ai_usage: {
        Args: {
          kind: string;
          model: string;
          tokens_in: number;
          tokens_out: number;
          cost_usd: number;
          duration_ms: number;
        };
        Returns: undefined;
      };
      question_allowance: {
        Args: Record<string, never>;
        Returns: { used: number; monthly_limit: number; unlimited: boolean }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_reviewer: { Args: Record<string, never>; Returns: boolean };
      source_passage: {
        Args: { source: string };
        Returns: {
          item_title: string;
          heading: string | null;
          text: string | null;
          page_from: number | null;
          page_to: number | null;
          available: boolean;
        }[];
      };
      search_library: {
        Args: {
          query_text: string;
          // null searches every course ("All courses", migration 12).
          course: string | null;
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
      // Approved marking questions and guides, for "Mark my answer" (migration 20).
      marking_questions: {
        Args: { course?: string };
        Returns: {
          id: string;
          title: string;
          question: string;
          course_id: string;
          course_name: string;
          topic_name: string | null;
          total_marks: number;
        }[];
      };
      marking_guide: {
        Args: { rubric: string };
        Returns: {
          id: string;
          title: string;
          question: string;
          criteria: Json;
          course_id: string;
          topic_id: string | null;
        }[];
      };
      // Which case and statute names appear in approved library material (migration 16).
      library_mentions: {
        Args: { statutes: string[]; cases: string[]; course?: string };
        Returns: { kind: "statute" | "case"; phrase: string }[];
      };
      replace_kb_passages: {
        Args: {
          target_item: string;
          passages: Json;
          method: ReadingMethod;
          quality: number;
          pages: number;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: "student" | "reviewer" | "admin";
      conversation_mode: "learn" | "draft";
      message_role: "user" | "assistant";
      kb_item_type: KbItemType;
      practice_kind: PracticeKind;
      upload_status: "processing" | "ready" | "failed";
      forum_kind: ForumKind;
      version_author: VersionAuthor;
      brief_kind: "case" | "statute";
      review_status: ReviewStatus;
      reading_status: ReadingStatus;
      reading_method: ReadingMethod;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
