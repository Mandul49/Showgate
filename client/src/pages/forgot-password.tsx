import { useState } from "react";
import { Link } from "wouter";
import { ShowgateLogo } from "@/components/showgate-logo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Request failed");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-bold text-sm">Showgate<ShowgateLogo size={16} /></span>
          </div>
          <a href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </a>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
              {submitted ? <CheckCircle2 className="w-7 h-7 text-amber-400" /> : <KeyRound className="w-7 h-7 text-amber-400" />}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {submitted ? "Check your email" : "Reset your password"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              {submitted
                ? "If that email is registered, a reset link has been sent. The link expires in 1 hour."
                : "Enter your account email and we will send you a reset link."}
            </p>
          </div>

          {!submitted ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
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
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Sending...</> : "Send Reset Link"}
                </button>
              </form>
            </Form>
          ) : (
            <button onClick={() => { setSubmitted(false); form.reset(); }}
              className="w-full py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 font-bold text-sm transition-colors">
              Send another link
            </button>
          )}

          <p className="text-center text-zinc-700 text-xs mt-6">
            Remember your password? <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
