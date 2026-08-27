import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TripProvider } from "./context/TripContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <TripProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </TripProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>
);
