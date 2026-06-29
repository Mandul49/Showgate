import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { setToken, saveUser } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Ticket, Mail, Lock, EyeOff, Eye, ArrowLeft, Zap, ScrollText } from "lucide-react";
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

const AGREEMENT_TEXT = `SHOWGATE
PRIVACY POLICY
Effective Date: 26 June 2026 | Last Updated: June 2026

Platform: showgate.ng | Contact: hello@showgate.ng

1. Introduction
Showgate ("we", "our", or "us") operates the event ticketing and management platform accessible via showgate.ng, its mobile applications, and associated services (collectively, the "Platform"). Showgate is domiciled in Jos, Plateau State, Nigeria.
We are committed to safeguarding the privacy of our users and ensuring the security of the personal data entrusted to us. This Privacy Policy details our practices regarding the collection, use, disclosure, and protection of your personal data when you interact with our Platform.
This Policy is formulated and governed in strict accordance with the Nigeria Data Protection Act 2023 (NDPA) and the General Application and Implementation Directive (GAID) 2025, issued by the Nigeria Data Protection Commission (NDPC). It is also informed by international data protection best practices, including the EU General Data Protection Regulation (GDPR), where applicable to cross-border data processing.
By accessing or utilizing the Platform, you acknowledge that you have read, understood, and agreed to the terms outlined in this Privacy Policy.

2. Data Controller Information
For the purposes of the NDPA, Showgate acts as the Data Controller responsible for determining the purposes and means of processing your personal data.
Entity Name: Showgate | Headquarters: Jos, Plateau State, Nigeria | Official Email: hello@showgate.ng | Website: showgate.ng

3. Categories of Personal Data Collected
We collect personal data through voluntary user submission, automated background tracking, and authorized third-party integrations.

3.1 Data Provided Directly by the User
Identity Data: Full name, profile configurations, and event organizer credentials.
Contact Data: Email address, telephone number, and billing address.
Transaction Data: Ticket preferences, order histories, and purchase metadata.
Financial Data: Payment processing details. Note: Financial transactions are securely managed via our payment gateway partner, Paystack. Showgate does not store or have direct access to your card details or banking credentials.

3.2 Data Collected Automatically
Technical Data: Internet Protocol (IP) address, device type, browser specifications, and operating system.
Usage Data: URL clickstreams, page dwell time, navigation paths, and platform interaction behavior.
Tracking Data: Essential and non-essential cookies and session identifiers.

3.3 Data Inherited from Third Parties
Payment Verification: Transaction confirmation data transmitted securely from Paystack.
Communication Analytics: Delivery, bounce, and open/click telemetry from Brevo (our transactional email processor).

4. Lawful Bases and Purposes of Processing
In compliance with the NDPA, we process personal data under the following legitimate legal frameworks:
Performance of Contract: Provision of core ticketing infrastructure and digital ticket issuance. Delivery of booking confirmations, receipt notes, and event updates. Facilitation of attendee management and check-in tools for event organizers.
Consent: Delivery of promotional marketing, newsletters, and tailored updates. Deployment of non-essential cookies for behavioral analytics and optimization.
Legitimate Interests: Continuous enhancement of Platform performance, interface, and features. Diagnostics, system security auditing, and fraud prevention protocols. Resolution of user disputes and enforcement of our Terms of Service.
Legal Obligation: Adherence to statutory tax, corporate, and financial reporting duties under Nigerian law. Compliance with lawful subpoenas, regulatory audits, or judicial demands.

5. Information Sharing and Disclosure
Showgate does not sell, rent, or trade your personal data to third parties. We disclose data strictly to optimize platform operations, fulfill legal obligations, or finalize contractual agreements.

5.1 Authorized Third-Party Data Processors
We engage specialized service providers bound by strict confidentiality and Data Processing Agreements (DPAs) in compliance with the NDPA:
Paystack: Payment infrastructure (PCI-DSS compliant).
Brevo (formerly Sendinblue): Transactional email delivery services.
Supabase: Backend architectural infrastructure and database storage.
Vercel: Frontend hosting and content delivery deployment.
Railway: Specialized backend application server hosting.

5.2 Disclosure to Event Organizers
When you register for or purchase a ticket to an event, relevant personal data (name, email address, and ticket metadata) is shared with the designated Event Organizer. This data is provided exclusively to facilitate event logistics, entry access control, and direct event-related updates.

5.3 Statutory and Legal Disclosures
We reserve the right to disclose personal data to law enforcement, regulatory bodies, or judicial authorities if mandated by law, or if such action is deemed reasonably necessary to protect the safety, rights, and property of Showgate, its users, or the general public.

6. Cross-Border Data Transfers
Certain cloud infrastructure providers utilized by Showgate (e.g., Supabase, Vercel, Brevo) maintain server networks outside the Federal Republic of Nigeria. Where cross-border data transfer occurs, Showgate ensures that adequate safeguards are enforced to maintain data protection levels equivalent to the requirements under the NDPA. By utilizing the Platform, you acknowledge and consent to these cross-border processing operations.

7. Data Retention Policy
We retain your personal data only for the duration necessary to fulfill the purposes for which it was collected, as well as to satisfy legal, regulatory, or accounting requirements.
Financial & Transactional Records: Retained for a minimum of 6 years to comply with financial audits and corporate tax regulations.
Event & Attendee Data: Retained for 2 years post-event date to resolve prospective ticket disputes or compliance inquiries.
Marketing Data: Retained indefinitely until consent is explicitly withdrawn or an unsubscribe request is executed.
Technical Framework Logs: Retained for up to 12 months for security profiling and infrastructure monitoring.
Upon expiration of the retention windows, data is permanently destroyed or irreversibly anonymized.

8. Data Subject Rights
As a data subject under the NDPA, you possess comprehensive rights regarding your personal information. These include:
Right of Access: Request and obtain confirmation of whether we process your data, alongside a copy of that data.
Right to Rectification: Amend or correct inaccurate or incomplete personal records.
Right to Erasure ("Right to be Forgotten"): Request data deletion where statutory obligations do not supersede the request.
Right to Restriction of Processing: Suspend active data processing under specific verification conditions.
Right to Data Portability: Receive your personal data in a structured, machine-readable format for transfer to another controller.
Right to Object: Contest processing operations founded on our legitimate interests or direct marketing initiatives.
Right to Withdraw Consent: Revoke processing consent at any time, without affecting the lawfulness of processing handled prior to withdrawal.
To submit a formal rights request, please email hello@showgate.ng. We are legally obligated to verify your identity before processing requests and will issue a definitive response within 30 days of receipt.

9. Cookies and Tracking Technologies
The Platform utilises cookies and similar tracking pixels to optimise user sessions, preserve system state preferences, analyse traffic trends, and implement anti-fraud defences.
Essential cookies are deployed automatically to sustain platform functionality. Non-essential cookies (such as analytics cookies) will only be activated with your explicit consent via our cookie notification banner. You can manage or disable cookie configurations via your browser settings; however, certain aspects of the Platform may lose functionality as a result.

10. Data Security Architecture
Showgate applies institutional, technical, and physical security measures designed to protect personal data against unauthorised access, alteration, disclosure, or destruction. Key protocols include:
End-to-end encryption of data in transit via HTTPS/TLS protocols.
Restricted database access controls utilising enterprise-grade authentication via Supabase.
Exclusion of raw financial instrument handling by delegating processing to PCI-DSS compliant gateways (Paystack).
Enforcement of a "need-to-know" internal data access privilege policy for Showgate personnel.
Data Breach Notification: In the highly unlikely event of a security breach compromising your personal data and posing a high risk to your rights, Showgate will formally report the incident to the NDPC within 72 hours and notify affected users without undue delay, outlining mitigating steps taken.

11. Children's Privacy Protection
Our Platform is designed for use by individuals who are at least 13 years of age. Showgate does not knowingly collect or solicit personal data from children under the age of 13. If we discover that personal data has been inadvertently harvested from a child under 13, we will delete the record immediately. If you suspect a minor has provided us with unauthorised personal information, please alert us at hello@showgate.ng.

12. Amendments to this Privacy Policy
We reserve the right to modify or replace this Privacy Policy at our discretion to accommodate changes in law, business practices, or technical developments. Material adjustments will be communicated by updating the policy text on this page alongside a modified "Last Updated" timestamp, supplemented by direct email notifications to registered platform users where appropriate. Continued engagement with our Platform following an update denotes formal acceptance of the revised policy terms.

13. Contact Us & Regulatory Recourse
For comprehensive inquiries regarding this Policy, or to submit feedback regarding our data handling mechanisms, please contact our data compliance team:
Email: hello@showgate.ng | Digital Portal: showgate.ng
Should you feel that Showgate has handled your data unlawfully or failed to resolve a grievance adequately, you retain the statutory right to lodge an official complaint with the Nigeria Data Protection Commission (NDPC):
Web Portal: ndpc.gov.ng | Official Correspondence: info@ndpc.gov.ng`;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function LicenseAgreementModal({
  open,
  onDecline,
  onAccept,
  loading,
}: {
  open: boolean;
  onDecline: () => void;
  onAccept: () => void;
  loading: boolean;
}) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHasScrolledToBottom(false);
      setAgreed(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        setHasScrolledToBottom(true);
      }
    };
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const modalEl = modalRef.current;
    if (!modalEl) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableEls = () => Array.from(modalEl.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusableEls()[0];
    if (first) first.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDecline();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusableEls();
      if (els.length === 0) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onDecline]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onDecline} />
      <div
        ref={modalRef}
        className="relative w-full max-w-lg flex flex-col rounded-2xl border border-zinc-700 shadow-2xl"
        style={{ backgroundColor: "#111111", maxHeight: "90vh" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <ScrollText className="w-4 h-4 text-amber-400" />
          </div>
          <h2 id="license-title" className="text-white font-black text-base tracking-tight">
            License Agreement
          </h2>
        </div>

        {/* Scrollable body */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-6 py-4 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap"
            style={{ maxHeight: "50vh" }}
          >
            {AGREEMENT_TEXT}
          </div>
          {!hasScrolledToBottom && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#111111] to-transparent" />
          )}
        </div>

        {/* Checkbox */}
        <div className="px-6 pt-4 pb-2 border-t border-zinc-800 shrink-0">
          {!hasScrolledToBottom && (
            <p className="text-zinc-500 text-xs mb-3 text-center">
              Scroll to the bottom to enable the checkbox
            </p>
          )}
          <label className={`flex items-start gap-3 cursor-pointer ${!hasScrolledToBottom ? "opacity-40 pointer-events-none select-none" : ""}`}>
            <input
              type="checkbox"
              checked={agreed}
              disabled={!hasScrolledToBottom}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-zinc-600 accent-amber-400 cursor-pointer shrink-0"
            />
            <span className="text-zinc-300 text-sm leading-snug">
              I have read and agree to the{" "}
              <span className="text-amber-400 font-semibold">License Agreement</span>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5 pt-3 shrink-0">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 font-bold text-sm transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!agreed || loading}
            className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              "Accept & Sign Up"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<SignupForm | null>(null);
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
      setLicenseOpen(false);
    }
  }

  function handleSignupSubmit(data: SignupForm) {
    setPendingSignup(data);
    setLicenseOpen(true);
  }

  function handleLicenseDecline() {
    setLicenseOpen(false);
    setPendingSignup(null);
  }

  function handleLicenseAccept() {
    if (pendingSignup) handleSignup(pendingSignup);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      <LicenseAgreementModal
        open={licenseOpen}
        onDecline={handleLicenseDecline}
        onAccept={handleLicenseAccept}
        loading={loading}
      />

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
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">
                Please verify your email address. Didn't get the email?
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s...` : "Resend Verification Email"}
              </button>
            </div>
          )}

          {/* Signup Form */}
          {tab === "signup" && (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)} className="space-y-4">
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
