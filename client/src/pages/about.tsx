import { Link } from "wouter";
import { Check, ArrowRight } from "lucide-react";
import sgLogo from "../assets/showgate-logo.png";
import aboutHero from "@assets/About-us_1781630795603.jpeg";

export default function About() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0d0d0d]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-black tracking-tight cursor-pointer">
              Show<span className="text-amber-400">gate</span>
              <img src={sgLogo} alt="" className="inline-block h-[22px] w-auto ml-2 align-middle" />
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about">
              <button className="px-4 py-2 text-amber-400 text-sm font-semibold transition-colors">
                About
              </button>
            </Link>
            <Link href="/login">
              <button className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero heading ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[320px] sm:min-h-[380px] flex items-center pt-20 pb-12 px-5 border-b border-zinc-800/50">
        {/* Background image */}
        <img
          src={aboutHero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
        />
        {/* Dark gradient to keep text legible */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d]/80 via-[#0d0d0d]/40 to-transparent" />
        {/* Text content */}
        <div className="relative z-10 max-w-3xl mx-auto w-full">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            <span className="text-amber-400">About</span> Showgate
            <img src={sgLogo} alt="" className="inline-block h-[40px] w-auto ml-3 align-middle" />
          </h1>
          <p className="text-zinc-400 text-lg">West African event ticketing, built for the people who make things happen.</p>
        </div>
      </section>

      {/* ── Main copy ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto space-y-6 text-zinc-300 leading-relaxed text-base">
          <p>
            Showgate is a West African event ticketing platform built for the people who make things happen — the organizers, promoters, creatives, and community builders who bring people together.
          </p>
          <p>
            Founded in 2026, Showgate was created out of a simple frustration: existing ticketing platforms were too complex, too expensive, and not built with African organizers in mind. Foreign platforms charge high fees, require foreign cards, and offer tools that feel disconnected from how events actually work on the ground in Nigeria and across West Africa.
          </p>
          <p className="text-white font-semibold text-lg">We built something different.</p>
          <p>
            Showgate gives individual event organizers everything they need to sell tickets online, collect payments seamlessly through Paystack, and understand their audience through accurate, real-time data — all in one clean, affordable platform.
          </p>
          <p className="text-amber-400 font-semibold">
            No hidden fees. No foreign card friction. No unnecessary complexity.
          </p>

          {/* Mission & Vision */}
          <div className="mt-10 grid sm:grid-cols-2 gap-5 pt-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <span className="text-amber-400 font-black text-xs uppercase tracking-widest block mb-2">Our Mission</span>
              <p className="text-zinc-300 text-sm leading-relaxed">
                To make event ticketing simple, accessible, and affordable for every organizer in West Africa — from the independent concert promoter in Lagos to the church coordinator in Jos.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <span className="text-amber-400 font-black text-xs uppercase tracking-widest block mb-2">Our Vision</span>
              <p className="text-zinc-300 text-sm leading-relaxed">
                To make event ticketing simple, accessible, and affordable for every organizer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Values ────────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">
            Core <span className="text-amber-400">Values</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Simplicity First */}
            <div className="relative bg-zinc-900 border-2 border-amber-400/70 rounded-2xl p-6 flex flex-col gap-4 shadow-lg shadow-amber-900/20">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/40 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <span className="text-white font-black text-base">Simplicity First</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Powerful tools don't have to be complicated. Everything we build is designed to be used by anyone — no technical skill required.
              </p>
            </div>

            {/* Built for Here */}
            <div className="relative bg-zinc-900 border-2 border-amber-400/70 rounded-2xl p-6 flex flex-col gap-4 shadow-lg shadow-amber-900/20">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/40 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <span className="text-white font-black text-base">Built for Here</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                We build for African realities — local payment systems, local infrastructure, local organizers. Not an adaptation of something foreign. Built from the ground up for this context.
              </p>
            </div>

            {/* Data That Empowers */}
            <div className="relative bg-zinc-900 border-2 border-amber-400/70 rounded-2xl p-6 flex flex-col gap-4 shadow-lg shadow-amber-900/20">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/40 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <span className="text-white font-black text-base">Data That Empowers</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Organizers deserve to know their audience. Real numbers, real insights, real decisions — so every event is better than the last.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-[#0d0d0d]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready to run your next event?</h2>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            Join organizers already using Showgate. Free to start, powerful when you need it.
          </p>
          <Link href="/login">
            <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base transition-colors shadow-lg shadow-amber-900/30">
              Create Your Event <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
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
