import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Loader2 } from "lucide-react";
import AppShell from "../components/AppShell";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { communityApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ALL = "All places";
// Shown until the catalogue arrives, and if it can't be fetched at all.
const FALLBACK_PLACES = ["Cox's Bazar", "Sajek Valley", "Sundarbans"];

function CommunityBody() {
  const { user } = useAuth();
  const [filter, setFilter] = useState(ALL);
  const [posts, setPosts] = useState([]);
  const [places, setPlaces] = useState(FALLBACK_PLACES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [place, setPlace] = useState(FALLBACK_PLACES[0]);
  const [posting, setPosting] = useState(false);

  // Every destination in the catalogue, not the three this page used to
  // hard-code — a post about any of the other 24 was unfilterable.
  useEffect(() => {
    communityApi
      .places()
      .then(({ places: rows }) => {
        if (rows?.length) {
          setPlaces(rows);
          setPlace((current) => (rows.includes(current) ? current : rows[0]));
        }
      })
      .catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    communityApi
      .list(filter)
      .then(({ posts }) => {
        setPosts(posts);
        // Cleared on success — one failed load used to leave the red bar on
        // screen for the rest of the visit.
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function handlePost(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await communityApi.create({ place, content });
      setContent("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-5">
        {user ? (
          <form onSubmit={handlePost} className="bg-surface border border-sand rounded-2xl p-5">
            <select value={place} onChange={(e) => setPlace(e.target.value)} className="input mb-2 w-auto">
              {places.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share a tip or review from a recent trip…"
              className="w-full text-sm bg-paper border border-sand rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={posting}
                className="bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-fixed text-sm font-semibold px-4 py-2 rounded-full transition-colors"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-surface border border-sand rounded-2xl p-5 text-sm text-ink-900/60">
            <Link to="/login" className="text-teal-dark font-semibold hover:text-teal">Log in</Link> to share a tip or review.
          </div>
        )}

        {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-2 text-ink-900/50 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-ink-900/50 text-center py-8">No posts yet for {filter === ALL ? "any place" : filter}.</p>
        ) : (
          posts.map((p) => (
            <div key={p._id} className="bg-surface border border-sand rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold shrink-0">
                  {(p.user_id?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{p.user_id?.name || "Traveler"}</p>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.place} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-ink-900/80 leading-relaxed">{p.content}</p>
            </div>
          ))
        )}
      </div>

      <aside className="space-y-5">
        <div className="bg-surface border border-sand rounded-2xl p-5">
          <p className="text-xs font-semibold tracking-wide uppercase text-ink-900/50 mb-3">Filter by place</p>
          {/* The catalogue is 27 long — it scrolls rather than pushing the
              page down. */}
          <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1">
            {[ALL, ...places].map((p) => (
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
      </aside>
    </div>
  );
}

// Community is reachable whether logged in or not — render inside AppShell
// when logged in (sidebar nav) and inside the public layout otherwise.
export default function Community() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return (
      <AppShell title="Reviews & Community" subtitle="Real notes from travelers who've already been there.">
        <CommunityBody />
      </AppShell>
    );
  }

  return (
    <div className="bg-paper min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl text-ink-900 mb-2">Reviews & Community</h1>
        <p className="text-ink-900/60 mb-10">Real notes from travelers who've already been there.</p>
        <CommunityBody />
      </div>
      <Footer />
    </div>
  );
}
