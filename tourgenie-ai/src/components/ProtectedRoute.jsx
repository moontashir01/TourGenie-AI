import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink-900/50 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    // Where they were going, so logging in returns them there instead of
    // dropping everyone on the dashboard.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
