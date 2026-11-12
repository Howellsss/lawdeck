// "Now" for test pages' sample messages: never earlier than 03:00 today, Nigerian time (WAT, UTC+1),
// so "a few minutes ago" is always Today and "26 hours ago" Yesterday, whatever time the tests run
// (the browser tests failed when run just after midnight WAT).
const WAT_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function sampleNow(now = Date.now()): number {
  const watMidnight = Math.floor((now + WAT_MS) / DAY_MS) * DAY_MS - WAT_MS;
  return Math.max(now, watMidnight + 3 * 3_600_000);
}
