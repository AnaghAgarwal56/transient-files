import { createFileRoute } from "@tanstack/react-router";

// Retention sweep: marks elapsed rooms expired and permanently deletes files
// whose retention window has passed. Called on a schedule with the project's
// publishable key in the `apikey` header.
export const Route = createFileRoute("/api/public/hooks/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!key || !expected || key !== expected) {
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
