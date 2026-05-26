import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, RefreshCw, ArrowLeft, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clearToken, getUser } from "@/lib/auth";

export default function CheckYourEmail() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  // Prefer ?email= param; fall back to stored user email from localStorage
  const email = params.get("email") || getUser()?.email || "";

  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  async function handleResend() {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.status === 429) {
        const wait = json.retryAfter ?? 60;
        setCooldown(wait);
        const interval = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        return;
      }
      toast({ title: "Email sent", description: "Check your inbox for a new verification link." });
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function handleBackToLogin() {
    clearToken();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-bold text-sm">Showgate</span>
          </div>
          <button
            onClick={handleBackToLogin}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-amber-400" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-2">Check your email</h1>
          <p className="text-zinc-400 text-sm mb-1">
            We sent a verification link to
          </p>
          {email && (
            <p className="text-amber-400 font-semibold text-sm mb-6 break-all">{email}</p>
          )}
          {!email && (
            <p className="text-zinc-500 text-sm mb-6">your registered email address.</p>
          )}
          <p className="text-zinc-500 text-sm mb-8">
            Click the link in the email to activate your account. The link expires in 24 hours.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={sending || cooldown > 0 || !email}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${sending ? "animate-spin" : ""}`} />
              {sending
                ? "Sending…"
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend verification email"}
            </button>

            <button
              onClick={handleBackToLogin}
              className="w-full py-3 rounded-xl text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
            >
              Use a different account
            </button>
          </div>

          <p className="text-zinc-600 text-xs mt-8">
            Can't find it? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}
