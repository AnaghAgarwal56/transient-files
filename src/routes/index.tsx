import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock,
  Laptop,
  Lock,
  QrCode as QrIcon,
  Server,
  Shield,
  Smartphone,
  Trash2,
  UserX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DataTransfer — Transfer Files. Temporarily. Securely." },
      {
        name: "description",
        content:
          "Create a temporary, accountless transfer room with a room ID, PIN and QR code. Move files between phones and computers without signing into your personal accounts.",
      },
      { property: "og:title", content: "DataTransfer — Transfer Files. Temporarily. Securely." },
      {
        property: "og:description",
        content:
          "Temporary, accountless file transfer between phones and computers. Room ID, PIN, QR code, automatic expiry.",
      },
    ],
  }),
  component: Landing,
});

const SECURITY = [
  { icon: UserX, title: "No permanent account", body: "No email, no password, no social login. Just a room and a PIN." },
  { icon: Clock, title: "Temporary access", body: "Credentials stop working the moment the room expires." },
  { icon: Lock, title: "Encrypted transfer", body: "Everything travels over TLS and is stored encrypted at rest." },
  { icon: Trash2, title: "Automatic expiration", body: "Rooms close on a timer; files are purged after retention." },
  { icon: QrIcon, title: "QR-code joining", body: "Scan with a phone camera to land straight on the join screen." },
  { icon: Shield, title: "Deletion you control", body: "Files stay protected after expiry until deletion is confirmed." },
];

function Landing() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora absolute inset-0 -z-10" />
        <div className="grid-backdrop absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Shield className="size-3.5" /> Accountless · Temporary · Encrypted
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Transfer Files.
              <br />
              Temporarily. Securely.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Move files between phones and computers without logging into your personal accounts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/create">
                  Start Transfer <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/create" search={{ shared: true }}>
                  Create Shared Room
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/how-it-works">How It Works</Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              Don&apos;t log in. Don&apos;t carry a USB. Create a temporary secure space, transfer
              what you need, and leave.
            </p>
          </div>

          <div className="panel relative flex flex-col justify-center gap-8 p-6 sm:p-8">
            <FlowRow
              from={{ icon: Smartphone, label: "Phone" }}
              to={[{ icon: Laptop, label: "Computer" }]}
              caption="Phone → DataTransfer → Computer"
            />
            <div className="h-px bg-border" />
            <FlowRow
              from={{ icon: Laptop, label: "Computer" }}
              to={[
                { icon: Smartphone, label: "Phone" },
                { icon: Laptop, label: "Laptop" },
                { icon: Smartphone, label: "Tablet" },
              ]}
              caption="Computer → DataTransfer → Multiple devices"
            />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-t border-border bg-surface/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">Built to be forgotten</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every room is disposable by design. Access is short-lived, authorization happens on the
            server, and nothing you upload is reachable without the temporary credentials.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((item) => (
              <div key={item.title} className="panel p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <item.icon className="size-4.5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-5 lg:grid-cols-2">
          <ModeCard
            icon={Server}
            eyebrow="Mode A"
            title="Personal transfer"
            body="Upload from the shared computer you're stuck on, then pull the file down on your own phone. One room, one PIN, gone in hours."
            example={["Room ID: X7K92A", "Access PIN: 4816", "Expires: 4 hours"]}
            cta="Start transfer"
            to="/create"
          />
          <ModeCard
            icon={Users}
            eyebrow="Mode B"
            title="Temporary shared room"
            body="Spin up a room for 2–10 people, share the code, and let everyone drop files in for a limited window."
            example={["Room ID: TEAM72", "Access PIN: 8391", "Expires: 4 hours", "Max users: 5"]}
            cta="Create shared room"
            to="/create"
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <span>DataTransfer — temporary, accountless file transfer.</span>
          <Link to="/how-it-works" className="sm:ml-auto hover:text-foreground">
            How it works
          </Link>
        </div>
      </footer>
    </main>
  );
}

function FlowRow({
  from,
  to,
  caption,
}: {
  from: { icon: React.ElementType; label: string };
  to: { icon: React.ElementType; label: string }[];
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-4">
        <Node icon={from.icon} label={from.label} />
        <Dashes />
        <div className="float-slow flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
          <Shield className="size-6" />
        </div>
        <Dashes />
        <div className="flex flex-col gap-2">
          {to.map((node) => (
            <Node key={node.label} icon={node.icon} label={node.label} small={to.length > 1} />
          ))}
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

function Node({
  icon: Icon,
  label,
  small,
}: {
  icon: React.ElementType;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
      <Icon className={small ? "size-3.5" : "size-4"} />
      <span className={small ? "text-[11px]" : "text-xs"}>{label}</span>
    </div>
  );
}

function Dashes() {
  return <div className="h-px flex-1 border-t border-dashed border-primary/40" />;
}

function ModeCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  example,
  cta,
  to,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  body: string;
  example: string[];
  cta: string;
  to: string;
}) {
  return (
    <div className="panel flex flex-col p-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <span className="mt-4 font-mono text-[11px] uppercase tracking-widest text-primary">
        {eyebrow}
      </span>
      <h3 className="mt-1 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-6 text-muted-foreground">
        {example.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <Button asChild variant="secondary" className="mt-5 self-start">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
