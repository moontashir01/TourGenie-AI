import { useState } from "react";
import { Star, Heart, MessageSquare, Camera, MapPin } from "lucide-react";
import AppShell from "../components/AppShell";
import { communityPosts } from "../data/mockData";

const places = ["All places", "Cox's Bazar", "Sajek Valley", "Sundarbans"];

export default function Community() {
  const [filter, setFilter] = useState("All places");
  const filtered = filter === "All places" ? communityPosts : communityPosts.filter((p) => p.place === filter);

  return (
    <AppShell title="Reviews & Community" subtitle="Real notes from travelers who've already been there.">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-sand rounded-2xl p-5">
            <textarea
              rows={2}
              placeholder="Share a tip or review from a recent trip…"
              className="w-full text-sm bg-paper border border-sand rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="text-ink-900/50 hover:text-teal-dark"><Camera className="w-4 h-4" /></button>
                <div className="flex items-center gap-0.5 text-gold">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 cursor-pointer hover:fill-gold" />)}
                </div>
              </div>
              <button className="bg-sunset hover:bg-sunset-dark text-ink-900 text-sm font-semibold px-4 py-2 rounded-full transition-colors">
                Post
              </button>
            </div>
          </div>

          {filtered.map((p) => (
            <div key={p.id} className="bg-white border border-sand rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold shrink-0">
                  {p.user.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{p.user}</p>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.place} · {p.time}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-0.5 text-gold">
                  {[...Array(p.rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-gold" />)}
                </div>
              </div>
              <p className="text-sm text-ink-900/80 leading-relaxed mb-4">{p.content}</p>
              <div className="flex items-center gap-5 text-xs text-ink-900/50">
                <button className="flex items-center gap-1.5 hover:text-sunset-dark"><Heart className="w-4 h-4" /> {p.likes}</button>
                <button className="flex items-center gap-1.5 hover:text-teal-dark"><MessageSquare className="w-4 h-4" /> {p.replies}</button>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="bg-white border border-sand rounded-2xl p-5">
            <p className="text-xs font-semibold tracking-wide uppercase text-ink-900/50 mb-3">Filter by place</p>
            <div className="flex flex-col gap-1.5">
              {places.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    filter === p ? "bg-teal-light text-teal-dark font-semibold" : "text-ink-900/70 hover:bg-paper"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-ink-900 rounded-2xl p-5">
            <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-3">Top travel tips</p>
            <ul className="space-y-3 text-sm text-paper/70">
              <li>Book Sajek Valley jeeps a day ahead during the Eid rush.</li>
              <li>Cox's Bazar hotel prices drop noticeably on weekdays.</li>
              <li>Sundarbans permits take 24h to process — apply early.</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
