import 'server-only';
// Public quiz access is owned by the runtime service, never by direct Supabase views.
export { entry as getPublishedQuiz } from '@/lib/services/public-quiz';
