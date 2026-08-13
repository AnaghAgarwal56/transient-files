import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How DataTransfer Works — Temporary Rooms, PINs and QR Codes" },
      {
        name: "description",
        content:
          "Create a room, upload a file, share the code or QR, download on the other device, then confirm deletion. Here is exactly what happens at each step.",
      },
      { property: "og:title", content: "How DataTransfer Works" },
      {
        property: "og:description",
        content:
          "Create a room, upload, share the QR, download, expire, confirm deletion — the full temporary transfer flow.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  { title: "Create a room", body: "Pick an expiry and how many devices may join. We generate a 6-character room ID and a 4-digit PIN using cryptographically secure randomness." },
  { title: "Upload your files", body: "Drag and drop. Files go straight into private encrypted storage with a one-time signed upload URL — never into a public folder." },
  { title: "Share the code or QR", body: "Copy the room ID and PIN, or let the other device scan the QR code. The QR contains only the temporary room reference." },
  { title: "Other device joins", body: "The room ID plus PIN creates a temporary participant session. PIN attempts are rate-limited and lock out after repeated failures." },
  { title: "Download", body: "Every download is authorized server-side and served through a short-lived signed link scoped to that one file." },
  { title: "Room expires", body: "When the countdown hits zero the credentials stop working. Your files are still stored — just unreachable." },
  { title: "Confirm deletion", body: "Files are permanently deleted once the room's deletion condition is met, or automatically when the retention window elapses." },
];

const SECURITY = [
  "PINs are never stored in plaintext — only a salted SHA-256 hash.",
  "Session tokens are 256-bit random values; only their hash is stored.",
  "Room IDs are random, not sequential, so they cannot be guessed in order.",
  "All file reads and writes are authorized on the server against your session.",
  "File size, extension and MIME type are validated before an upload is allowed.",
  "Uploaded files are stored as inert objects and are never executed.",
];

function HowItWorks() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold sm:text-4xl">How it works</h1>
      <p className="mt-3 text-muted-foreground">
        Seven steps, no account, no installs. The whole flow is designed to leave nothing behind.
      </p>

      <ol className="mt-10 space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="panel flex gap-4 p-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-mono text-sm text-primary">
              {index + 1}
            </span>
            <div>
              <h2 className="text-base font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl font-semibold">Security details</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {SECURITY.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/create">Start a transfer</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/join">Join a transfer</Link>
        </Button>
      </div>
    </main>
  );
}
