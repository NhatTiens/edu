# Product requirements captured from the conversation

The product is a Vietnamese learning website with a homepage that promotes courses and a separate quiz engine. The homepage should feel modern and student-oriented, with a different composition from the referenced third-party website rather than copying it pixel-for-pixel.

Admin controls homepage banners, course groups, course cards, teacher name and teacher external URL. Teacher links open in a new browser tab. Course content should be editable without source-code changes.

Admin creates quizzes with optional password access and shares a public URL. Participants do not need accounts. After unlocking a quiz, participants fill fields configured by the admin. These fields may include name, Facebook URL, student ID, class, email, number, select, radio, checkbox, textarea and future custom types. Admin can mark fields required, identify which field is a unique participant identifier, and decide which field is displayed on the leaderboard.

Quiz types required in MVP are multiple choice, true/false and short answer. Short answers support multiple accepted values, case normalization and optional future Vietnamese diacritic normalization. Correct answers must remain server-side before submission.

Official duration is calculated from server `started_at` and `submitted_at`, not from the browser timer. The browser timer is presentation only. Submission must be idempotent and prevent duplicate finalization.

Ranking order is higher score first, then shorter duration, then earlier submit time. Leaderboard visibility is configurable. Sensitive participant fields such as Facebook should not be public by default.

After submission, admin controls whether to show score, correct count, rank, duration and answer details. A result page builder supports text, YouTube embed, link, button and image blocks. Blocks can appear immediately after submission, after the quiz closes, or after a configured date/time. YouTube solution videos should play inline.

Admin analytics show participant count, completion rate, average score, average duration and correctness per question. Export of participants to Excel/CSV is a follow-up item.

MVP security requirements include Supabase Auth for admin, Row Level Security, hashed quiz passwords, server-only grading, URL validation, upload validation, rate limiting, protected admin APIs and careful handling of attempt limits. IP addresses must not be the sole identity mechanism.
