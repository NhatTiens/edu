# Project map

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage with hero, categories, course sections and teacher external links |
| `/search` | Course search result UI |
| `/q/[slug]` | Quiz access/password screen |
| `/q/[slug]/info` | Dynamic participant information form preview |
| `/q/[slug]/instructions` | Optional pre-test instructions |
| `/q/[slug]/attempt/[attemptId]` | Test workspace, timer, question navigator |
| `/q/[slug]/result/[attemptId]` | Score, rank, completion time, YouTube solution and links |
| `/q/[slug]/leaderboard` | Public leaderboard |

## Admin routes

| Route | Purpose |
| --- | --- |
| `/admin/login` | Admin sign-in |
| `/admin` | Dashboard |
| `/admin/banners` | Homepage banner CMS |
| `/admin/banners/new` | Banner editor |
| `/admin/course-sections` | Homepage course group CMS |
| `/admin/courses` | Course list |
| `/admin/courses/new` | Course editor |
| `/admin/quizzes` | Quiz list |
| `/admin/quizzes/new` | New quiz wizard start |
| `/admin/quizzes/[id]` | Quiz general information |
| `/admin/quizzes/[id]/fields` | Participant custom input builder |
| `/admin/quizzes/[id]/questions` | Question builder |
| `/admin/quizzes/[id]/settings` | Access, timing, attempts and randomization |
| `/admin/quizzes/[id]/participants` | Attempts list |
| `/admin/quizzes/[id]/participants/[attemptId]` | Attempt detail |
| `/admin/quizzes/[id]/leaderboard` | Leaderboard configuration and preview |
| `/admin/quizzes/[id]/analytics` | Quiz analytics |
| `/admin/quizzes/[id]/result-page` | Result page block builder |
| `/admin/settings` | Branding and SEO |

## Current implementation level

The UI is intentionally backed by mock data. Pages, navigation, reusable visual components and domain skeletons are present. API route handlers are placeholders. Database SQL is a starting point, not a migration that should be applied blindly to production.

## Foundation added 2026-10-08

Auth: proxy.ts, lib/auth/admin.ts, app/admin/(auth)/login/actions.ts.
Data: lib/config.ts, lib/catalog.ts, lib/repositories/catalog.ts, lib/supabase/database.types.ts.
Database: supabase/migrations/0001_initial.sql and 0002_security_foundation.sql; schema.sql is their fresh-install equivalent.
Verification: tests/domain.test.ts, tests/database.test.ts, scripts/smoke.mjs.
Progress: AUDIT_REPORT.md and TASKS.md. Public catalog/search now support real Supabase data. Most admin modules and quiz pages remain scaffold; real-mode quiz is deliberately unavailable until transaction-safe implementation lands.
