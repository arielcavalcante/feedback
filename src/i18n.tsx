import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { normalizeLocale, translate, type Locale } from "../shared/localization";

const STORAGE_KEY = "feedback-locale";
export function initialLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "en" || requested === "pt-BR") return requested;
  try { return normalizeLocale(localStorage.getItem(STORAGE_KEY)); } catch { return "pt-BR"; }
}

const Context = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: "pt-BR", setLocale: () => undefined });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate("Team Feedback", locale);
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* The switch still works when storage is unavailable. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [locale]);
  return <Context.Provider value={{ locale, setLocale }}>{children}</Context.Provider>;
}

export function useLocale() {
  const { locale, setLocale } = useContext(Context);
  return { locale, setLocale, t: (message: string, values?: Record<string, string>) => translate(message, locale, values) };
}

