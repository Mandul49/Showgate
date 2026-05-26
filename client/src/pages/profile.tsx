import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { clearToken, getUser, isAuthenticated } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Ticket, Lock, EyeOff, Eye, ArrowLeft, Mail, ShieldAlert, Trash2, LogOut, UserCircle } from "lucide-react";
import { useEffect } from "react";
import sgLogo from "@assets/showgate-logo.png";

function PasswordInput({ field, placeholder }: { field: any; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
      <Input {...field} type={show ? "text" : "password"} placeholder={placeholder}
        className="pl-10 pr-10 bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
      <button type="button" onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors z-10">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

function ChangePasswordSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ChangePasswordForm) {
    setLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast({ title: "Password updated successfully." });
      form.reset();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-6 py-5 border-b border-zinc-800">
        <h2 className="text-white font-bold text-base">Change Password</h2>
        <p className="text-zinc-500 text-sm mt-0.5">Update your account password.</p>
      </div>
      <div className="px-6 py-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="currentPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Current Password</FormLabel>
                <FormControl><PasswordInput field={field} placeholder="Your current password" /></FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="newPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">New Password</FormLabel>
                <FormControl><PasswordInput field={field} placeholder="At least 8 characters" /></FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Confirm New Password</FormLabel>
                <FormControl><PasswordInput field={field} placeholder="Repeat new password" /></FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-50">
              {loading ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</> : "Update Password"}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ─── Change Email ─────────────────────────────────────────────────────────────

const changeEmailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
  currentPassword: z.string().min(1, "Password is required"),
});
type ChangeEmailForm = z.infer<typeof changeEmailSchema>;

function ChangeEmailSection() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const user = getUser();

  const form = useForm<ChangeEmailForm>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  async function onSubmit(data: ChangeEmailForm) {
    setLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/change-email", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast({ title: "Email updated.", description: "Please log in again with your new email." });
      clearToken();
      queryClient.clear();
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-6 py-5 border-b border-zinc-800">
        <h2 className="text-white font-bold text-base">Change Email</h2>
        <p className="text-zinc-500 text-sm mt-0.5">
          Update the email address on your account.
          {user?.email && <span className="text-zinc-600 ml-1">Current: <span className="text-zinc-400">{user.email}</span></span>}
        </p>
      </div>
      <div className="px-6 py-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="newEmail" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">New Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input {...field} type="email" placeholder="new@example.com"
                      className="pl-10 bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
                  </div>
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="currentPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Current Password</FormLabel>
                <FormControl><PasswordInput field={field} placeholder="Confirm with your password" /></FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-50">
              {loading ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</> : "Update Email"}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText === "DELETE" && password.length > 0;

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("DELETE", "/api/auth/account", { password });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      clearToken();
      queryClient.clear();
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-white font-black text-lg">Are you absolutely sure?</h2>
        </div>

        <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
          This will permanently delete your account, all your events, all ticket data, and your Paystack subaccount connection.
          Your attendees will no longer be able to access their tickets. <span className="text-red-400 font-semibold">This cannot be undone.</span>
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1.5">Type DELETE to confirm</label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1.5">Your Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Confirm your identity"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-10 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors z-10">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!canDelete || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</>
              : <><Trash2 className="w-3.5 h-3.5" /> Permanently Delete Account</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Account Section ───────────────────────────────────────────────────

function DeleteAccountSection() {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-red-500/20">
          <h2 className="text-red-400 font-bold text-base">Delete Account</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Permanently delete your account and all your data. This cannot be undone.</p>
        </div>
        <div className="px-6 py-5">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete My Account
          </button>
        </div>
      </div>
      {showModal && <DeleteAccountModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function Profile() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) navigate("/login");
    document.title = "Profile — Showgate";
    return () => { document.title = "Showgate"; };
  }, [navigate]);

  function handleLogout() {
    clearToken();
    queryClient.clear();
    navigate("/login");
  }

  const user = getUser();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Navbar */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Showgate<img src={sgLogo} alt="" className="inline-block h-[18px] w-auto ml-1.5 align-middle" /></h1>
              <p className="text-zinc-600 text-xs">Profile Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-colors text-xs font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-400/30 transition-colors text-xs font-semibold">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight">Profile Settings</h1>
            {user?.email && <p className="text-zinc-500 text-sm">{user.email}</p>}
          </div>
        </div>

        <div className="space-y-6">
          <ChangePasswordSection />
          <ChangeEmailSection />
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  );
}
