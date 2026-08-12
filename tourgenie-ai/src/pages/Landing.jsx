import { Link } from "react-router-dom";
import {
  Search,
  Sparkles,
  Route as RouteIcon,
  Wallet,
  CloudSun,
  ShieldCheck,
  ArrowRight,
  Star,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import RouteLine from "../components/RouteLine";

const features = [
  {
    icon: Sparkles,
    title: "AI day-by-day itineraries",
    desc: "Tell it your budget and interests — get a complete, editable plan built from a curated attractions database.",
  },
  {
    icon: RouteIcon,
    title: "Optimized routes",
    desc: "Fastest paths between every stop, mapped with OpenStreetMap and refined for however you're travelling.",
  },
  {
    icon: Wallet,
    title: "Budget & expense tracking",
    desc: "A categorized estimate up front, then a running log so actual spending never surprises you mid-trip.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware packing",
    desc: "A packing checklist generated from the forecast and your planned activities — nothing forgotten.",
  },
];

const steps = [
  { n: "1", title: "Tell us the trip", desc: "Origin, destination, dates, budget, and what you're into." },
  { n: "2", title: "AI builds the plan", desc: "A day-by-day itinerary, hotel picks, and an optimized route." },
  { n: "3", title: "Refine by chatting", desc: "\"Make it cheaper\" or \"add a day\" — the plan updates instantly." },
  { n: "4", title: "Travel, tracked", desc: "Documents, expenses, and packing all stay with the trip." },
];

export default function Landing() {
  return (
    <div className="bg-paper">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-ink-900 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-28 relative z-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-sunset bg-sunset/10 px-3 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> Powered by Claude
            </span>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-paper mt-6">
              From leaving home to
              <br />
              coming back — <span className="text-sunset italic">planned</span>.
            </h1>
            <p className="text-paper/70 text-lg mt-6 max-w-lg leading-relaxed">
              TourGenie AI turns a destination and a budget into a complete
              trip: itinerary, route, hotel, and expenses, in one place
              instead of six tabs.
            </p>

            <form className="mt-10 bg-ink-800 border border-ink-700 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-xl">
              <div className="flex items-center gap-2 flex-1 px-3">
                <Search className="w-4 h-4 text-paper/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Where do you want to go?"
                  className="bg-transparent text-paper placeholder:text-paper/40 text-sm py-3 w-full focus:outline-none"
                />
              </div>
              <Link
                to="/plan"
                className="bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                Plan My Trip with AI <ArrowRight className="w-4 h-4" />
              </Link>
            </form>

            <div className="mt-6 flex items-center gap-2 text-paper/50 text-xs">
              <RouteLine className="w-24 h-4" color="#EF8354" />
              Dhaka → Cox&apos;s Bazar → Himchari → back home
            </div>
          </div>
        </div>

        {/* decorative route line across hero bottom */}
        <svg className="absolute bottom-0 left-0 w-full h-24 opacity-40" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 80 Q 300 10, 600 60 T 1200 40" fill="none" stroke="#1C8C82" strokeWidth="2" strokeDasharray="1 10" strokeLinecap="round" />
        </svg>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-xl mb-14">
          <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3">What it does</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink-900">
            Every planning tool a trip needs, already talking to each other.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="border border-sand bg-white rounded-2xl p-6 hover:border-teal/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-teal-light flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-teal-dark" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg text-ink-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-ink-900/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-teal-light/50 border-y border-sand">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3">How it works</p>
          <h2 className="font-display text-3xl md:text-4xl text-ink-900 mb-14 max-w-xl">
            Four steps, and the plan is already better than the one you'd have made alone.
          </h2>
          <div className="relative grid md:grid-cols-4 gap-10">
            <div className="hidden md:block absolute top-6 left-0 right-0">
              <RouteLine className="w-full h-4" color="#1C8C82" />
            </div>
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="w-12 h-12 rounded-full bg-ink-900 text-paper font-display flex items-center justify-center text-lg mb-5 relative z-10">
                  {s.n}
                </div>
                <h3 className="font-semibold text-ink-900 mb-1.5">{s.title}</h3>
                <p className="text-sm text-ink-900/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / community teaser */}
      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3">Community</p>
          <h2 className="font-display text-3xl text-ink-900 mb-4">
            Real trips, reviewed by real travelers.
          </h2>
          <p className="text-ink-900/60 leading-relaxed mb-6">
            Every attraction and hotel carries ratings and notes from
            travelers who've actually been — read before you go, then post
            your own once you're back.
          </p>
          <Link to="/community" className="inline-flex items-center gap-2 text-teal-dark font-semibold text-sm hover:gap-3 transition-all">
            Browse the community <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="bg-white border border-sand rounded-2xl p-6">
          <div className="flex items-center gap-1 text-gold mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-gold" />)}
          </div>
          <p className="text-ink-900/80 leading-relaxed mb-4">
            "The AI itinerary nailed the sunset timing at Laboni Beach —
            genuinely better than the plan I made myself last year."
          </p>
          <p className="text-sm font-semibold text-ink-900">Farhana R. <span className="font-normal text-ink-900/50">— Cox's Bazar</span></p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center relative z-10">
          <ShieldCheck className="w-8 h-8 text-sunset mx-auto mb-5" strokeWidth={1.5} />
          <h2 className="font-display text-3xl md:text-4xl text-paper mb-4">
            Your next trip is a form away.
          </h2>
          <p className="text-paper/60 max-w-md mx-auto mb-8">
            Free to plan. Mock bookings only — no card required.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Create your free account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
