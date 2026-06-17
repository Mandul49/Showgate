import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { setToken, saveUser } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Ticket, Mail, Lock, EyeOff, Eye, ArrowLeft, Zap } from "lucide-react";
import sgLogo from "../assets/showgate-logo.png";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

function PasswordInput({ field, placeholder }: { field: any; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
      <Input {...field} type={show ? "text" : "password"} placeholder={placeholder}
        className="pl-10 pr-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
      <button type="button" onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors z-10">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function Login() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function checkOnboardingAndNavigate(token: string, role?: string) {
    if (role === "admin") {
      navigate("/admin");
      return;
    }
    try {
      const statusRes = await fetch("/api/onboarding/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await statusRes.json();
      navigate(status.completed ? "/dashboard" : "/onboarding");
    } catch {
      navigate("/onboarding");
    }
  }

  async function handleLogin(data: LoginForm) {
    setLoading(true);
    setEmailNotVerified(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.emailNotVerified) {
          setEmailNotVerified(true);
          setUnverifiedEmail(json.email ?? data.email);
          return;
        }
        throw new Error(json.message);
      }
      queryClient.clear();
      setToken(json.token);
      saveUser(json.user);
      await checkOnboardingAndNavigate(json.token, json.user?.role);
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const json = await res.json();
      if (res.status === 429) {
        toast({ title: "Too soon", description: json.message, variant: "destructive" });
      } else {
        toast({ title: "Verification email sent!", description: "Check your inbox." });
      }
    } catch {
      toast({ title: "Failed to resend", description: "Please try again.", variant: "destructive" });
    }
  }

  async function handleSignup(data: SignupForm) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      queryClient.clear();
      setToken(json.token);
      saveUser(json.user);
      await checkOnboardingAndNavigate(json.token);
    } catch (err: any) {
      toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
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
            <span className="text-white font-bold text-sm">Showgate</span>
            <img src={sgLogo} alt="" className="inline-block h-[18px] w-auto ml-1.5 align-middle" />
          </div>
          <a href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </a>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {tab === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              {tab === "login" ? "Sign in to manage your event" : "Set up your event ticketing page in minutes"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-6">
            {(["login", "signup"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === t ? "bg-amber-400 text-black" : "text-zinc-500 hover:text-zinc-300"}`}>
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Login Form */}
          {tab === "login" && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input {...field} type="email" placeholder="you@example.com"
                          className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Password</FormLabel>
                      <a href="/forgot-password" className="text-amber-400 hover:text-amber-300 text-xs transition-colors">
                        Forgot password?
                      </a>
                    </div>
                    <FormControl><PasswordInput field={field} placeholder="Your password" /></FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Signing in...</> : "Sign In"}
                </button>
              </form>
            </Form>
          )}

          {/* Email-not-verified banner */}
          {tab === "login" && emailNotVerified && (
            <div className="mt-4 p-4 rounded-xl bg-amber-400/10 border border-amber-400/20 text-sm text-zinc-300 leading-relaxed">
              Please check your inbox and verify your email. Didn't get it?{" "}
              {resendCooldown > 0 ? (
                <span className="text-zinc-500">Resend in {resendCooldown}s...</span>
              ) : (
                <button type="button" onClick={handleResend}
                  className="text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2">
                  Resend verification email
                </button>
              )}
            </div>
          )}

          {/* Signup Form */}
          {tab === "signup" && (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <FormField control={signupForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input {...field} type="email" placeholder="you@example.com"
                          className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
                <FormField control={signupForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Password</FormLabel>
                    <FormControl><PasswordInput field={field} placeholder="At least 8 characters" /></FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
                <FormField control={signupForm.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Confirm Password</FormLabel>
                    <FormControl><PasswordInput field={field} placeholder="Repeat your password" /></FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Creating account...</> : "Create Account"}
                </button>
              </form>
            </Form>
          )}

          <p className="text-center text-zinc-700 text-xs mt-6">
            {tab === "login"
              ? <>Don't have an account? <button type="button" onClick={() => setTab("signup")} className="text-amber-400 hover:text-amber-300 transition-colors">Sign up free</button></>
              : <>Already have an account? <button type="button" onClick={() => setTab("login")} className="text-amber-400 hover:text-amber-300 transition-colors">Sign in</button></>
            }
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-900 px-4 py-6">
        <p className="text-center text-zinc-800 text-xs">Your event data stays private. No spam, ever.</p>
      </div>
    </div>
  );
}
