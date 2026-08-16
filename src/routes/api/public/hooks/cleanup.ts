import { createFileRoute } from "@tanstack/react-router";

// Retention sweep: marks elapsed rooms expired and permanently deletes files
// whose retention window has passed. Called on a schedule with a server-only
// secret in the `x-cleanup-secret` header (or `Authorization: Bearer <secret>`).
export const Route = createFileRoute("/api/public/hooks/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CLEANUP_CRON_SECRET"];
        const provided =
          request.headers.get("x-cleanup-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          null;
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { runCleanup } = await import("@/lib/transfer-core.server");
        const result = await runCleanup();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
