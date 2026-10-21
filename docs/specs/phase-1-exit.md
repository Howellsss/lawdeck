# Phase 1 exit check (2026-10-21)

Build Phases v1.1, Phase 1 exit checklist. Measured on a production build.

| Check | Result |
| --- | --- |
| Sign up, verify email, sign in | ✅ Done by the founder on lawdeck.vercel.app |
| Sign out, reset password | ⬜ To be tried by the founder on the live site |
| Google sign-in | ⬜ Waiting on the Client Secret in Supabase, then a founder test |
| Widths 360, 768, 1024, 1440 px | ✅ No sideways scrolling on home, sign-in, sign-up, forgot password, projects, courses, not-found. Phone layout at 360 and 768; sidebar from 1024 |
| Keyboard only | ✅ Every control reachable by Tab with a visible focus outline. Fixed: the message box had no outline; closing the phone menu with Escape lost focus (now returns to the menu button). Covered by `tests/e2e/keyboard.spec.ts` |
| Every table has row-level security; permission tests pass | ✅ 29 database checks (local PostgreSQL) and 10 real-project tests, on every pull request |
| Home usable in under 3 s on 4G | ✅ Slow-4G simulation (150 ms latency, 1.6 Mbps, 4× slower processor), 3 runs: fully loaded ≈ 2.1–2.2 s; main content visible ≈ 0.7 s |
| Initial JavaScript ≤ 1.5 MB | ✅ 155 KB (compressed) on home; 149 KB on sign-in |

Note: speed was measured against a server on the same machine. The live site adds the distance to Vercel's servers (typically a few hundred milliseconds from Nigeria), which still leaves room under 3 s. To re-measure on the live site once real students use it (Phase 7 monitoring).
