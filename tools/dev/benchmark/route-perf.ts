/**
 * Route Performance Benchmark
 *
 * Measures HTTP response latency for every major page and API route under a
 * realistic workload: the debug user is subscribed to 4–5 real sections from
 * the most recent non-synthetic semester (load:static data).
 *
 * Prerequisites:
 *   1. Run `bun run dev:seed-scenarios` (creates the debug user)
 *   2. Start the dev server:  bun run dev
 *      OR a production build:  bun run build && bun run start
 *
 * Usage:
 *   bun run tools/dev/benchmark/route-perf.ts [options]
 *
 * Options:
 *   --base-url=<url>   Server base URL (default: http://127.0.0.1:3000)
 *   --repeat=<n>       Measured runs per route  (default: 8)
 *   --warmup=<n>       Warmup runs per route     (default: 2)
 *   --output=<path>    Write JSON results to file (optional)
 *   --subscriptions=<n> Number of sections to subscribe (default: 4)
 */

import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import {
  createToolPrisma,
  disconnectToolPrisma,
} from "../../shared/tool-prisma";
import { getDevDebugCredentialConfig } from "../seed/dev-seed";
import { parseCliInteger } from "../util/cli-numbers";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://127.0.0.1:3000" },
    repeat: { type: "string", default: "8" },
    warmup: { type: "string", default: "2" },
    output: { type: "string" },
    subscriptions: { type: "string", default: "4" },
  },
  strict: true,
});

const BASE_URL = args["base-url"] ?? "http://127.0.0.1:3000";
const REPEAT = parseCliInteger(args.repeat, 8, { min: 1 });
const WARMUP = parseCliInteger(args.warmup, 2, { min: 0 });
const SUBSCRIPTION_COUNT = parseCliInteger(args.subscriptions, 4, {
  min: 1,
  max: 10,
});
const OUTPUT = args.output;

// ---------------------------------------------------------------------------
// Setup: subscribe debug user to real sections from load:static data
// ---------------------------------------------------------------------------

const prisma = createToolPrisma();

async function resolveRealSections(count: number) {
  // Find the latest non-synthetic semester that has the most sections
  // (synthetic jwIds start at 1_500_000_000; dev scenario uses 9_900_001)
  const top = await prisma.semester.findMany({
    where: { jwId: { lt: 1_000_000 } },
    orderBy: { jwId: "desc" },
    take: 3,
    select: { id: true, nameCn: true, jwId: true },
  });

  if (top.length === 0) {
    throw new Error(
      "No real semester data found. Run `bun run load:static` first.",
    );
  }

  // Pick the semester with the most sections (usually the latest)
  let bestSemesterId = top[0].id;
  let bestName = top[0].nameCn;
  let bestCount = 0;
  for (const sem of top) {
    const c = await prisma.section.count({ where: { semesterId: sem.id } });
    if (c > bestCount) {
      bestCount = c;
      bestSemesterId = sem.id;
      bestName = sem.nameCn;
    }
  }

  console.log(
    `[setup] Using semester: ${bestName} (id=${bestSemesterId}, ${bestCount} sections)`,
  );

  // Pick sections that have schedules (makes calendar/ICS routes non-trivial)
  const sections = await prisma.section.findMany({
    where: {
      semesterId: bestSemesterId,
      schedules: { some: {} },
    },
    select: { id: true, jwId: true, code: true },
    take: count,
    orderBy: { id: "asc" },
  });

  if (sections.length < count) {
    console.warn(
      `[setup] Only found ${sections.length} sections with schedules (wanted ${count})`,
    );
  }

  return sections;
}

async function setupBenchmarkUser(sectionIds: number[]) {
  const { username, email, password } = getDevDebugCredentialConfig().debug;

  const user = await prisma.user.findFirst({
    where: { username },
    select: { id: true, calendarFeedToken: true },
  });

  if (!user) {
    throw new Error(
      `Debug user '${username}' not found. Run \`bun run dev:seed-scenarios\`.`,
    );
  }

  // Refresh the credential password hash so HTTP sign-in works
  const hashedPw = await hashPassword(password);
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "credential",
        providerAccountId: user.id,
      },
    },
    update: { password: hashedPw },
    create: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      providerAccountId: user.id,
      password: hashedPw,
    },
  });
  console.log("[setup] Credential password hash refreshed ✓");
  console.log(`[setup] email=${email}  password=${password}`);

  // Subscribe the user to the selected real sections
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscribedSections: {
        set: sectionIds.map((id) => ({ id })),
      },
    },
  });

  // Ensure a stable calendar feed token for public ICS benchmark
  let feedToken = user.calendarFeedToken;
  if (!feedToken) {
    feedToken = `perf-bench-token-${Date.now()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { calendarFeedToken: feedToken },
    });
  }

  return { userId: user.id, feedToken };
}

// ---------------------------------------------------------------------------
// Auth: obtain a session cookie via email/password sign-in
// ---------------------------------------------------------------------------

async function getSessionCookie(): Promise<string> {
  const { email, password } = getDevDebugCredentialConfig().debug;

  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  if (!res.ok && res.status !== 302) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Auth sign-in failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("No set-cookie header in auth response");
  }

  // Extract the session cookie value(s) — keep all auth cookies
  const cookies = setCookie
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  return cookies;
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

type Sample = { status: number; ms: number };

async function measureRoute(
  url: string,
  cookie?: string,
  _repeat = REPEAT,
  _warmup = WARMUP,
): Promise<{ samples: Sample[]; url: string }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  // Warmup
  for (let i = 0; i < _warmup; i++) {
    await fetch(url, { headers, redirect: "manual" }).catch(() => null);
  }

  const samples: Sample[] = [];
  for (let i = 0; i < _repeat; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { headers, redirect: "manual" }).catch(
      () => null,
    );
    const ms = performance.now() - t0;
    samples.push({ status: res?.status ?? 0, ms: Math.round(ms) });
  }

  return { url, samples };
}

function stats(samples: Sample[]) {
  const ok = samples.filter((s) => s.status >= 200 && s.status < 400);
  const ms = ok.map((s) => s.ms).sort((a, b) => a - b);
  if (ms.length === 0) {
    return { ok: 0, total: samples.length, min: 0, p50: 0, p95: 0, max: 0 };
  }
  const p = (pct: number) =>
    ms[Math.min(Math.floor(ms.length * pct), ms.length - 1)];
  return {
    ok: ok.length,
    total: samples.length,
    min: ms[0],
    p50: p(0.5),
    p95: p(0.95),
    max: ms[ms.length - 1],
  };
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

type RouteSpec = {
  label: string;
  path: string | ((ctx: BenchContext) => string);
  auth?: boolean;
  group: string;
};

type BenchContext = {
  userId: string;
  feedToken: string;
  sectionJwId: number;
  sectionId: number;
  courseJwId: number;
  teacherId: number;
};

const ROUTES: RouteSpec[] = [
  // --- Pages (public) ---
  { group: "page/public", label: "home (public)", path: "/", auth: false },
  {
    group: "page/public",
    label: "sections list",
    path: "/sections",
    auth: false,
  },
  {
    group: "page/public",
    label: "section detail",
    path: (ctx) => `/sections/${ctx.sectionJwId}`,
    auth: false,
  },
  {
    group: "page/public",
    label: "courses list",
    path: "/courses",
    auth: false,
  },
  {
    group: "page/public",
    label: "teachers list",
    path: "/teachers",
    auth: false,
  },

  // --- Pages (authenticated) ---
  {
    group: "page/auth",
    label: "dashboard overview",
    path: "/",
    auth: true,
  },
  {
    group: "page/auth",
    label: "dashboard calendar",
    path: "/?tab=calendar",
    auth: true,
  },
  {
    group: "page/auth",
    label: "dashboard homeworks",
    path: "/?tab=homeworks",
    auth: true,
  },
  {
    group: "page/auth",
    label: "dashboard exams",
    path: "/?tab=exams",
    auth: true,
  },
  {
    group: "page/auth",
    label: "dashboard subscriptions",
    path: "/?tab=subscriptions",
    auth: true,
  },
  { group: "page/auth", label: "settings", path: "/settings", auth: true },

  // --- API: public read ---
  {
    group: "api/public",
    label: "GET /api/semesters",
    path: "/api/semesters",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/semesters/current",
    path: "/api/semesters/current",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/sections",
    path: "/api/sections",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/sections (filtered)",
    path: (ctx) => `/api/sections?semesterId=${ctx.sectionId}`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/sections/:jwId",
    path: (ctx) => `/api/sections/${ctx.sectionJwId}`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/sections/:jwId/schedules",
    path: (ctx) => `/api/sections/${ctx.sectionJwId}/schedules`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/sections/:jwId/schedule-groups",
    path: (ctx) => `/api/sections/${ctx.sectionJwId}/schedule-groups`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/courses",
    path: "/api/courses",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/courses/:jwId",
    path: (ctx) => `/api/courses/${ctx.courseJwId}`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/teachers",
    path: "/api/teachers",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/teachers/:id",
    path: (ctx) => `/api/teachers/${ctx.teacherId}`,
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/schedules",
    path: "/api/schedules",
    auth: false,
  },
  {
    group: "api/public",
    label: "GET /api/metadata",
    path: "/api/metadata",
    auth: false,
  },

  // --- API: section calendars (public, no auth needed) ---
  {
    group: "api/calendar",
    label: "GET /api/sections/calendar.ics (1 section)",
    path: (ctx) => `/api/sections/calendar.ics?sectionIds=${ctx.sectionId}`,
    auth: false,
  },
  {
    group: "api/calendar",
    label: "GET /api/sections/:jwId/calendar.ics",
    path: (ctx) => `/api/sections/${ctx.sectionJwId}/calendar.ics`,
    auth: false,
  },

  // --- API: authenticated ---
  {
    group: "api/auth",
    label: "GET /api/calendar-subscriptions/current",
    path: "/api/calendar-subscriptions/current",
    auth: true,
  },
  {
    group: "api/auth",
    label: "GET /api/homeworks (subscribed sections)",
    path: (ctx) => `/api/homeworks?sectionIds=${ctx.sectionId}`,
    auth: true,
  },
  {
    group: "api/auth",
    label: "GET /api/todos",
    path: "/api/todos",
    auth: true,
  },

  // --- API: user calendar ICS (feed-token, no session cookie needed) ---
  {
    group: "api/calendar",
    label: "GET /api/users/:id/calendar.ics (token)",
    path: (ctx) =>
      `/api/users/${ctx.userId}/calendar.ics?token=${ctx.feedToken}`,
    auth: false,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function isServerReady(): Promise<boolean> {
  try {
    const r = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n[route-perf] base-url=${BASE_URL}`);
  console.log(
    `[route-perf] repeat=${REPEAT}  warmup=${WARMUP}  subscriptions=${SUBSCRIPTION_COUNT}\n`,
  );

  // 1. Check server
  if (!(await isServerReady())) {
    console.error(
      `[route-perf] Server not reachable at ${BASE_URL}.\n` +
        "  Start the server first:  bun run dev  (or bun run start)\n",
    );
    process.exitCode = 1;
    return;
  }

  // 2. Setup DB
  const realSections = await resolveRealSections(SUBSCRIPTION_COUNT);
  if (realSections.length === 0) {
    console.error(
      "[route-perf] No real sections found. Run load:static first.",
    );
    process.exitCode = 1;
    return;
  }

  const sectionIds = realSections.map((s) => s.id);
  const { userId, feedToken } = await setupBenchmarkUser(sectionIds);

  // Resolve context IDs needed for parameterised routes
  const firstSection = realSections[0];
  const sectionDetail = await prisma.section.findUnique({
    where: { id: firstSection.id },
    select: {
      jwId: true,
      course: { select: { jwId: true } },
      teachers: { select: { id: true }, take: 1 },
    },
  });

  if (!sectionDetail) {
    throw new Error(`Section id=${firstSection.id} not found`);
  }

  const ctx: BenchContext = {
    userId,
    feedToken,
    sectionJwId: sectionDetail.jwId,
    sectionId: firstSection.id,
    courseJwId: sectionDetail.course.jwId,
    teacherId: sectionDetail.teachers[0]?.id ?? 1,
  };

  console.log(
    `[setup] User: ${userId} | Section jwId: ${ctx.sectionJwId} (${firstSection.code})`,
  );
  console.log(
    `[setup] Subscribed to ${realSections.length} sections: ${realSections.map((s) => s.code).join(", ")}`,
  );
  console.log(`[setup] Feed token: ${feedToken.slice(0, 20)}...\n`);

  await disconnectToolPrisma(prisma);

  // 3. Auth
  let cookie: string;
  try {
    cookie = await getSessionCookie();
    console.log("[auth] Session cookie obtained ✓\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auth] Failed to get session: ${msg}`);
    console.error(
      "  Make sure E2E_DEBUG_AUTH=1 is set and the server is in dev mode.\n",
    );
    process.exitCode = 1;
    return;
  }

  // 4. Benchmark
  type Result = {
    group: string;
    label: string;
    url: string;
    auth: boolean;
    ok: number;
    total: number;
    min: number;
    p50: number;
    p95: number;
    max: number;
  };

  const results: Result[] = [];
  let lastGroup = "";

  for (const route of ROUTES) {
    const path =
      typeof route.path === "function" ? route.path(ctx) : route.path;
    const url = `${BASE_URL}${path}`;
    const sessionCookie = route.auth ? cookie : undefined;

    process.stdout.write(`  [${route.group}] ${route.label.padEnd(52)} `);

    const { samples } = await measureRoute(url, sessionCookie);
    const s = stats(samples);

    process.stdout.write(
      `p50=${String(s.p50).padStart(5)}ms  p95=${String(s.p95).padStart(5)}ms  max=${String(s.max).padStart(5)}ms  ok=${s.ok}/${s.total}\n`,
    );

    if (route.group !== lastGroup) {
      lastGroup = route.group;
    }

    results.push({
      group: route.group,
      label: route.label,
      url: path,
      auth: route.auth ?? false,
      ...s,
    });
  }

  // 5. Summary table
  console.log(`\n${"─".repeat(100)}`);
  console.log(
    `${"Route".padEnd(52)} ${"Group".padEnd(16)} ${"auth"} ${"p50 ms".padStart(7)} ${"p95 ms".padStart(7)} ${"max ms".padStart(7)} ok/n`,
  );
  console.log("─".repeat(100));

  let lastGroupPrint = "";
  for (const r of results) {
    if (r.group !== lastGroupPrint) {
      if (lastGroupPrint) console.log("");
      lastGroupPrint = r.group;
    }
    console.log(
      `${r.label.padEnd(52)} ${r.group.padEnd(16)} ${r.auth ? " ✓  " : "    "}` +
        ` ${String(r.p50).padStart(7)} ${String(r.p95).padStart(7)} ${String(r.max).padStart(7)} ${r.ok}/${r.total}`,
    );
  }
  console.log("─".repeat(100));

  // Slow route warnings (p95 > 1 s)
  const slow = results.filter((r) => r.p95 > 1000);
  if (slow.length > 0) {
    console.log(
      `\n⚠  ${slow.length} route(s) with p95 > 1s: ${slow.map((r) => r.label).join(", ")}`,
    );
  }

  // 6. Optional JSON output
  if (OUTPUT) {
    const payload = {
      createdAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      repeat: REPEAT,
      warmup: WARMUP,
      subscriptionCount: SUBSCRIPTION_COUNT,
      subscribedSections: realSections.map((s) => ({
        id: s.id,
        jwId: s.jwId,
        code: s.code,
      })),
      results,
    };
    const outputPath = resolve(process.cwd(), OUTPUT);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\n[route-perf] wrote ${OUTPUT}`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[route-perf] fatal: ${msg}`);
  process.exitCode = 1;
});
