import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ImageIcon, CalendarDays, MapPin, Ticket, LockKeyhole } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { Event, TicketType } from "@shared/schema";
import sgLogo from "../assets/showgate-logo.png";
import { useTheme } from "@/lib/theme";

type PublicEvent = Event & { ticketTypes: TicketType[] };

function formatEventDate(date: string, startTime?: string | null) {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return startTime ? `${datePart} · ${startTime}` : datePart;
}

function getLowestPrice(ticketTypes: TicketType[]) {
  if (!ticketTypes.length) return null;
  const prices = ticketTypes.map((t) => t.price);
  return Math.min(...prices);
}

function EventCard({ event }: { event: PublicEvent }) {
  const { isLight } = useTheme();
  const lowestPrice = getLowestPrice(event.ticketTypes);
  const isFree = lowestPrice === null || lowestPrice === 0;
  const href = event.slug ? `/e/${event.slug}` : `/e/${event.id}`;
  const cardBg = isLight ? "#ffffff" : "#0f0f0f";

  return (
    <Link href={href}>
      <div
        className="group cursor-pointer rounded-xl border border-yellow-600/30 overflow-hidden hover:-translate-y-1 transition-all duration-300"
        style={{
          backgroundColor: cardBg,
          boxShadow: isLight
            ? "0 2px 8px 0 rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.06)"
            : "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Image area */}
        <div className="relative w-full aspect-[16/10] bg-zinc-900 overflow-hidden">
          {event.coverImageUrl ? (
            <>
              <img
                src={event.coverImageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: `center ${event.coverImagePositionY ?? 50}%` }}
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 40%, ${cardBg} 100%)` }} />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-yellow-600/40" />
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="text-sm font-bold truncate mb-1.5" style={{ color: "var(--text-main)" }}>
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-400 text-xs truncate">{formatEventDate(event.date, event.startTime)}</span>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-gray-400 text-xs truncate">{event.location}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {isFree ? (
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">
                Free
              </span>
            ) : (
              <span className="text-yellow-400 text-xs font-semibold">
                From ₦{lowestPrice!.toLocaleString()}
              </span>
            )}

            <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-400 transition-colors flex-shrink-0">
              Get Tickets
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  const { isLight } = useTheme();
  return (
    <div
      className="rounded-xl border border-zinc-800 overflow-hidden animate-pulse"
      style={{ backgroundColor: isLight ? "#ffffff" : "#111111" }}
    >
      <div className="w-full aspect-[16/10] bg-zinc-800" />
      <div className="p-4 space-y-2.5">
        <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
        <div className="flex justify-between mt-3">
          <div className="h-5 bg-zinc-800 rounded-full w-12" />
          <div className="h-7 bg-zinc-800 rounded-lg w-24" />
        </div>
      </div>
    </div>
  );
}

function PastEventCard({ event }: { event: PublicEvent }) {
  const { isLight } = useTheme();
  const href = event.slug ? `/e/${event.slug}` : `/e/${event.id}`;
  const cardBg = isLight ? "#f4f4f5" : "#0a0a0a";

  return (
    <Link href={href}>
      <div
        className="group cursor-pointer rounded-xl border border-zinc-800/50 overflow-hidden hover:-translate-y-0.5 transition-all duration-300 opacity-70 grayscale hover:opacity-100 hover:grayscale-0"
        style={{
          backgroundColor: cardBg,
          boxShadow: isLight
            ? "0 1px 4px 0 rgb(0 0 0 / 0.06)"
            : "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div className="relative w-full aspect-[16/10] bg-zinc-900 overflow-hidden">
          {event.coverImageUrl ? (
            <img
              src={event.coverImageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${event.coverImagePositionY ?? 50}%` }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-zinc-700" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-900/90 text-zinc-500 border border-zinc-700">
              <LockKeyhole className="w-2.5 h-2.5" /> Ended
            </span>
          </div>
        </div>
        <div className="px-4 pt-2.5 pb-3.5">
          <h3 className="text-xs font-bold truncate mb-1" style={{ color: "var(--text-main)" }}>
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 mb-0.5">
            <CalendarDays className="w-3 h-3 text-zinc-600 flex-shrink-0" />
            <span className="text-zinc-600 text-xs truncate">{formatEventDate(event.date, event.startTime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-zinc-700 flex-shrink-0" />
            <span className="text-zinc-700 text-xs truncate">{event.location}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const { isLight } = useTheme();
  const { data: eventsData, isLoading } = useQuery<PublicEvent[]>({
    queryKey: ["/api/events/public"],
  });
  const { data: pastEvents } = useQuery<PublicEvent[]>({
    queryKey: ["/api/events/public/past"],
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-main)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-md" style={{ backgroundColor: "var(--nav-bg)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-black tracking-tight cursor-pointer">
              Show<span className="text-amber-400">gate</span>
              <img src={sgLogo} alt="" className="inline-block h-[22px] w-auto ml-2 align-middle" />
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/events">
              <button className="px-4 py-2 text-yellow-400 text-sm font-semibold transition-colors">
                Events
              </button>
            </Link>
            <Link href="/about">
              <button className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors">
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

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[320px] sm:min-h-[380px] flex items-center pt-20 pb-12 px-5 border-b border-zinc-800/50">
        {!isLight && <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1200 50%, #0a0a0a 100%)" }} />}
        {isLight && <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(245,158,11,0.07), rgba(245,158,11,0.18))" }} />}
        <div className="relative z-10 max-w-3xl mx-auto w-full text-center">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Discover <span className="text-amber-400">Events</span>
          </h1>
          <p className="font-medium text-lg" style={{ color: "var(--text-main)" }}>Find the best events happening near you.</p>
        </div>
      </section>

      {/* Active Events Grid */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !eventsData?.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Ticket className="w-12 h-12 text-yellow-600/30" />
            <p className="text-zinc-500 text-lg font-medium">No events yet.</p>
            <p className="text-zinc-600 text-sm">Check back soon — something exciting is coming.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventsData.map((ev) => <EventCard key={ev.id} event={ev} />)}
          </div>
        )}
      </section>

      {/* Past Events */}
      {!!pastEvents?.length && (
        <section className="max-w-6xl mx-auto px-5 pb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>Past Events</h2>
            <div className="flex-1 h-px bg-zinc-800/60" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {pastEvents.map((ev) => <PastEventCard key={ev.id} event={ev} />)}
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
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
