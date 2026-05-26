import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isAuthenticated } from "@/lib/auth";
import {
  Zap, BarChart2, Palette, ArrowRight, Check, X, Menu,
  ChevronRight,
} from "lucide-react";
import sgLogo from "@assets/showgate-logo.png";

interface PublicStats {
  totalEvents: number;
  totalTicketsSold: number;
}

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

function useCountUp(target: number, trigger: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [trigger, target, duration]);
  return count;
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
  const { data: stats } = useQuery<PublicStats>({
    queryKey: ["/api/stats"],
  });

  const { ref: statsRef, visible: statsVisible } = useFadeIn();
  const eventsCount = useCountUp(stats?.totalEvents ?? 0, statsVisible && !!stats);
  const ticketsCount = useCountUp(stats?.totalTicketsSold ?? 0, statsVisible && !!stats);

  const howItWorksRef = useRef<HTMLElement>(null);

  function scrollToHowItWorks(e: React.MouseEvent) {
    e.preventDefault();
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    document.title = "Showgate — The easiest way to run your event";
    return () => { document.title = "Showgate"; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0d0d0d]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight">
            Show<span className="text-amber-400">gate</span>
            <img src={sgLogo} alt="" className="inline-block h-[22px] w-auto ml-2 align-middle" />
          </span>
          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-3">
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
        <div className="relative z-10 max-w-4xl mx-auto px-5 text-center py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold mb-8">
            <Zap className="w-3.5 h-3.5" /> Built for serious event organizers
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            The easiest way to
            <span className="block text-amber-400">run your event.</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Sell tickets, brand your experience, and understand your audience — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800 bg-zinc-900/40">
        <div className="max-w-3xl mx-auto px-5 py-16">
          <div
            ref={statsRef}
            className={`grid grid-cols-2 gap-8 transition-all duration-700 ${statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            {[
              { value: eventsCount, label: "Events Created" },
              { value: ticketsCount, label: "Tickets Sold" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-5xl sm:text-6xl font-black tabular-nums mb-2">
                  {value.toLocaleString()}
                </div>
                <div className="text-zinc-400 font-semibold text-base mb-1">{label}</div>
                <div className="text-amber-500/70 text-xs font-medium">and growing every day</div>
              </div>
            ))}
          </div>
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
                  {["1 active event", "500 tickets per month", "Basic analytics", "2.5% platform fee"].map((f) => (
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
                    <span className="text-4xl font-black">₦12,000</span>
                    <span className="text-zinc-400 text-sm mb-1.5">/month</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-[1.2rem] font-[800] text-white">or ₦120,000/year</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      Save ₦24,000
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {[
                    "Unlimited active events",
                    "Unlimited tickets",
                    "All payment providers",
                    "Full analytics dashboard",
                    "0% platform fee",
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

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-zinc-800 bg-zinc-900/20">
        <div className="max-w-3xl mx-auto">
          <FadeSection>
            <h2 className="text-3xl sm:text-4xl font-black mb-8"><span className="text-amber-400">About</span> Showgate<img src={sgLogo} alt="" className="inline-block h-[36px] w-auto ml-2 align-middle" /></h2>
            <div className="space-y-5 text-zinc-400 leading-relaxed text-base">
              <p>
                Showgate was built for event organizers who are tired of complicated platforms that take a cut of everything and make buyers feel like they are on someone else's stage. We built the tools you need and got out of the way.
              </p>
              <p>
                Whether you are running a concert, a conference, a church event, or a private dinner — Showgate gives you the infrastructure to sell professionally, brand boldly, and understand your audience fully.
              </p>
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
          <p className="text-zinc-600 text-xs mt-1">© {new Date().getFullYear()} Showgate. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
