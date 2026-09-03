import { useEffect, useState } from "react";
import { FileText, MapPin, Ticket, Star, MessageSquare, ScrollText } from "lucide-react";
import { adminApi } from "../../lib/api";
import Drawer, { DrawerSection, Field } from "./Drawer";
import AdminNotes from "./AdminNotes";
import { ErrorBanner } from "./ListShell";

// One traveller, whole. The screen that turns "a support question" into a
// ten-second answer: their profile, what they have planned, what they have
// booked and spent, what they have written, and every admin action ever
// taken on the account.
const money = (n) => `৳${Math.round(n || 0).toLocaleString()}`;
const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function UserDetail({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setData(null);
    adminApi
      .userDetail(userId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const u = data?.user;

  return (
    <Drawer
      open={Boolean(userId)}
      title={u?.name || "Traveller"}
      subtitle={u?.email}
      loading={loading}
      onClose={onClose}
    >
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {data && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 pb-6 border-b border-sand">
            <Field label="Role">
              <span className="capitalize">{u.role}</span>
            </Field>
            <Field label="Status">{u.is_active ? "Active" : "Deactivated"}</Field>
            <Field label="Email verified">{u.email_verified ? "Yes" : "No"}</Field>
            <Field label="Joined">{date(u.created_at)}</Field>
            <Field label="Last login">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "never"}</Field>
            <Field label="Home">{[u.city, u.country].filter(Boolean).join(", ") || "—"}</Field>
            <Field label="Phone">{u.phone || "—"}</Field>
            <Field label="Currency">{u.preferences?.currency}</Field>
            <Field label="Travel style">{u.preferences?.default_budget_tier}</Field>
          </dl>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Trips" value={data.trips.length} />
            <Stat label="Bookings" value={data.bookings.length + data.hotel_bookings.length} />
            <Stat label="Logged spend" value={money(data.expenses.total_bdt)} />
          </div>

          <DrawerSection title="Trips" count={data.trips.length} empty="Hasn't planned a trip yet.">
            <ul className="space-y-2">
              {data.trips.map((t) => (
                <li key={t._id} className="flex items-center gap-3 text-sm bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-dark shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-ink-900">
                    {t.origin} → {t.destination}
                  </span>
                  <span className="text-xs text-ink-900/50 capitalize shrink-0">{t.status}</span>
                  <span className="text-xs font-mono text-ink-900/50 shrink-0">{money(t.budget)}</span>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection
            title="Bookings"
            count={data.bookings.length + data.hotel_bookings.length}
            empty="Nothing booked."
          >
            <ul className="space-y-2">
              {data.bookings.map((b) => (
                <li key={b._id} className="flex items-center gap-3 text-sm bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <Ticket className="w-3.5 h-3.5 text-teal-dark shrink-0" />
                  <span className="font-mono text-xs text-ink-900 shrink-0">{b.reference}</span>
                  <span className="flex-1 min-w-0 truncate text-ink-900/70 text-xs">
                    {b.journey?.from_city} → {b.journey?.to_city} · {date(b.travel_date)}
                  </span>
                  <StatusPill status={b.status} />
                </li>
              ))}
              {data.hotel_bookings.map((b) => (
                <li key={b._id} className="flex items-center gap-3 text-sm bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <Ticket className="w-3.5 h-3.5 text-sunset-dark shrink-0" />
                  <span className="font-mono text-xs text-ink-900 shrink-0">{b.reference}</span>
                  <span className="flex-1 min-w-0 truncate text-ink-900/70 text-xs">
                    {b.property?.name} · {b.nights} night{b.nights === 1 ? "" : "s"} from {date(b.check_in)}
                  </span>
                  <StatusPill status={b.status} />
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection title="Documents" count={data.documents.length} empty="No documents stored.">
            {/* Metadata only, deliberately: these are passport and visa scans.
                An admin needs to know one exists and when it expires. */}
            <ul className="space-y-1.5">
              {data.documents.map((d) => (
                <li key={d._id} className="flex items-center gap-3 text-sm">
                  <FileText className="w-3.5 h-3.5 text-ink-900/35 shrink-0" />
                  <span className="capitalize text-ink-900/80">{d.title || d.type}</span>
                  <span className="text-xs text-ink-900/40 capitalize">{d.type}</span>
                  {d.expiry_date && (
                    <span className="text-xs text-ink-900/45 ml-auto">expires {date(d.expiry_date)}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-900/35 mt-2">
              File links are never shown here — only whether a document exists and when it lapses.
            </p>
          </DrawerSection>

          <DrawerSection title="Posts" count={data.posts.length} empty="Hasn't posted.">
            <ul className="space-y-2">
              {data.posts.map((p) => (
                <li key={p._id} className="text-sm bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-teal-dark" />
                    <span className="text-xs text-ink-900/60">{p.place}</span>
                    {p.is_hidden && <span className="text-[11px] text-sunset-dark font-semibold">hidden</span>}
                    <span className="text-xs text-ink-900/40 ml-auto">{p.likes || 0} likes</span>
                  </div>
                  <p className="text-ink-900/75 text-xs line-clamp-2">{p.content}</p>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection title="Reviews" count={data.reviews.length} empty="Hasn't reviewed anything.">
            <ul className="space-y-2">
              {data.reviews.map((r) => (
                <li key={r._id} className="text-sm bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-3.5 h-3.5 text-gold fill-current" />
                    <span className="text-xs text-ink-900/70">{r.rating}</span>
                    <span className="text-xs text-ink-900/50">{r.attraction_id?.name || "—"}</span>
                    {r.is_hidden && <span className="text-[11px] text-sunset-dark font-semibold ml-auto">hidden</span>}
                  </div>
                  <p className="text-ink-900/75 text-xs line-clamp-2">{r.comment}</p>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <AdminNotes targetType="user" targetId={userId} />

          <DrawerSection title="Admin actions on this account" count={data.audit.length} empty="None recorded.">
            <ul className="space-y-1.5">
              {data.audit.map((a) => (
                <li key={a._id} className="flex items-start gap-2 text-xs">
                  <ScrollText className="w-3.5 h-3.5 text-ink-900/30 shrink-0 mt-0.5" />
                  <span className="font-mono text-ink-900/70">{a.action}</span>
                  <span className="text-ink-900/45">by {a.actor_email}</span>
                  <span className="text-ink-900/35 ml-auto shrink-0">{date(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-surface border border-sand rounded-xl px-3 py-2.5">
      <p className="font-mono text-lg font-semibold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-900/50">{label}</p>
    </div>
  );
}

export function StatusPill({ status }) {
  const tone =
    status === "cancelled"
      ? "bg-sunset-light text-sunset-dark"
      : status === "pending"
        ? "bg-gold/20 text-ink-800"
        : "bg-teal-light text-teal-dark";
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${tone}`}>
      {status}
    </span>
  );
}
