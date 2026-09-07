import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MapPin, Loader2, Flag, Clock } from "lucide-react";
import AppShell from "../components/AppShell";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Overlay from "../components/ui/Overlay";
import Button from "../components/ui/Button";
import { communityApi, reportApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ALL = "All places";

// Matches Report.REPORT_REASONS on the server — the category is what the
// moderation queue filters and counts by; the free text is extra.
const REPORT_REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "abuse", label: "Abusive or harassing" },
  { value: "misinformation", label: "Misleading or wrong" },
  { value: "off_topic", label: "Not about travel" },
  { value: "unsafe", label: "Unsafe advice" },
  { value: "other", label: "Something else" },
];
// Shown until the catalogue arrives, and if it can't be fetched at all.
const FALLBACK_GROUPS = [
  { country: "Bangladesh", country_code: "BD", places: ["Cox's Bazar", "Sajek Valley", "Sundarbans"] },
];

function CommunityBody() {
  const { user } = useAuth();
  const [filter, setFilter] = useState(ALL);
  const [posts, setPosts] = useState([]);
  // Grouped by country: both the sidebar and the post form render the
  // groups directly, so there is nothing left that wants a flat list.
  const [groups, setGroups] = useState(FALLBACK_GROUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [place, setPlace] = useState(FALLBACK_GROUPS[0].places[0]);
  const [posting, setPosting] = useState(false);
  const [likingId, setLikingId] = useState(null);
  // FR-23 — what happened to a post the rules held, and the report dialog.
  const [heldNotice, setHeldNotice] = useState("");
  const [reporting, setReporting] = useState(null);
  const [reported, setReported] = useState(() => new Set());

  // Every destination in the catalogue, not the three this page used to
  // hard-code — a post about any of the other 24 was unfilterable.
  useEffect(() => {
    communityApi
      .places()
      .then(({ groups: rows, places: flat }) => {
        // Older servers answer with the flat list only.
        const next = rows?.length
          ? rows
          : flat?.length
            ? [{ country: "All destinations", country_code: "", places: flat }]
            : null;
        if (!next) return;
        setGroups(next);
        const names = next.flatMap((group) => group.places);
        setPlace((current) => (names.includes(current) ? current : names[0]));
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
      const { held, held_because } = await communityApi.create({ place, content });
      setContent("");
      // A post the rules held is not on the feed yet. Saying so is the whole
      // point — otherwise it looks like the app quietly lost it.
      setHeldNotice(
        held
          ? `Your post is waiting for a moderator${held_because ? ` — ${held_because.toLowerCase()}` : ""}. You can still see it below.`
          : ""
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  // Optimistic: the heart answers on click, the server settles the count.
  async function toggleLike(post) {
    if (!user || likingId) return;
    const optimistic = { liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) };
    setPosts((prev) => prev.map((p) => (p._id === post._id ? { ...p, ...optimistic } : p)));
    setLikingId(post._id);
    try {
      const { liked, likes } = await communityApi.like(post._id);
      setPosts((prev) => prev.map((p) => (p._id === post._id ? { ...p, liked, likes } : p)));
    } catch (err) {
      // Put it back the way it was — the like didn't happen.
      setPosts((prev) => prev.map((p) => (p._id === post._id ? post : p)));
      setError(err.message);
    } finally {
      setLikingId(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-5">
        {user ? (
          <form onSubmit={handlePost} className="card p-5">
            <select value={place} onChange={(e) => setPlace(e.target.value)} className="input mb-2 w-auto">
              {groups.map((group) => (
                <optgroup key={group.country_code || group.country} label={group.country}>
                  {group.places.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </optgroup>
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
              <Button type="submit" size="sm" loading={posting}>
                Post
              </Button>
            </div>
          </form>
        ) : (
          <div className="card p-5 text-sm text-ink-600">
            <Link to="/login" className="text-teal-dark font-semibold hover:text-teal">Log in</Link> to share a tip or review.
          </div>
        )}

        {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

        {heldNotice && (
          <div className="flex items-start gap-2 bg-gold/10 border border-gold/30 text-ink-900/75 text-sm rounded-lg px-4 py-3">
            <Clock className="w-4 h-4 mt-0.5 shrink-0 text-gold" />
            <span className="flex-1">{heldNotice}</span>
            <button type="button" onClick={() => setHeldNotice("")} className="text-sm font-semibold underline">
              Got it
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-ink-500 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-8">No posts yet for {filter === ALL ? "any place" : filter}.</p>
        ) : (
          posts.map((p) => (
            <div key={p._id} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-xs font-semibold shrink-0">
                  {(p.user_id?.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{p.user_id?.name || "Traveler"}</p>
                  <p className="text-sm text-ink-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.place} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {p.held_for_review && (
                <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide bg-gold/15 text-ink-600 px-2 py-1 rounded-full mb-2">
                  <Clock className="w-3 h-3" /> Waiting for a moderator — only you can see this
                </p>
              )}
              <p className="text-sm text-ink-900/80 leading-relaxed">{p.content}</p>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-sand">
                <button
                  type="button"
                  onClick={() => toggleLike(p)}
                  disabled={!user || likingId === p._id}
                  aria-pressed={Boolean(p.liked)}
                  title={user ? (p.liked ? "Remove your like" : "Like this post") : "Log in to like posts"}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors disabled:cursor-not-allowed ${
                    p.liked
                      ? "border-sunset/40 bg-sunset/10 text-sunset-dark"
                      : "border-sand text-ink-600 hover:border-sunset/40 hover:text-sunset-dark"
                  } ${!user ? "opacity-60" : ""}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${p.liked ? "fill-current" : ""}`} strokeWidth={1.75} />
                  {p.likes > 0 ? p.likes : "Like"}
                </button>
                {!user && (
                  <Link to="/login" className="text-sm text-teal-dark hover:text-teal">
                    Log in to like
                  </Link>
                )}

                {/* Reporting is only offered on other people's posts — your
                    own is yours to delete, not to report. */}
                {user && String(p.user_id?._id || p.user_id) !== String(user._id) && (
                  <button
                    type="button"
                    onClick={() => setReporting(p)}
                    disabled={reported.has(p._id)}
                    className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-sunset-dark disabled:hover:text-ink-500 disabled:cursor-default"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {reported.has(p._id) ? "Reported" : "Report"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <aside className="space-y-5">
        <div className="card p-5">
          <p className="text-xs font-semibold tracking-wide uppercase text-ink-500 mb-3">Filter by place</p>
          {/* Grouped by country and scrolling: 25 names in one alphabetical
              run hid the fact that this is two countries, with Chiang Mai
              filed between Chattogram and Cox's Bazar. */}
          <div className="flex flex-col max-h-96 overflow-y-auto pr-1">
            <button
              onClick={() => setFilter(ALL)}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                filter === ALL ? "bg-teal-light text-teal-dark font-semibold" : "text-ink-900/70 hover:bg-paper"
              }`}
            >
              {ALL}
            </button>

            {groups.map((group) => (
              <div key={group.country_code || group.country} className="mt-3 first:mt-2">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500 px-3 mb-1">
                  {group.country}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.places.map((p) => (
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
            ))}
          </div>
        </div>
      </aside>

      {reporting && (
        <ReportDialog
          post={reporting}
          onClose={() => setReporting(null)}
          onDone={(id) => {
            setReported((prev) => new Set(prev).add(id));
            setReporting(null);
            // Enough separate reports and the post comes off the feed, so
            // reload rather than leaving a stale list behind.
            load();
          }}
        />
      )}
    </div>
  );
}

// FR-23 — the traveller's side of moderation. One report per person per post;
// a second attempt is refused by the server, and the button says so.
function ReportDialog({ post, onClose, onDone }) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await reportApi.create({ target_type: "CommunityPost", target_id: post._id, reason, details });
      onDone(post._id);
    } catch (err) {
      // 409 means "you already reported this", which is an answer, not a
      // failure — the button ends up in the same place either way.
      if (err.status === 409) return onDone(post._id);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Overlay open onClose={onClose} variant="adaptive" size="md" label="Report this post" dismissable={!sending}>
      <form onSubmit={submit} className="p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">Report this post</h3>
        <p className="text-sm text-ink-600 mb-4">
          A moderator reads every report. Nothing happens to the post until one of them decides.
        </p>
        <blockquote className="text-xs text-ink-900/70 bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4 max-h-24 overflow-y-auto">
          {post.content}
        </blockquote>

        {error && (
          <p className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <label className="block mb-3">
          <span className="text-sm font-medium text-ink-600 mb-1.5 block">What's wrong with it?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {REPORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-5">
          <span className="text-sm font-medium text-ink-600 mb-1.5 block">Anything to add? (optional)</span>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What a moderator should know."
            className="w-full text-sm bg-paper border border-sand rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal resize-none"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={sending}>
            Send report
          </Button>
        </div>
      </form>
    </Overlay>
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
        <p className="text-ink-600 mb-10">Real notes from travelers who've already been there.</p>
        <CommunityBody />
      </div>
      <Footer />
    </div>
  );
}
