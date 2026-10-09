import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { runtimeDatabase } from "./helpers/runtime-db";
import {
  participantsCsv,
  type ParticipantReport,
  type AttemptReport,
  type AnalyticsReport,
} from "../lib/results-data";
const quiz = "20000000-0000-4000-8000-000000000001",
  slug = "giai-tich-1-chuong-1-2";
test("results reports: auth, pagination, ranking, analytics, snapshots and explicit public fields", async () => {
  const db = await runtimeDatabase();
  const rpc = async (op: string, p: Record<string, unknown> = {}) =>
    JSON.parse(
      (
        await db.query<{ d: string }>("select public.quiz_runtime($1,$2) d", [
          op,
          JSON.stringify({ slug, ...p }),
        ])
      ).rows[0].d,
    );
  const report = async <T = ParticipantReport>(
    op: string,
    search = "",
    page = 1,
    size = 25,
    attempt: string | null = null,
  ) =>
    JSON.parse(
      (
        await db.query<{ d: string }>(
          "select public.admin_results($1,$2,$3,$4,$5,$6) d",
          [quiz, op, search, page, size, attempt],
        )
      ).rows[0].d,
    ) as T;
  try {
    await assert.rejects(report("participants"), /ADMIN_REQUIRED/);
    const admin = randomUUID();
    await db.exec(
      `insert into auth.users values('${admin}');insert into public.profiles(id) values('${admin}');insert into public.admins(user_id) values('${admin}');set request.jwt.claim.sub='${admin}';`,
    );
    let analytics = await report<AnalyticsReport>("analytics");
    assert.equal(analytics.summary.completion_rate, 0);
    assert.equal(analytics.summary.average_score, null);
    assert.deepEqual(analytics.questions, []);
    const meta = await rpc("inspect"),
      token_hash = createHash("sha256").update("report-user").digest("hex");
    await rpc("unlock", { revision: meta.revision, token_hash, visitor: "v" });
    const participant = {
      name: "Nguyen Report",
      email: "private@example.com",
      facebook: "https://facebook.com/private",
      phone: "SECRET_PHONE",
      student_id: "SECRET_STUDENT",
      hidden: "SECRET_JSON",
    };
    // Runtime normally validates these fields before start; add test-only values after starting.
    const { id } = await rpc("start", {
      token_hash,
      revision: meta.revision,
      identity: "a".repeat(64),
      request_id: randomUUID(),
      participant: { name: participant.name },
    });
    await db.query(
      "update public.attempts set participant_data=$1 where id=$2",
      [JSON.stringify(participant), id],
    );
    const q1 = "20000000-0000-4000-8000-000000000201";
    await rpc("submit", {
      token_hash,
      attempt_id: id,
      answers: { [q1]: "20000000-0000-4000-8000-000000000301" },
    });
    await db.query("update public.attempts set duration_ms=60000,started_at=submitted_at-interval '1 minute' where id=$1", [
      id,
    ]);
    const detail = await report<AttemptReport>("detail", "", 1, 25, id);
    assert.equal(detail.questions.length, 3);
    assert.equal(detail.questions[0].is_correct, true);
    assert.equal(detail.questions[0].points_awarded, 1);
    assert.equal(
      detail.questions[0].correct,
      "20000000-0000-4000-8000-000000000301",
    );
    assert.equal(detail.attempt.participant_data.email, participant.email);
    await assert.rejects(
      report("detail", "", 1, 25, randomUUID()),
      /NOT_FOUND/,
    );
    await db.exec(
      `update public.questions set content='changed source' where id='${q1}'`,
    );
    assert.deepEqual(
      (await report<AttemptReport>("detail", "", 1, 25, id)).questions,
      detail.questions,
    );
    // Two submissions for one participant and one unfinished participant.
    await db.query(
      `insert into public.attempts(quiz_id,status,participant_data,participant_data_digest,question_snapshot,started_at,submitted_at,score,max_score,correct_count,wrong_count,duration_ms)
 select quiz_id,'submitted','{"name":"Earlier"}',participant_data_digest,question_snapshot,started_at-interval '1 second',submitted_at-interval '1 second',score,max_score,correct_count,wrong_count,duration_ms from public.attempts where id=$1`,
      [id],
    );
    await db.query(
      `insert into public.attempts(quiz_id,participant_data,participant_data_digest,question_snapshot) select quiz_id,'{"name":"Unfinished"}','${"b".repeat(64)}',question_snapshot from public.attempts where id=$1`,
      [id],
    );
    const page1 = await report("participants", "", 1, 1),
      page2 = await report("participants", "", 2, 1);
    assert.equal(page1.total, 3);
    assert.equal(page1.rows[0].participant_data.name, "Earlier");
    assert.equal(page1.rows[0].rank, 1);
    assert.equal(page2.rows[0].rank, 2);
    const filtered = await report("participants", "private@example.com");
    assert.equal(filtered.total, 1);
    assert.equal(filtered.rows[0].rank, 2);
    assert.equal((await report("participants", "%")).total, 0);
    analytics = await report<AnalyticsReport>("analytics");
    assert.equal(analytics.summary.participant_count, 2);
    assert.equal(analytics.summary.completed_attempts, 2);
    assert.equal(analytics.summary.total_attempts, 3);
    assert.equal(analytics.summary.completion_rate, 66.67);
    assert.equal(analytics.summary.average_score, 1);
    assert.equal(analytics.summary.average_duration_ms, 60000);
    assert.equal(analytics.questions[0].completed_count, 2);
    assert.equal(analytics.questions[0].correct_rate, 50); // Missing copied answer is counted wrong.
    const board = await rpc("leaderboard", { token_hash });
    assert.equal(board[0].name, "Earlier");
    assert.equal(board[1].rank, filtered.rows[0].rank);
    for (const secret of [
      "private@example.com",
      "SECRET_PHONE",
      "SECRET_STUDENT",
      "SECRET_JSON",
      "facebook",
      "participant_data",
      "correct_option_id",
    ])
      assert.ok(!JSON.stringify(board).includes(secret));
    const before = (
      await db.query("select to_jsonb(a) d from public.attempts a order by id")
    ).rows;
    const settings = await report("leaderboard");
    await db.query("select public.admin_leaderboard_settings($1,$2,true,$3)", [
      quiz,
      settings.revision,
      [],
    ]);
    const hidden = await rpc("leaderboard", { token_hash });
    assert.equal(hidden[0].name, "Người tham gia");
    assert.deepEqual(hidden[0].public_fields, []);
    assert.ok(!JSON.stringify(hidden).includes("Earlier"));
    await assert.rejects(
      db.query("select public.admin_leaderboard_settings($1,$2,true,$3)", [
        quiz,
        settings.revision,
        ["name"],
      ]),
      /STALE_VERSION/,
    );
    assert.deepEqual(
      (
        await db.query(
          "select to_jsonb(a) d from public.attempts a order by id",
        )
      ).rows,
      before,
    );
    await db.exec(
      `update public.quizzes set status='closed',show_correct_answers=true where id='${quiz}'`,
    );
    assert.equal(
      (await rpc("result", { token_hash, attempt_id: id })).review,
      undefined,
    );
    await db.exec("set role authenticated");
    await db.exec("set request.jwt.claim.sub=''");
    await assert.rejects(report("participants"), /ADMIN_REQUIRED/);
    await assert.rejects(report("analytics"), /ADMIN_REQUIRED/);
    await assert.rejects(report("export"), /ADMIN_REQUIRED/);
    await assert.rejects(
      db.query("select * from public.quiz_ranks($1)", [quiz]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.quiz_runtime_v8($1,$2)", ["result", "{}"]),
      /permission denied/,
    );
    await db.exec("set role anon");
    await assert.rejects(report("detail", "", 1, 25, id), /permission denied/);
  } finally {
    await db.close();
  }
});
test("CSV quotes Unicode, commas, newlines and blocks spreadsheet formulas", () => {
  const csv = participantsCsv({
    fields: [
      {
        key: "name",
        label: "Tên",
        show_on_leaderboard: false,
        status: "published",
      },
    ],
    rows: [
      {
        id: "1",
        participant_data: { name: '=HYPERLINK("evil")' },
        status: "submitted",
        score: 0,
        max_score: 3,
        correct_count: 0,
        wrong_count: 3,
        duration_ms: 1200,
        rank: 1,
        submitted_at: null,
      },
      {
        id: "2",
        participant_data: { name: 'Nguyễn, "An"\nB' },
        status: "in_progress",
        score: null,
        max_score: null,
        correct_count: null,
        wrong_count: null,
        duration_ms: null,
        rank: null,
        submitted_at: null,
      },
    ],
  });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"Nguyễn, ""An""\nB"'));
  assert.ok(csv.includes('"1.2"'));
});
