// Keep this checked-in subset aligned with the reviewed migrations. Regenerate the
// complete file with `supabase gen types typescript` after connecting a project.
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row; Insert: Insert; Update: Update; Relationships: [];
};
type View<Row> = { Row: Row; Relationships: [] };

export type CourseRow = {
  id: string; section_id: string | null; title: string; slug: string;
  thumbnail_url: string | null; description: string | null; category: string | null;
  price: number | null; old_price: number | null; badge: string | null;
  teacher_name: string | null; teacher_link: string | null; theme: string;
  sort_order: number; is_published: boolean; status?: string; course_link?: string | null; created_at: string; updated_at: string;
};
export type SectionRow = { id: string; title: string; description: string | null; sort_order: number; is_published: boolean; status: string; created_at: string; updated_at: string };
export type BannerRow = { id: string; title: string; description: string | null; image_url: string | null; button_text: string | null; target_url: string | null; open_new_tab: boolean; sort_order: number; is_published: boolean; status: string; created_at: string; updated_at: string };
export type PublishedQuizRow = { id: string; slug: string; title: string; description: string | null; duration_minutes: number | null; attempt_limit: number | null; open_at: string | null; close_at: string | null; show_score: boolean; show_ranking: boolean; show_correct_answers: boolean; created_at: string; updated_at: string };
export type PublishedQuizFieldRow = { id: string; quiz_id: string; label: string; field_key: string; field_type: string; placeholder: string | null; required: boolean; sort_order: number; options: string[] };
export type PublishedQuestionRow = { id: string; quiz_id: string; question_type: string; content: string; points: number; sort_order: number };
export type PublishedOptionRow = { id: string; question_id: string; content: string; sort_order: number };

export type Database = {
  public: {
    Tables: {
      profiles: Table<{ id: string; display_name: string | null; avatar_url: string | null; status: string; created_at: string; updated_at: string }>;
      admins: Table<{ user_id: string; status: string; created_at: string; updated_at: string }>;
      admin_users: Table<{ user_id: string; created_at: string }>;
      course_sections: Table<SectionRow>;
      courses: Table<CourseRow>;
      banners: Table<BannerRow>;
      quizzes: Table<PublishedQuizRow & { owner_id: string | null; password_hash: string | null; status: string; sort_order: number }>;
      quiz_fields: Table<PublishedQuizFieldRow & { is_identifier:boolean; show_on_leaderboard:boolean; status: string; created_at: string; updated_at: string }>;
      questions: Table<PublishedQuestionRow & { case_insensitive:boolean; status: string; created_at: string; updated_at: string }>;
      question_options: Table<PublishedOptionRow & { is_correct: boolean; status: string; created_at: string; updated_at: string }>;
      short_answer_accepted_answers: Table<{ id: string; question_id: string; answer: string; answer_normalized: string; sort_order: number; status: string; created_at: string; updated_at: string }>;
      attempts: Table<{ id: string; quiz_id: string; participant_data: Record<string, unknown>; participant_data_digest: string | null; session_token_hash: string | null; expires_at: string | null; question_snapshot: Record<string, unknown>; started_at: string; submitted_at: string | null; duration_ms: number | null; correct_count: number | null; wrong_count: number | null; score: number | null; max_score: number | null; status: string; created_at: string; updated_at: string }>;
      answers: Table<{ id: string; attempt_id: string; quiz_id: string; question_id: string; answer_data: Record<string, unknown>; is_correct: boolean | null; points_awarded: number | null; status: string; created_at: string; updated_at: string }>;
      quiz_result_blocks: Table<{ id: string; quiz_id: string; block_type: string; title: string | null; content: string | null; url: string | null; sort_order: number; visibility_rule: Record<string, unknown>; status: string; created_at: string; updated_at: string }>;
      site_settings: Table<{ key: string; value: Record<string, unknown>; is_public: boolean; status: string; created_at: string; updated_at: string }>;
    };
    Views: {
      published_quizzes: View<PublishedQuizRow>;
      published_quiz_fields: View<PublishedQuizFieldRow>;
      published_quiz_questions: View<PublishedQuestionRow>;
      published_question_options: View<PublishedOptionRow>;
    };
    Functions: { admin_dashboard:{Args:Record<string,never>;Returns:string}; admin_site_presentation:{Args:{p_value?:string;p_revision?:string};Returns:string}; admin_results:{Args:{p_quiz:string;p_op:string;p_search?:string;p_page?:number;p_size?:number;p_attempt?:string};Returns:string}; admin_leaderboard_settings:{Args:{p_quiz:string;p_revision:string;p_enabled:boolean;p_keys:string[]};Returns:undefined}; admin_result_document:{Args:{p_id:string};Returns:string}; admin_save_result:{Args:{p_document:string};Returns:number}; quiz_runtime: {Args:{p_op:string;p_payload:string};Returns:string}; is_admin: { Args: Record<string, never>; Returns: boolean }; admin_quiz_document: { Args: {p_id:string}; Returns:string }; admin_save_quiz: {Args:{p_document:string;p_password_hash:string|null;p_remove_password:boolean};Returns:string} };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};




