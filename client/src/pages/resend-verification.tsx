import { useState } from "react";
import { Ticket, Mail, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import sgLogo from "../assets/showgate-logo.png";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading || cooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
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
        toast({ title: "Slow down", description: json.message, variant: "destructive" });
        return;
      }

      if (json.alreadyVerified) {
        toast({ title: "Already verified", description: "This account is already verified. Please log in." });
        return;
      }

      setSentTo(email.trim());
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
            <a href="/" className="text-white font-bold text-sm hover:text-amber-400 transition-colors">Showgate</a>
            <img src={sgLogo} alt="" className="inline-block h-[18px] w-auto ml-1.5 align-middle" />
          </div>
          <a href="/login" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </a>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {sentTo ? (
            /* Success state — mirrors check-your-email UI */
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-amber-400" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2">Check your email</h1>
              <p className="text-zinc-400 text-sm mb-1">We sent a verification link to</p>
              <p className="text-amber-400 font-semibold text-sm mb-6 break-all">{sentTo}</p>
              <p className="text-zinc-500 text-sm mb-8">
                Click the link in the email to activate your account. The link expires in 24 hours.
              </p>
              <div className="flex items-center gap-2 justify-center text-green-400 text-sm font-semibold mb-6">
                <CheckCircle2 className="w-4 h-4" /> Verification email sent
              </div>
              <a href="/login" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                Back to login
              </a>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-amber-400" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Resend verification email</h1>
                <p className="text-zinc-500 text-sm mt-1.5">Enter your email and we'll send a fresh link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0 || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-60 mt-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading
                    ? "Sending…"
                    : cooldown > 0
                    ? `Wait ${cooldown}s`
                    : "Send Verification Link"}
                </button>
              </form>

              <p className="text-center text-zinc-700 text-xs mt-6">
                Already verified?{" "}
                <a href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
