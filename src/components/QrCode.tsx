import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#0b1220ff", light: "#ffffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => setSrc(""));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-xl bg-white p-2"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="QR code to join this transfer" width={size - 16} height={size - 16} />
      ) : (
        <span className="text-xs text-neutral-500">Generating…</span>
      )}
    </div>
  );
}
