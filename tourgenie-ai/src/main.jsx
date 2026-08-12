import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TripProvider } from "./context/TripContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <TripProvider>
        <App />
      </TripProvider>
    </AuthProvider>
  </StrictMode>
);
