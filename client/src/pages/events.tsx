import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ImageIcon, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Event, TicketType } from "@shared/schema";
import sgLogo from "../assets/showgate-logo.png";
import eventsHero from "@assets/events_1782333074829.jpeg";

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
  const lowestPrice = getLowestPrice(event.ticketTypes);
  const isFree = lowestPrice === null || lowestPrice === 0;
  const href = event.slug ? `/e/${event.slug}` : `/e/${event.id}`;

  return (
    <Link href={href}>
      <div className="group cursor-pointer rounded-xl border border-yellow-600/30 bg-[#0f0f0f] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:shadow-yellow-600/20 transition-all duration-300">
        {/* Image area */}
        <div className="relative h-40 bg-zinc-900 overflow-hidden">
          {event.coverImageUrl ? (
            <>
              <img
                src={event.coverImageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: `center ${event.coverImagePositionY ?? 50}%` }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0f0f0f 100%)" }} />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-yellow-600/40" />
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="px-4 pb-4 -mt-2">
          <h3 className="text-sm font-bold text-white truncate mb-1.5">
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
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#111111] overflow-hidden animate-pulse">
      <div className="h-40 bg-zinc-800" />
      <div className="px-4 pb-4 pt-3 space-y-2.5">
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

export default function EventsPage() {
  const { data: eventsData, isLoading } = useQuery<PublicEvent[]>({
    queryKey: ["/api/events/public"],
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0a0a0a]/90 backdrop-blur-md">
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
        <img
          src={eventsHero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/50 via-[#0a0a0a]/30 to-[#0a0a0a]/60" />
        <div className="relative z-10 max-w-3xl mx-auto w-full text-center">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Discover <span className="text-amber-400">Events</span>
          </h1>
          <p className="text-white font-medium text-lg">Find the best events happening near you.</p>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !eventsData?.length ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Ticket className="w-12 h-12 text-yellow-600/30" />
            <p className="text-zinc-500 text-lg font-medium">No events yet.</p>
            <p className="text-zinc-600 text-sm">Check back soon — something exciting is coming.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {eventsData.map((ev) => <EventCard key={ev.id} event={ev} />)}
          </div>
        )}
      </section>
    </div>
  );
}
