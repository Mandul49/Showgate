import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, Ticket } from "lucide-react";
import { setToken, saveUser } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import sgLogo from "@assets/showgate-logo.png";

type Status = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please use the link from your email.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(json.message || "Verification failed.");
          return;
        }
        // Store the new JWT and user
        queryClient.clear();
        setToken(json.token);
        saveUser(json.user);
        setStatus("success");
        // Navigate to onboarding after a short delay so the user sees the success state
        setTimeout(() => navigate("/onboarding?verified=1"), 1800);
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-bold text-sm">Showgate</span>
            <img src={sgLogo} alt="" className="inline-block h-[18px] w-auto ml-1.5 align-middle" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2">Verifying your email…</h1>
              <p className="text-zinc-500 text-sm">Just a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2">Email verified!</h1>
              <p className="text-zinc-400 text-sm">
                Your account is active. Taking you to setup…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2">Verification failed</h1>
              <p className="text-zinc-400 text-sm mb-8">{message}</p>
              <a
                href="/login"
                className="inline-block px-6 py-3 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 transition-colors"
              >
                Back to login
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
