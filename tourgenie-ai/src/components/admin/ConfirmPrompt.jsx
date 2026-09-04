import { useState } from "react";
import { Lock } from "lucide-react";
import Overlay from "../ui/Overlay";
import Button from "../ui/Button";

// The dialog in front of an admin action that has to be accounted for.
//
// Two things it can ask for, independently:
//
//   reason   — what the audit trail records. The difference between a log you
//              can act on and a list of timestamps.
//   password — re-authentication. A session token lasts a week and lives in
//              localStorage; that is enough to read a dashboard and not
//              enough to grant `owner`, delete an account and everything it
//              owns, or export email addresses.
//   phrase   — the record's own name, typed out. Reason and password both
//              travel on muscle memory once an admin has answered them a few
//              times; copying out an email address is the one step that
//              cannot be completed without reading which record is about to
//              go. Reserved for what genuinely cannot be undone.
//
// It owns its own busy and error state, so a wrong password leaves the dialog
// open with the message inside it rather than closing and losing what was
// typed. `onConfirm({ reason, password })` may throw; whatever it throws is
// shown here.
export default function ConfirmPrompt({
  title,
  description,
  confirmLabel,
  tone = "teal",
  requireReason = true,
  requirePassword = false,
  confirmPhrase = "",
  passwordNote = "This action asks for your password again.",
  onCancel,
  onConfirm,
  children,
}) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready =
    (!requireReason || reason.trim()) &&
    (!requirePassword || password) &&
    (!confirmPhrase || phrase.trim() === confirmPhrase);

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm({ reason: reason.trim(), password });
      // Success unmounts this dialog, so nothing is reset here.
    } catch (err) {
      setError(err.message);
      // A wrong password is the likely failure; clearing it saves a select-all.
      if (requirePassword) setPassword("");
      setBusy(false);
    }
  }

  return (
    // dismissable={!busy}: the request is already with the server, and
    // closing here would lose the reason that was typed for nothing.
    <Overlay open onClose={onCancel} size="md" label={title} dismissable={!busy}>
      <form onSubmit={submit} className="p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">{title}</h3>
        <p className="text-sm text-ink-900/60 mb-4">{description}</p>
        {children}

        {requireReason && (
          <label className="block mb-4">
            <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">
              Reason (recorded in the activity log)
            </span>
            <input
              type="text"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this happening?"
              className="input"
            />
          </label>
        )}

        {confirmPhrase && (
          <label className="block mb-4">
            <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">
              Type <span className="font-mono text-ink-900">{confirmPhrase}</span> to confirm
            </span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={confirmPhrase}
              className="input font-mono"
            />
          </label>
        )}

        {requirePassword && (
          <label className="block mb-4">
            <span className="text-xs font-medium text-ink-900/60 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Your password
            </span>
            <input
              type="password"
              autoFocus={!requireReason && !confirmPhrase}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm it's you"
              className="input"
            />
            <span className="text-xs text-ink-900/45 mt-1.5 block">{passwordNote}</span>
          </label>
        )}

        {error && (
          <p className="text-sm text-sunset-dark bg-sunset-light/40 border border-sunset-dark/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === "danger" ? "danger" : "teal"} loading={busy} disabled={!ready}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
