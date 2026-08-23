import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { referenceApi } from "../lib/api";

// FR-17 — Multi-language Support. The string tables live in MongoDB (one
// document per language, seeded with 5 languages × ~200 keys); this context
// fetches the chosen language and exposes t("nav.dashboard", "Dashboard").
// English text is always passed as the fallback, so a missing key renders
// the English copy rather than a bare key name.
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("tourgenie_lang") || "en");
  const [languages, setLanguages] = useState([]);
  const [strings, setStrings] = useState({});

  useEffect(() => {
    referenceApi
      .languages()
      .then(({ languages }) => setLanguages(languages || []))
      .catch(() => setLanguages([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    referenceApi
      .translation(lang)
      .then((res) => {
        if (cancelled) return;
        setStrings(res.strings || {});
        document.documentElement.lang = res.lang || lang;
        document.documentElement.dir = res.direction === "rtl" ? "rtl" : "ltr";
      })
      .catch(() => {
        if (!cancelled) setStrings({});
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  function setLang(next) {
    localStorage.setItem("tourgenie_lang", next);
    setLangState(next);
  }

  const t = useCallback(
    (key, fallback) => {
      let node = strings;
      for (const part of key.split(".")) {
        node = node?.[part];
        if (node == null) return fallback ?? key;
      }
      return typeof node === "string" ? node : fallback ?? key;
    },
    [strings]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, languages, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
