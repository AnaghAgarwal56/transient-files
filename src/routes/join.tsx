import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, LogIn, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSession } from "@/lib/session";
import { joinTransferFn } from "@/lib/transfers.functions";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a Transfer — DataTransfer" },
      {
        name: "description",
        content:
          "Enter a room ID and access PIN, or scan the QR code, to join a temporary DataTransfer room and download files.",
      },
      { property: "og:title", content: "Join a Transfer — DataTransfer" },
      {
        property: "og:description",
        content: "Join a temporary transfer room with a room ID and PIN, or by scanning a QR code.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { room?: string } =>
    typeof search["room"] === "string"
      ? { room: search["room"].toUpperCase().slice(0, 12) }
      : {},

  component: JoinPage,
});

function JoinPage() {
  const { room } = Route.useSearch();
  const navigate = useNavigate();
  const joinFn = useServerFn(joinTransferFn);

  const [roomId, setRoomId] = useState(room ?? "");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (room) setRoomId(room);
  }, [room]);

  const mutation = useMutation({
    mutationFn: async () => joinFn({ data: { roomId, pin, displayName } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      saveSession({
        roomId: result.data.roomId,
        token: result.data.token,
        displayName: result.data.displayName,
      });
      navigate({ to: "/room/$roomId", params: { roomId: result.data.roomId } });
    },
    onError: () => toast.error("Network error — could not reach the server."),
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold">Join Transfer</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use the room ID and PIN from the other device, or scan its QR code.
      </p>

      <form
        className="panel mt-8 space-y-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Room ID</Label>
          <Input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="X7K92A"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            maxLength={12}
            className="code-chip h-14 text-center text-2xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Access PIN</Label>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="4816"
            inputMode="numeric"
            autoComplete="off"
            className="code-chip h-14 text-center text-2xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Display name (optional)
          </Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Auto: User-4821"
            maxLength={24}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={mutation.isPending || roomId.length < 4 || pin.length < 4}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 size-4" />
          )}
          Join Room
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={() => setScanning(true)}
        >
          <Camera className="mr-2 size-4" /> Scan QR Code
        </Button>
      </form>

      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(text) => {
            setScanning(false);
            const match = text.match(/room=([A-Za-z0-9]{4,12})/);
            const code = match ? match[1]! : text.trim().toUpperCase();
            if (/^[A-Z0-9]{4,12}$/.test(code.toUpperCase())) {
              setRoomId(code.toUpperCase());
              toast.success("Room ID captured — now enter the PIN.");
            } else {
              toast.error("That QR code isn't a DataTransfer room.");
            }
          }}
        />
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need a new room?{" "}
        <Link to="/create" className="text-primary hover:underline">
          Create a transfer
        </Link>
      </p>
    </main>
  );
}

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

function QrScanner({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const Detector = (
      window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector;

    async function start() {
      if (!Detector) {
        setError(
          "This browser can't scan QR codes in-page. Open your camera app, scan the code, and follow the link.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length && codes[0]) {
              onResult(codes[0].rawValue);
              return;
            }
          } catch {
            /* keep scanning */
          }
          raf = window.requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setError("Camera access was blocked. Enter the room ID manually instead.");
      }
    }
    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 p-4 backdrop-blur">
      <div className="panel w-full max-w-sm overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Scan QR code</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close scanner">
            <X className="size-4" />
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-primary/40">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          </div>
        )}
      </div>
    </div>
  );
}
