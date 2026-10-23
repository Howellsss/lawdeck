import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Security review (step 7g, rule P-05): every server action and route checks sign-in or role on
// the server, and checks its input, unless it is listed below as open to everyone with the reason.
// A new action or route that does neither fails this test until it is fixed or listed here.

const AUTH = /getCurrentAccount|getStaffRole|requireAdmin|requireReviewer|auth\.getUser|getClaims/;
// Zod checks, or safeNextPath, which allows only Lawdeck pages as the address to go to next.
const VALIDATES = /\.safeParse\(|\.parse\(|safeNextPath\(/;

// Open to everyone by design, with the reason. Keep this list short.
const PUBLIC: Record<string, string> = {
  "src/server/auth/actions.ts:signIn": "signing in (input checked; attempts limited, step 7c)",
  "src/server/auth/actions.ts:signUp": "creating an account (input checked; limited, step 7c)",
  "src/server/auth/actions.ts:requestPasswordReset": "password reset (input checked; limited, step 7c)",
  "src/server/auth/actions.ts:resendConfirmation": "resending the confirmation email (input checked; limited, step 7c)",
  "src/server/auth/actions.ts:signInWithGoogle": "starts Google sign-in; takes only a Lawdeck page to return to",
  "src/server/auth/actions.ts:signOut": "signing out",
  "src/app/health/actions.ts:checkClaude": "health check, only with the secret HEALTHCHECK_CODE",
  "src/server/feedback/actions.ts:submitTakedown": "takedown requests are open to anyone (FB-03); input checked; limited",
  "src/app/auth/callback/route.ts:GET": "Google sign-in return; only Lawdeck pages as the next address",
  "src/app/auth/confirm/route.ts:GET": "email links; only Lawdeck pages as the next address",
  "src/app/test-pages/document/docx/route.ts:GET": "test-only sample file; \"not found\" unless LAWDECK_TEST_PAGES=1 (never on the live site)",
  "src/app/api/csp-report/route.ts:POST": "browsers' policy reports; size-limited, logs only the rule and site",
};

type Fn = { file: string; name: string; params: string; body: string };

function serverFiles(): string[] {
  const actions = execSync(`grep -rl '^"use server"' src`, { encoding: "utf8" }).split("\n").filter(Boolean);
  const routes = execSync("find src/app -name route.ts", { encoding: "utf8" }).split("\n").filter(Boolean);
  return [...actions, ...routes].sort();
}

// Every top-level function in a file, with its body (up to the next top-level declaration).
function functionsIn(file: string): { exported: Fn[]; all: Map<string, string> } {
  const source = readFileSync(file, "utf8");
  const pattern = /^(export )?(?:async )?function (\w+)\(([^)]*)/gm;
  const found = [...source.matchAll(pattern)];
  const all = new Map<string, string>();
  const exported: Fn[] = [];
  found.forEach((match, i) => {
    const body = source.slice(match.index, found[i + 1]?.index ?? source.length);
    all.set(match[2], body);
    if (match[1]) exported.push({ file, name: match[2], params: match[3].trim(), body });
  });
  return { exported, all };
}

// The function's own body, plus the bodies of the file's own helpers it calls.
function reach(body: string, all: Map<string, string>): string {
  const called = [...all.keys()].filter((name) => new RegExp(`\\b${name}\\(`).test(body));
  return [body, ...called.map((name) => all.get(name) ?? "")].join("\n");
}

describe("server actions and routes", () => {
  const files = serverFiles();
  const checked = files.flatMap((file) => {
    const { exported, all } = functionsIn(file);
    return exported.map((fn) => ({ ...fn, reach: reach(fn.body, all) }));
  });

  it("finds them all", () => {
    expect(checked.length).toBeGreaterThan(40);
  });

  it("check sign-in or role on the server, unless listed as open to everyone", () => {
    const missing = checked.filter((fn) => !PUBLIC[`${fn.file}:${fn.name}`] && !AUTH.test(fn.reach)).map((fn) => `${fn.file}:${fn.name}`);
    expect(missing).toEqual([]);
  });

  it("check their input when they take any", () => {
    const takesInput = (fn: Fn) => fn.params !== "" && !/^_?\w*:\s*(NextRequest|Request)$/.test(fn.params) && fn.name !== "signOut";
    const routeParams = (fn: Fn) => /RouteContext|params/.test(fn.body);
    const missing = checked
      .filter((fn) => (takesInput(fn) || routeParams(fn)) && !VALIDATES.test(fn.reach))
      .map((fn) => `${fn.file}:${fn.name}`);
    expect(missing).toEqual([]);
  });

  it("lists only open actions that still exist", () => {
    const names = new Set(checked.map((fn) => `${fn.file}:${fn.name}`));
    expect(Object.keys(PUBLIC).filter((key) => !names.has(key))).toEqual([]);
  });
});
