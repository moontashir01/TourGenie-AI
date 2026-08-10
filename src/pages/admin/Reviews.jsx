import { useEffect, useState } from "react";
import { Loader2, EyeOff, Eye, Trash2, Star } from "lucide-react";
import { adminApi } from "../../lib/api";

export default function Reviews() {
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([adminApi.communityPosts(), adminApi.reviews()])
      .then(([p, r]) => {
        setPosts(p.posts);
        setReviews(r.reviews);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function actOnPost(id, action) {
    setBusyId(id);
    try {
      await adminApi.moderatePost(id, action);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function actOnReview(id, action) {
    setBusyId(id);
    try {
      await adminApi.moderateReview(id, action);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Community posts ({posts.length})</h3>
        {posts.length === 0 ? (
          <p className="text-sm text-ink-900/50">No posts yet.</p>
        ) : (
          <div className="divide-y divide-sand">
            {posts.map((p) => (
              <div key={p._id} className="py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{p.user_id?.name || "Traveler"} <span className="font-normal text-ink-900/50">· {p.place}</span></p>
                  <p className="text-sm text-ink-900/70 mt-1">{p.content}</p>
                  {p.is_hidden && (
                    <span className="inline-block mt-2 text-[11px] font-semibold uppercase tracking-wide bg-sunset-light text-sunset-dark px-2 py-0.5 rounded-full">Hidden</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.is_hidden ? (
                    <button onClick={() => actOnPost(p._id, "unhide")} disabled={busyId === p._id} className="text-ink-900/40 hover:text-teal-dark" title="Unhide">
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => actOnPost(p._id, "hide")} disabled={busyId === p._id} className="text-ink-900/40 hover:text-sunset-dark" title="Hide">
                      <EyeOff className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => actOnPost(p._id, "remove")} disabled={busyId === p._id} className="text-ink-900/40 hover:text-sunset-dark" title="Delete permanently">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Attraction reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-ink-900/50">No reviews yet.</p>
        ) : (
          <div className="divide-y divide-sand">
            {reviews.map((r) => (
              <div key={r._id} className="py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-900">{r.user_id?.name || "Traveler"}</p>
                    <span className="text-ink-900/40">·</span>
                    <p className="text-sm text-ink-900/60">{r.attraction_id?.name || "Unknown attraction"}</p>
                    <span className="flex items-center gap-0.5 text-gold">
                      {[...Array(r.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-gold" />)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-900/70 mt-1">{r.comment}</p>
                  {r.is_hidden && (
                    <span className="inline-block mt-2 text-[11px] font-semibold uppercase tracking-wide bg-sunset-light text-sunset-dark px-2 py-0.5 rounded-full">Hidden</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.is_hidden ? (
                    <button onClick={() => actOnReview(r._id, "unhide")} disabled={busyId === r._id} className="text-ink-900/40 hover:text-teal-dark" title="Unhide">
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => actOnReview(r._id, "hide")} disabled={busyId === r._id} className="text-ink-900/40 hover:text-sunset-dark" title="Hide">
                      <EyeOff className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => actOnReview(r._id, "remove")} disabled={busyId === r._id} className="text-ink-900/40 hover:text-sunset-dark" title="Delete permanently">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
