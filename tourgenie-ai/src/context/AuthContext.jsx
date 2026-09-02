import { createContext, useContext, useEffect, useState } from "react";
import { authApi, SESSION_EXPIRED_EVENT } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tourgenie_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem("tourgenie_token"))
      .finally(() => setLoading(false));
  }, []);

  // The API client raises this the moment a request comes back 401 with a
  // token attached — the token has expired or been revoked. Dropping the
  // user here is what makes ProtectedRoute send them to the login screen
  // instead of leaving an error banner on the page they were reading.
  useEffect(() => {
    function onExpired() {
      localStorage.removeItem("tourgenie_current_trip");
      setUser(null);
      setLoading(false);
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  async function login(email, password) {
    const { token, user } = await authApi.login({ email, password });
    localStorage.setItem("tourgenie_token", token);
    setUser(user);
    return user;
  }

  async function register(name, email, password, language, country_code) {
    await authApi.register({ name, email, password, language, country_code });
    return login(email, password);
  }

  // The settings page saves one section at a time and the API answers with
  // the whole account — this keeps the sidebar, Plan Trip pre-fill and every
  // other reader in step without a second round trip.
  function applyUser(next) {
    setUser(next);
    return next;
  }

  function logout() {
    localStorage.removeItem("tourgenie_token");
    localStorage.removeItem("tourgenie_current_trip");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, applyUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
