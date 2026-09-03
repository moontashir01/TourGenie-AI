import { useState } from "react";
import { EyeOff, Eye, Trash2, Star, Loader2 } from "lucide-react";
import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";

// FR-23 — moderation.
//
// Hiding or removing someone's writing asks for a reason, which the audit
// trail keeps. Without it the log says a post vanished and nothing about why,
// which is no use to the next moderator or to the person who wrote it.
function ModeratePrompt({ target, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const removing = target.action === "remove";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md card p-6 animate-pop-in">
        <h3 className="font-display text-lg text-ink-900 mb-1">
          {removing ? "Remove this permanently?" : "Hide this from the feed?"}
        </h3>
        <p className="text-sm text-ink-900/60 mb-4">
          {removing
            ? "It is deleted for good. Hiding it is reversible; this is not."
            : "The author keeps it, but nobody else sees it. You can unhide it later."}
        </p>
        <blockquote className="text-xs text-ink-900/70 bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4 max-h-24 overflow-y-auto">
          {target.excerpt}
        </blockquote>
        <label className="block mb-4">
          <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Reason (recorded in the activity log)</span>
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Spam, abuse, off-topic…"
            className="input"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-fixed font-semibold text-sm px-5 py-2.5 rounded-full transition-all disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {removing ? "Remove" : "Hide"}
          </button>
        </div>
      </div>
    </div>
  );
}

const VISIBILITY = [
  { value: "", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

export default function Reviews() {
  const posts = useAdminList(adminApi.communityPosts, { visibility: "" }, { listKey: "content:posts" });
  const reviews = useAdminList(adminApi.reviews, { visibility: "" }, { listKey: "content:reviews" });
  const [busyId, setBusyId] = useState(null);
  const [prompt, setPrompt] = useState(null); // { kind, id, action, excerpt }

  // Unhiding is reversible and needs no explanation, so it goes straight
  // through; hiding and removing do not.
  async function act(kind, id, action, reason) {
    setBusyId(id);
    const list = kind === "post" ? posts : reviews;
    try {
      if (kind === "post") await adminApi.moderatePost(id, action, reason);
      else await adminApi.moderateReview(id, action, reason);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
      setPrompt(null);
    }
  }

  function ActionButtons({ kind, row, excerpt }) {
    return (
      <div className="flex justify-end gap-3">
        {row.is_hidden ? (
          <button
            onClick={() => act(kind, row._id, "unhide")}
            disabled={busyId === row._id}
            title="Make visible again"
            className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
          >
            <Eye className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setPrompt({ kind, id: row._id, action: "hide", excerpt })}
            disabled={busyId === row._id}
            title="Hide from the feed"
            className="text-ink-900/40 hover:text-gold disabled:opacity-30"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setPrompt({ kind, id: row._id, action: "remove", excerpt })}
          disabled={busyId === row._id}
          title="Remove permanently"
          className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-4">Community posts</h3>
        <ErrorBanner message={posts.error} onDismiss={() => posts.setError("")} />
        <AdminToolbar list={posts} placeholder="Search place or content…">
          <AdminSelect
            label="Visibility"
            value={posts.filters.visibility}
            onChange={(v) => posts.setFilter("visibility", v)}
            options={VISIBILITY}
          />
        </AdminToolbar>

        <ListState list={posts} empty="No posts match that." />

        {posts.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Author</th>
                  <th className="pb-3 font-medium">Place</th>
                  <th className="pb-3 font-medium">Content</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {posts.rows.map((p) => (
                  <tr key={p._id} className={busyId === p._id ? "opacity-50" : ""}>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {p.user_id?.name || <span className="text-ink-900/35">deleted account</span>}
                    </td>
                    <td className="py-3 text-ink-900/70">{p.place}</td>
                    <td className="py-3 text-ink-900/70 max-w-sm truncate" title={p.content}>
                      {p.content}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                          p.is_hidden ? "bg-sunset-light text-sunset-dark" : "bg-teal-light text-teal-dark"
                        }`}
                      >
                        {p.is_hidden ? "Hidden" : "Visible"}
                      </span>
                    </td>
                    <td className="py-3">
                      <ActionButtons kind="post" row={p} excerpt={p.content} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={posts} />
      </section>

      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-4">Attraction reviews</h3>
        <ErrorBanner message={reviews.error} onDismiss={() => reviews.setError("")} />
        <AdminToolbar list={reviews} placeholder="Search review text…">
          <AdminSelect
            label="Visibility"
            value={reviews.filters.visibility}
            onChange={(v) => reviews.setFilter("visibility", v)}
            options={VISIBILITY}
          />
        </AdminToolbar>

        <ListState list={reviews} empty="No reviews match that." />

        {reviews.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Author</th>
                  <th className="pb-3 font-medium">Attraction</th>
                  <th className="pb-3 font-medium">Rating</th>
                  <th className="pb-3 font-medium">Comment</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {reviews.rows.map((r) => (
                  <tr key={r._id} className={busyId === r._id ? "opacity-50" : ""}>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {r.user_id?.name || <span className="text-ink-900/35">deleted account</span>}
                    </td>
                    <td className="py-3 text-ink-900/70">{r.attraction_id?.name || "—"}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-ink-900/70">
                        <Star className="w-3.5 h-3.5 text-gold fill-current" /> {r.rating}
                      </span>
                    </td>
                    <td className="py-3 text-ink-900/70 max-w-sm truncate" title={r.comment}>
                      {r.comment}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                          r.is_hidden ? "bg-sunset-light text-sunset-dark" : "bg-teal-light text-teal-dark"
                        }`}
                      >
                        {r.is_hidden ? "Hidden" : "Visible"}
                      </span>
                    </td>
                    <td className="py-3">
                      <ActionButtons kind="review" row={r} excerpt={r.comment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={reviews} />
      </section>

      {prompt && (
        <ModeratePrompt
          target={prompt}
          busy={busyId === prompt.id}
          onCancel={() => setPrompt(null)}
          onConfirm={(reason) => act(prompt.kind, prompt.id, prompt.action, reason)}
        />
      )}
    </div>
  );
}
