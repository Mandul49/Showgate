import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";

type ScanResult = { result: "ok" | "used" | "invalid" | "unpaid" | "error"; message: string; name?: string; buyerName?: string; ticketType?: string; checkedIn?: number; total?: number };

export default function QrScanner({ eventId, onScanned, onClose }: { eventId: string; onScanned: () => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const submit = async (code: string) => {
      busy.current = true;
      try {
        const res = await fetch(`/api/analytics/${eventId}/scan`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const json = await res.json();
        setResult(res.ok || json.result ? json : { result: "error", message: json.message ?? "Scan failed" });
        if (res.ok) { onScanned(); navigator.vibrate?.(100); }
      } catch {
        setResult({ result: "error", message: "You're offline. Scanning needs a connection." });
      }
      // Pause so the same code isn't rescanned instantly
      setTimeout(() => { busy.current = false; }, 1500);
    };

    const tick = () => {
      const v = videoRef.current;
      if (!stopped && v && v.readyState === v.HAVE_ENOUGH_DATA && !busy.current) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height);
        if (hit?.data && !(hit.data === last.current.code && Date.now() - last.current.at < 3000)) {
          last.current = { code: hit.data, at: Date.now() };
          submit(hit.data);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setCamError("Camera unavailable. Allow camera access (HTTPS required)."));

    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [eventId]);

  const ok = result?.result === "ok";
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-white font-semibold text-sm">Scan ticket QR</span>
        <button onClick={onClose} aria-label="Close scanner" className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {camError && <p className="absolute inset-0 flex items-center justify-center text-center text-red-400 text-sm px-8">{camError}</p>}
      </div>
      <div className={`px-4 py-5 text-center ${!result ? "bg-zinc-900" : ok ? "bg-green-600" : "bg-red-600"}`}>
        {!result ? <p className="text-zinc-400 text-sm">Point the camera at a ticket QR code</p> : (
          <>
            <p className="text-white font-black text-lg">{ok ? "Checked in" : result.message}</p>
            {result.buyerName && (
              <p className="text-white/90 text-sm mt-1">
                {result.name ?? result.buyerName} · {result.ticketType} · {result.checkedIn}/{result.total} in
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
