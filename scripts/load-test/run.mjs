// Load test (launch task 7, founder approved 2026-11-14): many made-up students use the STAGING copy of
// Lawdeck at once. Each signs in, opens the home page, asks a question (answered by the pretend AI on
// staging, so no AI cost), and opens the chat. Prints only counts and timings, never content.
// Everything it creates is deleted at the end, even if the test fails.
// Env: STAGING_SUPABASE_URL, STAGING_PUBLISHABLE_KEY, STAGING_SECRET_KEY, STAGING_SITE_URL,
//      VERCEL_BYPASS_SECRET (optional), STUDENTS (default 500), RAMP_SECONDS (default 30).
import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LIVE_PROJECT = "vvidwaslcbmzbrcqvdyz";
const env = (name, fallback) => {
  const value = (process.env[name] ?? fallback ?? "").trim();
  if (!value) throw new Error(`Set ${name} (docs/specs/staging.md).`);
  return value;
};
const SUPABASE_URL = env("STAGING_SUPABASE_URL").replace(/\/$/, "");
const PUBLISHABLE = env("STAGING_PUBLISHABLE_KEY");
const SECRET = env("STAGING_SECRET_KEY");
const SITE = env("STAGING_SITE_URL").replace(/\/$/, "");
const BYPASS = (process.env.VERCEL_BYPASS_SECRET ?? "").trim();
const STUDENTS = Math.min(Number(process.env.STUDENTS || 500), 1000);
const RAMP_MS = Number(process.env.RAMP_SECONDS || 30) * 1000;

// Never the live site or the live database.
if (SUPABASE_URL.includes(LIVE_PROJECT) || /mylawdeck\.com/.test(SITE) || !/\.vercel\.app$|localhost/.test(new URL(SITE).host))
  throw new Error("This test runs only against the staging copy, never the live site.");

const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const TERMS_VERSION = /TERMS_VERSION = "([^"]+)"/.exec(readFileSync("src/lib/terms.ts", "utf8"))[1];
const TAG = `lt${Date.now().toString(36)}`;
const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const QUESTIONS = [
  "What is a writ of summons?",
  "How is originating process served?",
  "What must a statement of claim contain?",
  "When can judgment be entered in default?",
  "What is the undefended list procedure?",
];

const pool = async (items, size, work) => {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await work(items[i], i);
      }
    }),
  );
  return results;
};

// --- Made-up library content, so the search has something to find --------------------------------
async function seedLibrary() {
  const { data: courses, error } = await admin.from("courses").select("id").limit(1);
  if (error || !courses?.length) throw new Error("Staging has no courses: run Staging set-up first.");
  const items = [];
  for (let n = 0; n < 5; n++) {
    const { data, error: e } = await admin
      .from("kb_items")
      .insert({ course_id: courses[0].id, title: `Load test notes ${TAG} ${n}`, type: "note", review_status: "approved" })
      .select("id")
      .single();
    if (e) throw new Error(`Could not add test library items (${e.code ?? "error"}).`);
    items.push(data.id);
    const passages = QUESTIONS.map((q, position) => ({
      item_id: data.id,
      position,
      text: `Made-up load test passage ${position}. ${q.replace("?", "")}: writ, originating process, service, statement of claim, default judgment and the undefended list are explained here for testing only.`,
    }));
    const { error: pe } = await admin.from("kb_passages").insert(passages);
    if (pe) throw new Error(`Could not add test passages (${pe.code ?? "error"}).`);
  }
  return items;
}

// --- Made-up students --------------------------------------------------------------------------
async function createStudent(i) {
  const email = `${TAG}-${i}@loadtest.invalid`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Load Test", terms_version: TERMS_VERSION },
  });
  if (error) return { error: `create: ${error.status ?? error.code ?? "error"}` };
  return { id: data.user.id, email, password };
}

function sessionCookie(session) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const name = `sb-${REF}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  const parts = value.match(/.{1,3180}/g);
  return parts.map((part, n) => `${name}.${n}=${part}`).join("; ");
}

async function signIn(student) {
  const client = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: student.email, password: student.password });
  if (error) return { error: `sign-in: ${error.status ?? error.code ?? "error"}` };
  const { data: chat, error: ce } = await client.from("conversations").insert({ title: "Load test" }).select("id").single();
  if (ce) return { error: `new chat: ${ce.code ?? "error"}` };
  return { cookie: sessionCookie(data.session), chatId: chat.id };
}

// --- One student's visit -----------------------------------------------------------------------
const headers = (cookie, extra = {}) => ({ cookie, ...(BYPASS ? { "x-vercel-protection-bypass": BYPASS } : {}), ...extra });

async function timed(fn) {
  const start = performance.now();
  try {
    const result = await fn();
    return { ms: performance.now() - start, ...result };
  } catch (error) {
    return { ms: performance.now() - start, error: `network: ${error?.cause?.code ?? error?.name ?? "error"}` };
  }
}

async function visit(student, i) {
  await new Promise((r) => setTimeout(r, (RAMP_MS * i) / STUDENTS));
  const home = await timed(async () => {
    const res = await fetch(`${SITE}/`, { headers: headers(student.cookie) });
    await res.arrayBuffer();
    return res.ok ? {} : { error: `home: HTTP ${res.status}` };
  });
  const start = performance.now();
  let firstWords = null;
  const answer = await timed(async () => {
    const res = await fetch(`${SITE}/api/chats/${student.chatId}/answer`, {
      method: "POST",
      headers: headers(student.cookie, { origin: SITE, "content-type": "application/json" }),
      body: JSON.stringify({ question: QUESTIONS[i % QUESTIONS.length], level: "exam" }),
    });
    if (!res.ok || !res.body) return { error: `answer: HTTP ${res.status}` };
    let buffer = "";
    let outcome = { error: "answer: stream ended early" };
    for await (const chunk of res.body) {
      buffer += Buffer.from(chunk).toString("utf8");
      let line;
      while ((line = buffer.indexOf("\n")) >= 0) {
        const event = JSON.parse(buffer.slice(0, line));
        buffer = buffer.slice(line + 1);
        if (event.type === "text" && firstWords === null) firstWords = performance.now() - start;
        if (event.type === "done") outcome = {};
        // The kind of error only, never its wording in full (it can echo the question).
        if (event.type === "error") outcome = { error: `answer: ${String(event.message).slice(0, 60)}` };
      }
    }
    return outcome;
  });
  const chat = await timed(async () => {
    const res = await fetch(`${SITE}/chats/${student.chatId}`, { headers: headers(student.cookie) });
    await res.arrayBuffer();
    return res.ok ? {} : { error: `chat page: HTTP ${res.status}` };
  });
  return { home, answer, chat, firstWords };
}

// --- Before the test: is the staging site using the staging database, and does it accept the sign-in? ---
// Database addresses (project refs) are not secret; no keys or content are printed.
async function preflight(student) {
  const home = await fetch(`${SITE}/`, { headers: headers(student.cookie) });
  const html = await home.text();
  const isLawdeck = /<title>[^<]*Lawdeck/i.test(html);
  console.log(`Bypass secret for Vercel's preview lock: ${BYPASS ? "set" : "NOT SET"}.`);
  console.log(`Home page is Lawdeck: ${isLawdeck ? "yes" : `no (HTTP ${home.status}; probably Vercel's login page: check VERCEL_BYPASS_SECRET)`}.`);
  if (!isLawdeck) throw new Error("The staging site shows Vercel's preview lock, not Lawdeck: set VERCEL_BYPASS_SECRET (docs/specs/staging.md).");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).slice(0, 40);
  const refs = new Set();
  for (const src of scripts) {
    const js = await (await fetch(new URL(src, SITE), { headers: headers("") })).text().catch(() => "");
    for (const m of js.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)) refs.add(m[1]);
  }
  // The account page shows the signed-in person's (made-up) email address; signed out, it asks to sign in.
  const account = await fetch(`${SITE}/account`, { headers: headers(student.cookie) });
  const signedIn = (await account.text()).includes(student.email);
  console.log(`Staging site uses database: ${[...refs].join(", ") || "not found"} (staging is ${REF}${refs.has(LIVE_PROJECT) ? "; THE LIVE DATABASE IS IN USE" : ""}).`);
  console.log(`Staging site accepts the test sign-in: ${signedIn ? "yes" : `no (HTTP ${account.status})`}.`);
  if (refs.has(LIVE_PROJECT)) throw new Error("The staging site points at the live database: fix the Vercel variables for the staging branch.");
  if (!signedIn) throw new Error("The staging site does not accept the staging sign-in: check the staging branch's Vercel variables (docs/specs/staging.md).");
}

// --- Report ------------------------------------------------------------------------------------
const pct = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const sec = (ms) => (ms === null ? "–" : `${(ms / 1000).toFixed(2)} s`);

function report(results, setupErrors) {
  const lines = [`## Load test: ${STUDENTS} students on staging`, ""];
  const step = (label, key, budget) => {
    const done = results.filter((r) => r[key] && !r[key].error);
    const times = done.map((r) => r[key].ms);
    const p95 = pct(times, 95);
    const ok = budget ? p95 !== null && p95 <= budget && done.length === results.length : done.length === results.length;
    lines.push(`| ${label} | ${done.length}/${results.length} | ${sec(pct(times, 50))} | ${sec(p95)} | ${ok ? "PASS" : "FAIL"} |`);
    return ok;
  };
  lines.push("| Step | Succeeded | Typical (p50) | Slowest 5% (p95) | Result |", "|---|---|---|---|---|");
  const a = step("Home page", "home", 3000);
  const b = step("Question answered (whole answer)", "answer", null);
  const firstWords = results.map((r) => r.firstWords).filter((v) => v !== null);
  const fwP95 = pct(firstWords, 95);
  const c = fwP95 !== null && fwP95 <= 3000;
  lines.push(`| First words of the answer | ${firstWords.length}/${results.length} | ${sec(pct(firstWords, 50))} | ${sec(fwP95)} | ${c ? "PASS" : "FAIL"} |`);
  const d = step("Chat page", "chat", 3000);
  const errors = {};
  for (const r of results) for (const key of ["home", "answer", "chat"]) if (r[key]?.error) errors[r[key].error] = (errors[r[key].error] ?? 0) + 1;
  for (const e of setupErrors) errors[e] = (errors[e] ?? 0) + 1;
  lines.push("", "Budgets: home page and first answer words within 3 seconds for the slowest 5% (the pretend AI adds 1.2 s, as Claude would).");
  if (Object.keys(errors).length) {
    lines.push("", "Problems:");
    for (const [e, n] of Object.entries(errors)) lines.push(`- ${n} × ${e}`);
  }
  const passed = a && b && c && d && setupErrors.length === 0;
  lines.push("", passed ? "**Load test: PASSED**" : "**Load test: FAILED**");
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  return passed;
}

// --- Run, then always clean up -----------------------------------------------------------------
const created = [];
let items = [];
let passed = false;
try {
  console.log(`Preparing ${STUDENTS} made-up students on staging…`);
  items = await seedLibrary();
  const made = await pool([...Array(STUDENTS).keys()], 10, createStudent);
  for (const s of made) if (s.id) created.push(s.id);
  const setupErrors = made.filter((s) => s.error).map((s) => s.error);
  const ready = await pool(
    made.filter((s) => s.id),
    20,
    async (s) => ({ ...s, ...(await signIn(s)) }),
  );
  for (const s of ready) if (s.error) setupErrors.push(s.error);
  const students = ready.filter((s) => s.cookie);
  if (students.length) await preflight(students[0]);
  console.log(`${students.length} students signed in. Starting the test (ramp ${RAMP_MS / 1000} s)…`);
  const results = await Promise.all(students.map((s, i) => visit(s, i)));
  passed = report(results, setupErrors);
} finally {
  console.log("Removing the made-up students and library items…");
  await pool(created, 10, (id) => admin.auth.admin.deleteUser(id));
  if (items.length) await admin.from("kb_items").delete().in("id", items);
  console.log(`Removed ${created.length} students and ${items.length} library items.`);
}
process.exit(passed ? 0 : 1);
