import { useEffect, useState } from "react";
import { Mail, Trash2, Loader2, Check, Clock } from "lucide-react";
import Overlay, { OverlayHeader } from "./ui/Overlay";
import Button from "./ui/Button";
import { tripsApi } from "../lib/api";

// Who else can see this trip, and what they may do with it.
//
// Two roles, described in the words that matter to the person choosing:
// nobody needs to know the enum, they need to know whether their friend can
// move things around.
const ROLES = [
  { value: "viewer", label: "Can view", hint: "Sees the plan, the budget and the bookings. Changes nothing." },
  { value: "editor", label: "Can edit", hint: "Can also add, move and remove activities and pick hotels." },
];

export default function ShareTripDialog({ open, onClose, tripId, tripName }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open || !tripId) return;
    setLoading(true);
    setError("");
    tripsApi.shares
      .list(tripId)
      .then(({ shares: list }) => setShares(list || []))
      .catch((err) => setError(err.message || "Couldn't load who this is shared with"))
      .finally(() => setLoading(false));
  }, [open, tripId]);

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSending(true);
    try {
      const { share, email_sent } = await tripsApi.shares.invite(tripId, { email: email.trim(), role });
      setShares((prev) => [...prev.filter((s) => s._id !== share._id), share]);
      setEmail("");
      setNotice(
        share.status === "pending"
          ? `${share.email} doesn't have an account yet — the trip will be waiting when they sign up with that address.`
          : email_sent
            ? `${share.email} can see the trip now, and we've emailed them.`
            : `${share.email} can see the trip now. The invitation email couldn't be sent — tell them yourself.`
      );
    } catch (err) {
      setError(err.message || "Couldn't share the trip");
    } finally {
      setSending(false);
    }
  }

  async function handleRole(share, next) {
    setBusyId(share._id);
    setError("");
    try {
      const { share: updated } = await tripsApi.shares.setRole(tripId, share._id, next);
      setShares((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
    } catch (err) {
      setError(err.message || "Couldn't change that");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(share) {
    setBusyId(share._id);
    setError("");
    try {
      await tripsApi.shares.revoke(tripId, share._id);
      setShares((prev) => prev.filter((s) => s._id !== share._id));
      setNotice(`${share.email} no longer has access.`);
    } catch (err) {
      setError(err.message || "Couldn't remove that person");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} size="md" label="Share this trip">
      <OverlayHeader title="Share this trip" subtitle={tripName} onClose={onClose} />

      <div className="px-6 pb-6 space-y-5">
        <form onSubmit={handleInvite} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-ink-600 mb-1.5 block">Their email address</span>
            <input
              type="email"
              required
              className="input"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-ink-600 mb-1.5">What they can do</legend>
            {ROLES.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  role === option.value ? "border-teal bg-teal-light/40" : "border-sand hover:border-teal/40"
                }`}
              >
                <input
                  type="radio"
                  name="share-role"
                  className="mt-1"
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{option.label}</span>
                  <span className="block text-2xs text-ink-500 leading-snug">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Said before they choose "Can edit", not after they discover it. */}
          {role === "editor" && (
            <p className="text-2xs text-ink-500 leading-snug">
              Two people editing at once is last-write-wins — the newest save is the one that sticks. The AI
              assistant rewrites the whole plan, so only you can use it on this trip.
            </p>
          )}

          <Button type="submit" icon={Mail} loading={sending} disabled={!email.trim()}>
            Send invitation
          </Button>
        </form>

        {error && (
          <p className="text-sm text-sunset-dark bg-sunset/10 border border-sunset/30 rounded-lg px-3 py-2">{error}</p>
        )}
        {notice && !error && (
          <p className="text-sm text-teal-dark bg-teal/10 border border-teal/30 rounded-lg px-3 py-2">{notice}</p>
        )}

        <div className="border-t border-sand pt-4">
          <p className="text-2xs uppercase tracking-wide text-ink-500 mb-2.5">Shared with</p>

          {loading ? (
            <p className="text-sm text-ink-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-ink-500">Nobody yet — this trip is only yours.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-sand bg-paper"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900 truncate">
                      {share.name || share.email}
                    </span>
                    <span className="flex items-center gap-1.5 text-2xs text-ink-500 truncate">
                      {share.name ? `${share.email} · ` : ""}
                      {share.status === "pending" ? (
                        <>
                          <Clock className="w-3 h-3" /> Waiting for them to sign up
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" /> Has access
                        </>
                      )}
                    </span>
                  </span>

                  <span className="flex items-center gap-2 shrink-0">
                    {busyId === share._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-500" />
                    ) : (
                      <>
                        <select
                          aria-label={`Role for ${share.email}`}
                          className="text-xs rounded-full border border-sand bg-surface px-2 py-1"
                          value={share.role}
                          onChange={(e) => handleRole(share, e.target.value)}
                        >
                          {ROLES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRevoke(share)}
                          aria-label={`Remove ${share.email}`}
                          title="Remove access"
                          className="p-1.5 rounded-full text-ink-500 hover:text-sunset-dark hover:bg-sunset/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Overlay>
  );
}
