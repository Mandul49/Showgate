import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { setToken, saveUser } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Ticket, Mail, Lock, EyeOff, Eye, ArrowLeft, Zap, X, ScrollText } from "lucide-react";
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

function LicenseAgreementModal({
  onDecline,
  onAccept,
  loading,
}: {
  onDecline: () => void;
  onAccept: () => void;
  loading: boolean;
}) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setScrolledToBottom(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <ScrollText className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-base">License Agreement</h2>
              <p className="text-zinc-500 text-xs">Please read carefully before signing up</p>
            </div>
          </div>
          <button type="button" onClick={onDecline}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-1 rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable agreement text */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 text-zinc-300 text-sm leading-relaxed space-y-5 min-h-0"
        >
          <div className="text-center border-b border-zinc-800 pb-4">
            <p className="text-white font-black text-lg tracking-tight">SHOWGATE</p>
            <p className="text-amber-400 font-bold text-sm mt-1">PRIVACY POLICY</p>
            <p className="text-zinc-500 text-xs mt-2">Effective Date: 26 June 2026 &nbsp;|&nbsp; Last Updated: June 2026</p>
            <p className="text-zinc-500 text-xs">Platform: showgate.ng &nbsp;|&nbsp; Contact: hello@showgate.ng</p>
          </div>

          <section>
            <h3 className="text-white font-bold mb-2">1. Introduction</h3>
            <p>Showgate ("we", "our", or "us") operates the event ticketing and management platform accessible via showgate.ng, its mobile applications, and associated services (collectively, the "Platform"). Showgate is domiciled in Jos, Plateau State, Nigeria.</p>
            <p className="mt-2">We are committed to safeguarding the privacy of our users and ensuring the security of the personal data entrusted to us. This Privacy Policy details our practices regarding the collection, use, disclosure, and protection of your personal data when you interact with our Platform.</p>
            <p className="mt-2">This Policy is formulated and governed in strict accordance with the Nigeria Data Protection Act 2023 (NDPA) and the General Application and Implementation Directive (GAID) 2025, issued by the Nigeria Data Protection Commission (NDPC). It is also informed by international data protection best practices, including the EU General Data Protection Regulation (GDPR), where applicable to cross-border data processing.</p>
            <p className="mt-2">By accessing or utilizing the Platform, you acknowledge that you have read, understood, and agreed to the terms outlined in this Privacy Policy.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">2. Data Controller Information</h3>
            <p>For the purposes of the NDPA, Showgate acts as the Data Controller responsible for determining the purposes and means of processing your personal data.</p>
            <ul className="mt-2 space-y-1 text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Entity Name:</span> Showgate</li>
              <li><span className="text-zinc-300 font-medium">Headquarters:</span> Jos, Plateau State, Nigeria</li>
              <li><span className="text-zinc-300 font-medium">Official Email:</span> hello@showgate.ng</li>
              <li><span className="text-zinc-300 font-medium">Website:</span> showgate.ng</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">3. Categories of Personal Data Collected</h3>
            <p>We collect personal data through voluntary user submission, automated background tracking, and authorized third-party integrations.</p>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">3.1 Data Provided Directly by the User</h4>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Identity Data:</span> Full name, profile configurations, and event organizer credentials.</li>
              <li><span className="text-zinc-300 font-medium">Contact Data:</span> Email address, telephone number, and billing address.</li>
              <li><span className="text-zinc-300 font-medium">Transaction Data:</span> Ticket preferences, order histories, and purchase metadata.</li>
              <li><span className="text-zinc-300 font-medium">Financial Data:</span> Payment processing details. Note: Financial transactions are securely managed via Paystack. Showgate does not store or have direct access to your card details or banking credentials.</li>
            </ul>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">3.2 Data Collected Automatically</h4>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Technical Data:</span> IP address, device type, browser specifications, and operating system.</li>
              <li><span className="text-zinc-300 font-medium">Usage Data:</span> URL clickstreams, page dwell time, navigation paths, and platform interaction behavior.</li>
              <li><span className="text-zinc-300 font-medium">Tracking Data:</span> Essential and non-essential cookies and session identifiers.</li>
            </ul>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">3.3 Data Inherited from Third Parties</h4>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Payment Verification:</span> Transaction confirmation data from Paystack.</li>
              <li><span className="text-zinc-300 font-medium">Communication Analytics:</span> Delivery, bounce, and open/click telemetry from Brevo.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">4. Lawful Bases and Purposes of Processing</h3>
            <p className="mb-3">In compliance with the NDPA, we process personal data under the following legitimate legal frameworks:</p>
            <div className="space-y-3">
              {[
                { basis: "Performance of Contract", details: "Provision of core ticketing infrastructure and digital ticket issuance. Delivery of booking confirmations, receipt notes, and event updates. Facilitation of attendee management and check-in tools for event organizers." },
                { basis: "Consent", details: "Delivery of promotional marketing, newsletters, and tailored updates. Deployment of non-essential cookies for behavioral analytics and optimization." },
                { basis: "Legitimate Interests", details: "Continuous enhancement of Platform performance, interface, and features. Diagnostics, system security auditing, and fraud prevention protocols. Resolution of user disputes and enforcement of our Terms of Service." },
                { basis: "Legal Obligation", details: "Adherence to statutory tax, corporate, and financial reporting duties under Nigerian law. Compliance with lawful subpoenas, regulatory audits, or judicial demands." },
              ].map(({ basis, details }) => (
                <div key={basis} className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800">
                  <p className="text-amber-400 font-semibold text-xs uppercase tracking-wide mb-1">{basis}</p>
                  <p className="text-zinc-400 text-xs">{details}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">5. Information Sharing and Disclosure</h3>
            <p>Showgate does not sell, rent, or trade your personal data to third parties. We disclose data strictly to optimize platform operations, fulfill legal obligations, or finalize contractual agreements.</p>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">5.1 Authorized Third-Party Data Processors</h4>
            <p className="text-zinc-400 mb-2">We engage specialized service providers bound by strict confidentiality and Data Processing Agreements (DPAs):</p>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Paystack</span> — Payment infrastructure (PCI-DSS compliant).</li>
              <li><span className="text-zinc-300 font-medium">Brevo</span> — Transactional email delivery services.</li>
              <li><span className="text-zinc-300 font-medium">Supabase</span> — Backend architectural infrastructure and database storage.</li>
              <li><span className="text-zinc-300 font-medium">Vercel</span> — Frontend hosting and content delivery deployment.</li>
              <li><span className="text-zinc-300 font-medium">Railway</span> — Specialized backend application server hosting.</li>
            </ul>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">5.2 Disclosure to Event Organizers</h4>
            <p className="text-zinc-400">When you register for or purchase a ticket to an event, relevant personal data (name, email address, and ticket metadata) is shared with the designated Event Organizer exclusively to facilitate event logistics, entry access control, and direct event-related updates.</p>
            <h4 className="text-zinc-200 font-semibold mt-3 mb-1">5.3 Statutory and Legal Disclosures</h4>
            <p className="text-zinc-400">We reserve the right to disclose personal data to law enforcement, regulatory bodies, or judicial authorities if mandated by law, or if deemed reasonably necessary to protect the safety, rights, and property of Showgate, its users, or the general public.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">6. Cross-Border Data Transfers</h3>
            <p>Certain cloud infrastructure providers utilized by Showgate (e.g., Supabase, Vercel, Brevo) maintain server networks outside the Federal Republic of Nigeria. Where cross-border data transfer occurs, Showgate ensures adequate safeguards are enforced to maintain data protection levels equivalent to NDPA requirements. By utilizing the Platform, you acknowledge and consent to these cross-border processing operations.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">7. Data Retention Policy</h3>
            <p className="mb-2">We retain your personal data only for the duration necessary to fulfill the purposes for which it was collected, as well as to satisfy legal, regulatory, or accounting requirements.</p>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Financial & Transactional Records:</span> Retained for a minimum of 6 years.</li>
              <li><span className="text-zinc-300 font-medium">Event & Attendee Data:</span> Retained for 2 years post-event date.</li>
              <li><span className="text-zinc-300 font-medium">Marketing Data:</span> Retained until consent is explicitly withdrawn.</li>
              <li><span className="text-zinc-300 font-medium">Technical Framework Logs:</span> Retained for up to 12 months.</li>
            </ul>
            <p className="mt-2 text-zinc-400">Upon expiration of the retention windows, data is permanently destroyed or irreversibly anonymized.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">8. Data Subject Rights</h3>
            <p className="mb-2">As a data subject under the NDPA, you possess comprehensive rights regarding your personal information:</p>
            <ul className="space-y-1.5 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Right of Access</span> — Request and obtain confirmation of whether we process your data, alongside a copy of that data.</li>
              <li><span className="text-zinc-300 font-medium">Right to Rectification</span> — Amend or correct inaccurate or incomplete personal records.</li>
              <li><span className="text-zinc-300 font-medium">Right to Erasure</span> — Request data deletion where statutory obligations do not supersede the request.</li>
              <li><span className="text-zinc-300 font-medium">Right to Restriction of Processing</span> — Suspend active data processing under specific verification conditions.</li>
              <li><span className="text-zinc-300 font-medium">Right to Data Portability</span> — Receive your personal data in a structured, machine-readable format.</li>
              <li><span className="text-zinc-300 font-medium">Right to Object</span> — Contest processing operations founded on our legitimate interests.</li>
              <li><span className="text-zinc-300 font-medium">Right to Withdraw Consent</span> — Revoke processing consent at any time, without affecting the lawfulness of prior processing.</li>
            </ul>
            <p className="mt-2 text-zinc-400">To submit a formal rights request, please email <span className="text-amber-400">hello@showgate.ng</span>. We will respond within 30 days of receipt.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">9. Cookies and Tracking Technologies</h3>
            <p>The Platform utilizes cookies and similar tracking pixels to optimize user sessions, preserve system state preferences, analyze traffic trends, and implement anti-fraud defenses. Essential cookies are deployed automatically to sustain platform functionality. Non-essential cookies will only be activated with your explicit consent.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">10. Data Security Architecture</h3>
            <p className="mb-2">Showgate applies institutional, technical, and physical security measures to protect personal data. Key protocols include:</p>
            <ul className="space-y-1 list-disc list-inside text-zinc-400">
              <li>End-to-end encryption of data in transit via HTTPS/TLS protocols.</li>
              <li>Restricted database access controls via Supabase enterprise-grade authentication.</li>
              <li>Exclusion of raw financial instrument handling by delegating to PCI-DSS compliant gateways (Paystack).</li>
              <li>Enforcement of a "need-to-know" internal data access privilege policy.</li>
            </ul>
            <p className="mt-2 text-zinc-400">In the event of a security breach, Showgate will formally report the incident to the NDPC within 72 hours and notify affected users without undue delay.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">11. Children's Privacy Protection</h3>
            <p>Our Platform is designed for use by individuals who are at least 13 years of age. Showgate does not knowingly collect or solicit personal data from children under the age of 13. If we discover that personal data has been inadvertently harvested from a child under 13, we will delete the record immediately. If you suspect a minor has provided us with unauthorized personal information, please alert us at <span className="text-amber-400">hello@showgate.ng</span>.</p>
          </section>

          <section>
            <h3 className="text-white font-bold mb-2">12. Amendments to this Privacy Policy</h3>
            <p>We reserve the right to modify or replace this Privacy Policy at our discretion. Material adjustments will be communicated by updating the policy text alongside a modified "Last Updated" timestamp, supplemented by direct email notifications to registered platform users where appropriate. Continued engagement with our Platform following an update denotes formal acceptance of the revised policy terms.</p>
          </section>

          <section className="pb-2">
            <h3 className="text-white font-bold mb-2">13. Contact Us & Regulatory Recourse</h3>
            <p className="mb-2">For inquiries regarding this Policy or to submit feedback regarding our data handling mechanisms:</p>
            <ul className="space-y-1 text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Email:</span> <span className="text-amber-400">hello@showgate.ng</span></li>
              <li><span className="text-zinc-300 font-medium">Digital Portal:</span> showgate.ng</li>
            </ul>
            <p className="mt-3 text-zinc-400">Should you feel that Showgate has handled your data unlawfully, you retain the statutory right to lodge a complaint with the Nigeria Data Protection Commission (NDPC):</p>
            <ul className="mt-1 space-y-1 text-zinc-400">
              <li><span className="text-zinc-300 font-medium">Web Portal:</span> ndpc.gov.ng</li>
              <li><span className="text-zinc-300 font-medium">Official Correspondence:</span> info@ndpc.gov.ng</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0 space-y-4">
          {!scrolledToBottom && (
            <p className="text-zinc-600 text-xs text-center">↓ Scroll to the bottom to enable the checkbox</p>
          )}
          <label className={`flex items-start gap-3 cursor-pointer group ${!scrolledToBottom ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!scrolledToBottom}
                className="sr-only"
              />
              <div
                onClick={() => scrolledToBottom && setAgreed((v) => !v)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                  agreed ? "bg-amber-400 border-amber-400" : "border-zinc-600 bg-zinc-900 group-hover:border-zinc-500"
                }`}
              >
                {agreed && (
                  <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-zinc-300 text-sm leading-tight">
              I agree to the License Agreement and Privacy Policy
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 font-bold text-sm transition-colors"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!agreed || loading}
              className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Creating account...</>
              ) : (
                "Accept & Sign Up"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showAgreement, setShowAgreement] = useState(false);
  const [pendingSignupData, setPendingSignupData] = useState<{ email: string; password: string } | null>(null);
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

  function handleSignupSubmit(data: SignupForm) {
    setPendingSignupData({ email: data.email, password: data.password });
    setShowAgreement(true);
  }

  async function handleAcceptAndSignup() {
    if (!pendingSignupData) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingSignupData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      queryClient.clear();
      setToken(json.token);
      saveUser(json.user);
      setShowAgreement(false);
      await checkOnboardingAndNavigate(json.token);
    } catch (err: any) {
      toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleDeclineAgreement() {
    setShowAgreement(false);
    setPendingSignupData(null);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      {showAgreement && (
        <LicenseAgreementModal
          onDecline={handleDeclineAgreement}
          onAccept={handleAcceptAndSignup}
          loading={loading}
        />
      )}

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
                <button type="submit"
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 mt-2">
                  Sign Up
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
