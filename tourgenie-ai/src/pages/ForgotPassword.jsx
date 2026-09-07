import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, CheckCircle2, ArrowLeft, Timer } from "lucide-react";
import RouteLine from "../components/RouteLine";
import { authApi } from "../lib/api";
import AuthLayout from "../components/AuthLayout";

const OTP_LENGTH = 6;

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Password recovery in one page, three steps:
//   email → 6-digit code (2-minute life, resendable) → new password.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // Two independent countdowns: how long the code stays valid, and how long
  // until another one can be requested.
  const [expiresIn, setExpiresIn] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const boxRefs = useRef([]);
  const otp = useMemo(() => digits.join(""), [digits]);
  const expired = step === "otp" && expiresIn <= 0;

  useEffect(() => {
    if (expiresIn <= 0 && cooldown <= 0) return undefined;
    const id = setInterval(() => {
      setExpiresIn((value) => (value > 0 ? value - 1 : 0));
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresIn, cooldown]);

  useEffect(() => {
    if (step === "otp") boxRefs.current[0]?.focus();
  }, [step]);

  function startCountdowns(data) {
    setExpiresIn(data.expires_in ?? 120);
    setCooldown(data.resend_after ?? 30);
  }

  async function sendCode(isResend) {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const data = await authApi.forgotPassword(email.trim());
      startCountdowns(data);
      setDigits(Array(OTP_LENGTH).fill(""));
      setDevOtp(data.dev_otp || "");
      setInfo(isResend ? "A new code is on its way." : data.message);
      setStep("otp");
    } catch (err) {
      // A cooldown rejection still tells us how long to wait.
      if (err.status === 429) setCooldown(Number(err.body?.retry_after) || cooldown || 30);
      setError(err.message || "Couldn't send the code");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    await sendCode(false);
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits`);
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const data = await authApi.verifyOtp(email.trim(), otp);
      setResetToken(data.reset_token);
      setStep("password");
      setExpiresIn(0);
      setInfo(data.message);
    } catch (err) {
      // The server marks a burnt code as expired — surface it as one so the
      // resend button is the obvious next move.
      if (err.body?.expired) setExpiresIn(0);
      setError(err.message || "That code didn't work");
      setDigits(Array(OTP_LENGTH).fill(""));
      boxRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, password);
      setStep("done");
    } catch (err) {
      setError(err.message || "Couldn't reset the password");
    } finally {
      setLoading(false);
    }
  }

  function setDigit(index, value) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    // Pasting the whole code into any box fills the rest of the row.
    setDigits((prev) => {
      const next = [...prev];
      clean.split("").forEach((char, offset) => {
        if (index + offset < OTP_LENGTH) next[index + offset] = char;
      });
      return next;
    });
    const landing = Math.min(index + clean.length, OTP_LENGTH - 1);
    boxRefs.current[landing]?.focus();
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) boxRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) boxRefs.current[index + 1]?.focus();
  }

  return (
    <AuthLayout
      headline="Getting back in takes two minutes."
      sub="We email a six-digit code, it lasts two minutes, and your trips are exactly where you left them."
    >
          {step === "email" && (
            <>
              <h1 className="font-display text-2xl text-paper mb-1">Forgot your password?</h1>
              <p className="text-sm text-paper/50 mb-6">
                Type the email on your account and we'll send a 6-digit code.
              </p>
            </>
          )}
          {step === "otp" && (
            <>
              <h1 className="font-display text-2xl text-paper mb-1">Enter the code</h1>
              <p className="text-sm text-paper/50 mb-6">
                We sent a 6-digit code to <span className="text-paper/80">{email}</span>.
              </p>
            </>
          )}
          {step === "password" && (
            <>
              <h1 className="font-display text-2xl text-paper mb-1">Choose a new password</h1>
              <p className="text-sm text-paper/50 mb-6">Pick something you haven't used here before.</p>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset text-sm rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && !error && step !== "done" && (
            <div className="flex items-start gap-2 bg-teal/10 border border-teal/30 text-teal text-sm rounded-lg px-3 py-2.5 mb-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}
          {devOtp && step === "otp" && (
            <p className="text-sm text-paper/40 mb-4">
              Development code: <span className="font-mono text-paper/70 tracking-widest">{devOtp}</span>
            </p>
          )}

          {step === "email" && (
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-paper/60 mb-1.5 block">Email</span>
                <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                  <Mail className="w-4 h-4 text-paper/30" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-fixed font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                {loading ? "Sending code…" : "Send code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form className="space-y-4" onSubmit={handleOtpSubmit}>
              <div className="flex justify-between gap-2">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { boxRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={OTP_LENGTH}
                    disabled={expired}
                    value={digit}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    className="w-11 py-3 bg-ink-900 border border-ink-700 rounded-lg text-center text-paper text-lg font-semibold focus:outline-none focus:border-teal disabled:opacity-40"
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <Timer className="w-3.5 h-3.5 text-paper/40" />
                {expired ? (
                  <span className="text-sunset">Code expired — send a new one.</span>
                ) : (
                  <span className="text-paper/50">Expires in {formatClock(expiresIn)}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || expired || otp.length !== OTP_LENGTH}
                className="w-full bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-fixed font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                {loading ? "Checking…" : "Verify code"}
              </button>

              <button
                type="button"
                onClick={() => sendCode(true)}
                disabled={loading || cooldown > 0}
                className="w-full border border-ink-700 text-paper/70 hover:text-paper hover:border-teal disabled:opacity-50 disabled:hover:border-ink-700 text-sm py-2.5 rounded-lg transition-colors"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </form>
          )}

          {step === "password" && (
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-paper/60 mb-1.5 block">New password</span>
                <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                  <Lock className="w-4 h-4 text-paper/30" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-paper/60 mb-1.5 block">Confirm password</span>
                <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                  <Lock className="w-4 h-4 text-paper/30" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-fixed font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                {loading ? "Saving…" : "Reset password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-teal mx-auto mb-3" strokeWidth={1.75} />
              <h1 className="font-display text-2xl text-paper mb-1">Password updated</h1>
              <p className="text-sm text-paper/50 mb-6">Log in with your new password to pick up where you left off.</p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full bg-sunset hover:bg-sunset-dark text-ink-fixed font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                Back to log in
              </button>
            </div>
          )}

          {step !== "done" && (
            <>
              <div className="my-6"><RouteLine className="w-full h-3" color="#1A4358" /></div>
              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-paper/50 hover:text-paper"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to log in
              </Link>
            </>
          )}
    </AuthLayout>
  );
}
