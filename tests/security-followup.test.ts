import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runtimeDatabase } from "./helpers/runtime-db";
import {
  assertPublicKey,
  configuredOrigin,
  authCookieOptions,
} from "../lib/security/config";
import { securityHeaders } from "../lib/security/headers";
import { builderSchema, newQuiz } from "../lib/quiz-builder";

const quiz = "20000000-0000-4000-8000-000000000001";
test("configuration rejects privileged public keys and unsafe origins; session and CSP defaults", () => {
  for (const key of [
    "sb_secret_test",
    `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.b`,
  ])
    assert.throws(() => assertPublicKey(key));
  assertPublicKey("sb_publishable_test");
  for (const origin of [
    undefined,
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?x=1",
    "javascript:alert(1)",
  ])
    assert.throws(() => configuredOrigin(origin));
  assert.equal(
    configuredOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    assert.deepEqual(authCookieOptions(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
  const csp = securityHeaders("test-nonce")["Content-Security-Policy"];
  assert.ok(csp.includes("'nonce-test-nonce'"));
  assert.ok(!csp.includes("unsafe-eval"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.equal(
    builderSchema.safeParse({
      ...newQuiz(),
      fields: [
        {
          id: randomUUID(),
          label: "bad",
          key: "constructor",
          type: "text",
          placeholder: "",
          required: false,
          options: [],
          sort_order: 0,
          is_identifier: false,
          show_on_leaderboard: false,
        },
      ],
    }).success,
    false,
  );
});

test("latest schema: private grants, all RLS, no metadata admin escalation, suspended admins denied", async () => {
  const db = await runtimeDatabase();
  try {
    const admin = randomUUID(),
      member = randomUUID();
    await db.exec(
      `insert into auth.users values('${admin}'),('${member}');insert into public.profiles(id)values('${admin}'),('${member}');insert into public.admins(user_id)values('${admin}');`,
    );
    const unprotected = await db.query(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    assert.deepEqual(unprotected.rows, []);
    const helpers = (
      await db.query<{ name: string }>(
        "select p.oid::regprocedure::text name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'quiz_%' or p.proname='admin_save_quiz_v5') and p.proname<>'quiz_runtime'",
      )
    ).rows;
    for (const { name } of helpers)
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          (
            await db.query<{ ok: boolean }>(
              "select has_function_privilege($1,$2,'EXECUTE') ok",
              [role, name],
            )
          ).rows[0].ok,
          false,
          `${role}: ${name}`,
        );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const table of [
        "questions",
        "question_options",
        "short_answer_accepted_answers",
        "quiz_fields",
        "attempts",
        "answers",
        "quiz_result_blocks",
        "quiz_result_pages",
        "quiz_access_sessions",
        "quiz_rate_limits",
        "published_quizzes",
        "published_quiz_fields",
        "published_quiz_questions",
        "published_question_options",
      ])
        await assert.rejects(
          db.query(`select * from public.${table}`),
          /permission denied/,
        );
      await db.exec("reset role");
    }
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${member}';set request.jwt.claims='{"user_metadata":{"role":"admin","is_admin":true}}'`,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0]
        .ok,
      false,
    );
    for (const sql of [
      "select public.admin_quiz_document($1)",
      "select public.admin_result_document($1)",
      "select public.admin_results($1,'participants')",
      "select public.admin_results($1,'export')",
    ])
      await assert.rejects(db.query(sql, [quiz]), /ADMIN_REQUIRED/);
    await assert.rejects(
      db.query("select public.admin_save_quiz($1)", ["{}"]),
      /ADMIN_REQUIRED/,
    );
    await assert.rejects(
      db.query("select public.admin_save_result($1)", ["{}"]),
      /ADMIN_REQUIRED/,
    );
    await assert.rejects(
      db.query("select public.admin_leaderboard_settings($1,now(),true,$2)", [
        quiz,
        [],
      ]),
      /ADMIN_REQUIRED/,
    );
    for (const table of ["admins", "profiles", "admin_users"])
      await assert.rejects(
        db.query(`delete from public.${table}`),
        /permission denied/,
      );
    await assert.rejects(
      db.query(
        "insert into public.courses(title,slug)values('Attack','attack')",
      ),
      /row-level security/,
    );
    await db.exec(`set request.jwt.claim.sub='${admin}'`);
    assert.equal(
      (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0]
        .ok,
      true,
    );
    await db.exec(
      `reset role;update public.admins set status='suspended' where user_id='${admin}';set role authenticated;`,
    );
    assert.equal(
      (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0]
        .ok,
      false,
    );
    await assert.rejects(
      db.query("select public.admin_quiz_document($1)", [quiz]),
      /ADMIN_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});

test("direct admin builder rejects null/missing children without deleting existing questions", async () => {
  const db = await runtimeDatabase();
  try {
    const admin = randomUUID();
    await db.exec(
      `insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set role authenticated;set request.jwt.claim.sub='${admin}';`,
    );
    const load = async () =>
      JSON.parse(
        (
          await db.query<{ d: string }>(
            "select public.admin_quiz_document($1) d",
            [quiz],
          )
        ).rows[0].d,
      );
    const original = await load();
    for (const children of [
      { fields: null },
      { questions: null },
      { fields: undefined },
      { questions: undefined },
    ])
      await assert.rejects(
        db.query("select public.admin_save_quiz($1)", [
          JSON.stringify({ ...original, ...children }),
        ]),
        /INVALID_CHILDREN/,
      );
    await assert.rejects(
      db.query("select public.admin_save_quiz(null)"),
      /INVALID_QUIZ/,
    );
    assert.deepEqual(await load(), original);
  } finally {
    await db.close();
  }
});
