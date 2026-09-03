import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { TripProvider } from "./context/TripContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        {/* Inside AuthProvider: the theme is saved to the account, so it
            needs to know who is logged in. */}
        <ThemeProvider>
          <TripProvider>
            <CurrencyProvider>
              <ChatProvider>
                <App />
              </ChatProvider>
            </CurrencyProvider>
          </TripProvider>
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>
);
