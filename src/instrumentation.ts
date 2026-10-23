import type { Instrumentation } from "next";

// Every server error (pages, API routes, server actions, the proxy) is reported to Sentry for the
// founder's alerts (step 7e, rule I-04). The report is scrubbed first: see src/server/monitoring.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { reportError } = await import("@/server/monitoring/sentry");
  const err = error as { name?: unknown; message?: unknown; digest?: unknown } | null;
  await reportError({
    type: err?.name,
    message: typeof err?.message === "string" ? err.message : "Unknown error",
    // The route's file path (e.g. /documents/[id]), which holds no ids.
    path: context.routePath || request.path,
    source: "server",
    where: context.routeType,
    digest: typeof err?.digest === "string" ? err.digest : undefined,
  });
};
