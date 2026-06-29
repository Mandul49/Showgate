import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import heroWoman from "@/assets/IMG_9654_1781631698906.png";
import { Link } from "wouter";
import { isAuthenticated } from "@/lib/auth";
import {
  Zap, BarChart2, Palette, ArrowRight, Check, X, Menu,
  ChevronRight, CreditCard, Clock, ImageIcon, Store, Ticket,
} from "lucide-react";
import sgLogo from "../assets/showgate-logo.png";
import { SiInstagram } from "react-icons/si";


function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}


function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const authed = isAuthenticated();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const howItWorksRef = useRef<HTMLElement>(null);

  const { data: publicSettings } = useQuery<{
    proMonthlyNaira: number;
    proYearlyNaira: number;
    feePercent: number;
    freeFeePercent: number;
    proTicketFeePercent: number;
  }>({
    queryKey: ["/api/settings/public"],
  });
  const proMonthly = publicSettings?.proMonthlyNaira ?? 10000;
  const proYearly = publicSettings?.proYearlyNaira ?? 100000;
  const proSaving = proMonthly * 12 - proYearly;
  const freeFee = publicSettings?.freeFeePercent ?? 2.5;
  const proFee = publicSettings?.proTicketFeePercent ?? 2;

  function scrollToHowItWorks(e: React.MouseEvent) {
    e.preventDefault();
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    document.title = "Showgate — The easiest way to run your event";
    return () => { document.title = "Showgate"; };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-main)" }}>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky z-50 border-b border-zinc-800/60 backdrop-blur-md" style={{ top: "var(--maintenance-h, 0px)", backgroundColor: "var(--nav-bg)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight">
            Show<span className="text-amber-400">gate</span>
            <img src={sgLogo} alt="" className="inline-block h-[22px] w-auto ml-2 align-middle" />
          </span>
          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/events">
              <button className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors">
                Events
              </button>
            </Link>
            <Link href="/about">
              <button className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors">
                About
              </button>
            </Link>
            {authed ? (
              <Link href="/dashboard">
                <button className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                  Dashboard
                </button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <button className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors">
                    Log In
                  </button>
                </Link>
                <Link href="/login">
                  <button className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                    Get Started
                  </button>
                </Link>
              </>
            )}
          </div>
          {/* Mobile menu button */}
          <button className="sm:hidden p-2 text-zinc-400" onClick={() => setMenuOpen(v => !v)}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-zinc-800 px-5 py-4 flex flex-col gap-3 bg-[#0d0d0d]">
            <Link href="/events">
              <button className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 font-semibold text-sm hover:border-zinc-600 hover:text-white transition-colors text-left">
                Events
              </button>
            </Link>
            <Link href="/about">
              <button className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 font-semibold text-sm hover:border-zinc-600 hover:text-white transition-colors text-left">
                About
              </button>
            </Link>
            {authed ? (
              <Link href="/dashboard">
                <button className="w-full px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                  Dashboard
                </button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <button className="w-full px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:border-zinc-500 transition-colors">
                    Log In
                  </button>
                </Link>
                <Link href="/login">
                  <button className="w-full px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                    Get Started
                  </button>
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="hero-section relative min-h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-[#0d0d0d] to-zinc-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(245,158,11,0.09)_0%,transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_80%,rgba(161,161,170,0.04)_0%,transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Amber glow behind the woman */}
        <div className="absolute right-0 top-0 w-[55%] h-full bg-[radial-gradient(ellipse_at_80%_60%,rgba(245,158,11,0.13)_0%,transparent_60%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 py-16 flex flex-col lg:flex-row items-center gap-8 lg:gap-0">
          {/* ── Left: copy ─────────────────────────────────────────────────── */}
          <div className="flex-1 text-center lg:text-left lg:pr-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold mb-8">
              <Zap className="w-3.5 h-3.5" /> Built for serious event organizers
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              <span className="text-white">Create events, sell tickets,</span>
              <span className="block text-amber-400">and get paid directly.</span>
            </h1>
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <Link href="/login">
                <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base transition-colors shadow-lg shadow-amber-900/30">
                  Create Your Event <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <button
                onClick={scrollToHowItWorks}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold text-base transition-colors"
              >
                See How It Works
              </button>
            </div>
          </div>

          {/* ── Right: woman image ──────────────────────────────────────────── */}
          <div className="relative flex-shrink-0 w-[300px] sm:w-[380px] lg:w-[420px] xl:w-[480px] lg:-mb-16 select-none">
            <img
              src={heroWoman}
              alt="Event organizer holding a digital ticket"
              className="w-full h-auto object-contain drop-shadow-[0_0_40px_rgba(245,158,11,0.25)]"
              style={{ mixBlendMode: "screen" }}
            />
          </div>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto px-5 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col gap-3 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-400/30 transition-colors">
              <span className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </span>
              <h3 className="text-white font-black text-lg">Fast Setup</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Go from sign-up to selling tickets in under five minutes. No technical skills or developer required.
              </p>
            </div>
            <div className="flex flex-col gap-3 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-400/30 transition-colors">
              <span className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </span>
              <h3 className="text-white font-black text-lg">Instant Payments</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Payments go directly to you via Paystack. No foreign cards, no middlemen, no waiting.
              </p>
            </div>
            <div className="flex flex-col gap-3 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-400/30 transition-colors">
              <span className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-amber-400" />
              </span>
              <h3 className="text-white font-black text-lg">Real-time Analytics</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Watch ticket sales and audience data update live. Know your numbers before the event even starts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-b border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <FadeSection>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" /> Made in Nigeria
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-5">
              Built by organizers,{" "}
              <span className="text-amber-400">for organizers</span>
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              Showgate was created for real event organizers who need a simpler way to create events, sell tickets, receive payments, and understand their audience.
            </p>
          </FadeSection>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section ref={howItWorksRef} className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <FadeSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4"><span className="text-amber-400">How</span> it works</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Three steps from sign-up to sold out.</p>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Sign up in seconds",
                desc: "Create your free account and set up your payment details once. Everything carries over to every event you run.",
              },
              {
                num: "02",
                title: "Build your event",
                desc: "Add ticket tiers, set your branding, and publish your event page in minutes. No developer needed.",
              },
              {
                num: "03",
                title: "Sell and track",
                desc: "Share your link, collect payments directly, and watch your analytics in real time. Your audience, your data.",
              },
            ].map((step, i) => (
              <FadeSection key={step.num}>
                <div className="relative p-7 rounded-2xl border border-zinc-800 bg-zinc-900/60 h-full hover:border-zinc-700 transition-colors group">
                  <div className="text-5xl font-black text-amber-400 group-hover:text-amber-300 transition-colors mb-5 leading-none select-none">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-bold mb-3">{step.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
                  {i < 2 && (
                    <ChevronRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-7 h-7 text-zinc-700 z-10" />
                  )}
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 bg-zinc-900/30 border-y border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <FadeSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Everything you need. Nothing you don't.</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              The infrastructure to sell professionally, brand boldly, and understand your audience fully.
            </p>
          </FadeSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Palette className="w-6 h-6 text-amber-400" />,
                title: "Your Brand, Your Page",
                desc: "Upload your logo, set your colors, and give attendees a fully branded ticket experience that feels like yours — not ours.",
              },
              {
                icon: <Zap className="w-6 h-6 text-amber-400" />,
                title: "Payments Direct to You",
                desc: "Paystack-powered splits mean money goes straight to your bank. No waiting, no middleman, no withheld payouts.",
              },
              {
                icon: <BarChart2 className="w-6 h-6 text-amber-400" />,
                title: "Analytics That Matter",
                desc: "See who bought, how much you made, and which ticket tiers performed best — so you can run the next event smarter.",
              },
            ].map((feat) => (
              <FadeSection key={feat.title}>
                <div className="p-7 rounded-2xl border border-zinc-800 bg-[#0d0d0d] hover:border-amber-500/30 hover:bg-zinc-900/60 transition-all h-full group">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 transition-colors">
                    {feat.icon}
                  </div>
                  <h3 className="text-base font-bold mb-2">{feat.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard Screenshots ─────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <FadeSection className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              See your event{" "}
              <span className="text-amber-400">clearly</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Track ticket sales, revenue, attendees, and performance from one dashboard.
            </p>
          </FadeSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { src: "/screenshots/dashboard-1.png", label: "Analytics Overview" },
              { src: "/screenshots/dashboard-2.png", label: "Revenue & Sales" },
              { src: "/screenshots/dashboard-3.png", label: "Buyers & Comparison" },
            ].map((item, i) => (
              <FadeSection key={i}>
                <div
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden group hover:border-amber-500/30 transition-all cursor-zoom-in"
                  onClick={() => setLightbox(item.src)}
                >
                  <div className="relative w-full aspect-video bg-zinc-900">
                    <img
                      src={item.src}
                      alt={item.label}
                      className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex";
                      }}
                    />
                    <div className="absolute inset-0 hidden flex-col items-center justify-center gap-3 bg-zinc-900">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      </div>
                      <span className="text-zinc-600 text-xs font-medium tracking-wide">Dashboard Preview</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-zinc-800">
                    <p className="text-xs font-medium text-zinc-400 tracking-wide">{item.label}</p>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn"
              onClick={() => setLightbox(null)}
              style={{ animation: "lightboxFadeIn 0.2s ease-out" }}
            >
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center transition-colors z-10"
                onClick={() => setLightbox(null)}
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <img
                src={lightbox}
                alt="Dashboard preview"
                className="max-w-[92vw] max-h-[88vh] rounded-xl shadow-2xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <FadeSection className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Simple, honest pricing</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Start free. Upgrade when you're ready to grow.</p>
          </FadeSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Free */}
            <FadeSection>
              <div className="p-7 rounded-2xl border border-zinc-800 bg-zinc-900/60 h-full flex flex-col">
                <div className="mb-6">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Free</div>
                  <div className="text-4xl font-black mb-1">₦0</div>
                  <div className="text-zinc-500 text-sm">forever</div>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {["1 active event", "500 tickets per month", "Basic analytics", `${freeFee}% platform fee`].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="block">Direct deposit via Paystack</span>
                      <span className="block text-zinc-500 text-xs mt-0.5">Just connect your bank account once and get paid directly.</span>
                    </span>
                  </li>
                  {["Custom branding", "Priority support"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                      <X className="w-4 h-4 text-zinc-700 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login">
                  <button className="w-full py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-sm transition-colors">
                    Get Started Free
                  </button>
                </Link>
              </div>
            </FadeSection>

            {/* Pro */}
            <FadeSection>
              <div className="pricing-pro-card relative p-7 rounded-2xl border border-amber-500/40 bg-zinc-950 h-full flex flex-col overflow-hidden">
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                  Most Popular
                </div>
                <div className="mb-6">
                  <div className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-2">Pro</div>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-black">₦{proMonthly.toLocaleString("en-NG")}</span>
                    <span className="text-zinc-400 text-sm mb-1.5">/month</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-[1.2rem] font-[800] text-white">or ₦{proYearly.toLocaleString("en-NG")}/year</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      Save ₦{proSaving.toLocaleString("en-NG")}
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Unlimited active events",
                    "Unlimited tickets",
                    "All payment providers",
                    "Full analytics dashboard",
                    `${proFee}% platform fee`,
                    "Custom branding",
                    "Priority support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-200">
                      <Check className="w-4 h-4 text-amber-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login">
                  <button className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                    Go Pro
                  </button>
                </Link>
              </div>
            </FadeSection>

          </div>
        </div>
      </section>

      {/* ── Fees ──────────────────────────────────────────────────────────── */}
      <section className="py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <FadeSection className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">Simple, Honest Fees</h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">No hidden charges. No surprises at checkout.</p>
          </FadeSection>

          <FadeSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Organizers */}
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 flex-shrink-0">
                    <Store className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">For Event Organizers</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">2.5% platform fee</p>
                  <p className="text-xs text-amber-400/80 font-semibold mt-0.5">per successful ticket sale</p>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Deducted from ticket revenue before settlement. You only pay when you sell.
                </p>
              </div>

              {/* Buyers */}
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex-shrink-0">
                    <Ticket className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">For Ticket Buyers</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">No surprises</p>
                  <p className="text-xs text-emerald-400/80 font-semibold mt-0.5">price shown before you pay</p>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  A small payment processing fee is added at checkout. Always shown before you pay.
                </p>
              </div>

            </div>

            <p className="text-center text-zinc-600 text-xs mt-5">
              Free events have zero fees for everyone.
            </p>
          </FadeSection>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-zinc-800 bg-zinc-900/20">
        <div className="max-w-3xl mx-auto">
          <FadeSection>
            <h2 className="text-3xl sm:text-4xl font-black mb-8"><span className="text-amber-400">About</span> Showgate<img src={sgLogo} alt="" className="inline-block h-[36px] w-auto ml-2 align-middle" /></h2>
            <div className="space-y-5 text-zinc-400 leading-relaxed text-base">
              <p>
                Showgate is a West African event ticketing platform built for the people who make things happen — the organizers, promoters, creatives, and community builders who bring people together.
              </p>
              <p>
                Founded in 2026, Showgate was created out of a simple frustration: existing ticketing platforms were too complex, too expensive, and not built with African organizers in mind. Foreign platforms charge high fees, require foreign cards, and offer tools that feel disconnected from how events actually work on the ground in Nigeria and across West Africa.
              </p>
              <p className="text-white font-semibold">We built something different.</p>
              <p>
                Showgate gives individual event organizers everything they need to sell tickets online, collect payments seamlessly through Paystack, and understand their audience through accurate, real-time data — all in one clean, affordable platform.
              </p>
              <p className="text-amber-400 font-semibold">No hidden fees. No foreign card friction. No unnecessary complexity.</p>
            </div>
            <div className="mt-8">
              <Link href="/about">
                <button className="text-sm text-amber-400 hover:text-amber-300 font-semibold transition-colors underline underline-offset-4">
                  Read more about us →
                </button>
              </Link>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="cta-section py-24 px-5 border-t border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-[#0d0d0d]">
        <div className="max-w-2xl mx-auto text-center">
          <FadeSection>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Ready to run your next event?</h2>
            <p className="text-zinc-400 mb-10 text-base leading-relaxed">
              Join organizers already using Showgate. Free to start, powerful when you need it.
            </p>
            {authed ? (
              <Link href="/dashboard">
                <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base transition-colors shadow-lg shadow-amber-900/30">
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            ) : (
              <Link href="/login">
                <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base transition-colors shadow-lg shadow-amber-900/30">
                  Create Your Event <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            )}
          </FadeSection>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-amber-500/20 py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-2">
          <span className="text-lg font-black">
            Show<span className="text-amber-400">gate</span>
            <img src={sgLogo} alt="" className="inline-block h-[20px] w-auto ml-2 align-middle" />
          </span>
          <p className="text-zinc-500 text-xs">The easiest way to run your event.</p>
          <a href="mailto:support@showgate.ng" className="text-zinc-500 text-xs hover:text-amber-400 transition-colors">support@showgate.ng</a>
          <a href="https://www.instagram.com/showgate.ng/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-zinc-500 hover:text-amber-400 transition-colors mt-1">
            <SiInstagram className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} Showgate. All rights reserved.</p>
            <span className="text-zinc-700 text-xs">·</span>
            <Link href="/privacy">
              <span className="text-zinc-600 text-xs hover:text-amber-400 transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
