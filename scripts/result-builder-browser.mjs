// Production app + local Supabase HTTP adapter backed by PostgreSQL WASM.
import { runtimeDatabase } from "../tests/helpers/runtime-db.ts";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const db = await runtimeDatabase(),
  base = "http://127.0.0.1:3351",
  qid = "20000000-0000-4000-8000-000000000001",
  slug = "giai-tich-1-chuong-1-2",
  admin = randomUUID(),
  now = new Date().toISOString();
await db.exec(
  `insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set request.jwt.claim.sub='${admin}';`,
);
const user = {
  id: admin,
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: now,
};
const rpc = async (op, p = {}) =>
  JSON.parse(
    (
      await db.query("select public.quiz_runtime($1,$2) as d", [
        op,
        JSON.stringify({ slug, ...p }),
      ])
    ).rows[0].d,
  );
const rawToken = "c".repeat(64),
  token_hash = createHash("sha256").update(rawToken).digest("hex"),
  meta = await rpc("inspect");
await rpc("unlock", { token_hash, revision: meta.revision, visitor: "v" });
const attempt = await rpc("start", {
  token_hash,
  revision: meta.revision,
  request_id: randomUUID(),
  identity: "b".repeat(64),
  participant: { name: "Preview" },
});
await rpc("submit", { token_hash, attempt_id: attempt.id, answers: {} });
const before = (
  await db.query("select to_jsonb(a) d from public.attempts a where id=$1", [
    attempt.id,
  ])
).rows[0].d;
const fixture = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://127.0.0.1:3350").pathname;
    if (path === "/qa.png") {
      res.setHeader("Content-Type", "image/png");
      return res.end(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=",
          "base64",
        ),
      );
    }
    res.setHeader("Content-Type", "application/json");
    if (path === "/auth/v1/user") return res.end(JSON.stringify(user));
    if (path === "/rest/v1/rpc/is_admin") return res.end("true");
    let body = "";
    for await (const b of req) body += b;
    const p = JSON.parse(body || "{}");
    let query, args;
    if (path === "/rest/v1/rpc/admin_result_document") {
      query = "select public.admin_result_document($1) d";
      args = [p.p_id];
    } else if (path === "/rest/v1/rpc/admin_save_result") {
      query = "select public.admin_save_result($1) d";
      args = [p.p_document];
    } else if (path === "/rest/v1/rpc/quiz_runtime") {
      if (req.headers.authorization !== "Bearer test-service") {
        res.statusCode = 401;
        return res.end("{}");
      }
      query = "select public.quiz_runtime($1,$2) d";
      args = [p.p_op, p.p_payload];
    } else {
      res.statusCode = 404;
      return res.end("{}");
    }
    const r = await db.query(query, args);
    res.end(JSON.stringify(r.rows[0].d));
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: e.message, code: e.code }));
  }
});
await new Promise((r) => fixture.listen(3350, "127.0.0.1", r));
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3351",
  ],
  {
    env: {
      ...process.env,
      APP_DATA_MODE: "supabase",
      NEXT_PUBLIC_SITE_URL: base,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3350",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public",
      SUPABASE_SERVICE_ROLE_KEY: "test-service",
      QUIZ_SESSION_SECRET: "test-only-result-secret-01234567890",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Error("Startup timeout")), 20000);
    server.stdout.on("data", (b) => {
      if (String(b).includes("Ready")) {
        clearTimeout(t);
        resolve();
      }
    });
    server.stderr.on("data", (b) => process.stderr.write(b));
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : { channel: "chromium" }),
  });
  const context = await browser.newContext();
  await context.route("https://www.youtube-nocookie.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="background:#172033;color:white">YouTube embed preview fixture</body>',
    }),
  );
  const exp = Math.floor(Date.now() / 1000) + 3600,
    jwt = [
      Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: admin, exp, role: "authenticated" }),
      ).toString("base64url"),
      "test",
    ].join(".");
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" +
        Buffer.from(
          JSON.stringify({
            access_token: jwt,
            refresh_token: "test",
            expires_at: exp,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        ).toString("base64url"),
      url: base,
    },
    {
      name:
        "quiz_access_" +
        createHash("sha256").update(slug).digest("hex").slice(0, 20),
      value: rawToken,
      url: base,
      httpOnly: true,
    },
  ]);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${base}/admin/quizzes/${qid}/result-page`);
  const save = async () => {
    await page
      .getByRole("button", { name: "Lưu trang kết quả", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Đã lưu trang kết quả." })
      .waitFor();
    await page.getByRole("button", { name: "Đóng thông báo" }).click();
  };
  for (const [label, type] of [
    ["YouTube", "youtube"],
    ["Link", "external_link"],
    ["Button", "button"],
    ["Image", "image"],
    ["Text", "text"],
  ]) {
    await page.getByRole("button", { name: "+ " + label, exact: true }).click();
    await page.getByLabel("Tiêu đề", { exact: true }).fill("QA " + type);
    if (type === "text") {
      await page
        .getByLabel("Nội dung văn bản", { exact: true })
        .fill("<script>window.resultXss=true</script>");
      await page
        .getByLabel("Hiển thị block", { exact: true })
        .selectOption("scheduled_at");
      await page
        .getByLabel("Thời điểm (giờ máy của bạn)", { exact: true })
        .fill("2099-01-01T12:00");
    } else
      await page
        .getByLabel("URL", { exact: true })
        .fill(
          type === "youtube"
            ? "https://youtu.be/dQw4w9WgXcQ"
            : type === "image"
              ? "http://127.0.0.1:3350/qa.png"
              : "https://example.com/resource",
        );
  }
  await save();
  await page.reload();
  await page
    .getByRole("button", { name: "3. QA external_link", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "2. QA youtube", exact: true })
    .click();
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Lưu trang kết quả" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "URL YouTube không hợp lệ" })
    .waitFor();
  await page
    .getByLabel("URL", { exact: true })
    .fill("https://youtube.com/watch?v=9bZkp7q19f0");
  await page.getByRole("button", { name: "Đưa block lên" }).click();
  await save();
  await mkdir("artifacts/result-builder", { recursive: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.screenshot({
      path: `artifacts/result-builder/admin-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  const resultPage = await context.newPage();
  await resultPage.goto(`${base}/q/${slug}/result/${attempt.id}`);
  await resultPage
    .getByRole("heading", { name: "Hoàn thành bài kiểm tra!" })
    .waitFor();
  assert.equal(
    await resultPage.locator("iframe").getAttribute("src"),
    "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
  );
  assert.ok(!(await resultPage.content()).includes("resultXss"));
  assert.equal(
    await resultPage.getByRole("heading", { name: "Chi tiết đáp án" }).count(),
    0,
  );
  for (const width of [375, 768, 1440]) {
    await resultPage.setViewportSize({ width, height: 950 });
    await resultPage.screenshot({
      path: `artifacts/result-builder/result-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await resultPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(a) d from public.attempts a where id=$1",
        [attempt.id],
      )
    ).rows[0].d,
    before,
  );
  await page.getByRole("button", { name: "6. QA text", exact: true }).click();
  await page
    .getByLabel("Hiển thị block", { exact: true })
    .selectOption("after_submit");
  await save();
  await resultPage.reload();
  await resultPage
    .getByText("<script>window.resultXss=true</script>", { exact: true })
    .waitFor();
  assert.equal(await resultPage.evaluate(() => window.resultXss), undefined);
  await page.getByRole("button", { name: "Xóa block", exact: true }).click();
  await save();
  await resultPage.reload();
  assert.equal(
    await resultPage
      .getByText("<script>window.resultXss=true</script>", { exact: true })
      .count(),
    0,
  );
  await db.exec(
    `update public.quizzes set status='closed',show_correct_answers=true where id='${qid}'`,
  );
  await resultPage.reload();
  await resultPage.getByRole("heading", { name: "Chi tiết đáp án" }).waitFor();
  console.log(
    "PASS Result Builder: five types, validation, save/reload/edit/delete/reorder, scheduled suppression, escaped text, immutable attempt after video edit, review permission and mobile/desktop. Local DB fixture only.",
  );
} finally {
  await browser?.close();
  server.kill();
  fixture.close();
  await db.close();
}
