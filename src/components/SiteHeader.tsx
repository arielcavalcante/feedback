import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n";

// Adapted from ariel-portfolio-react: same header, mobile menu and locale control.
export function SiteHeader({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    if (!open) return () => document.body.classList.remove("menu-open");
    navigation.current?.querySelector<HTMLElement>("a, button")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
      if (event.key === "Tab") {
        const items = [...(navigation.current?.querySelectorAll<HTMLElement>("a, button") ?? []), button.current!];
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", keydown);
    const desktop = window.matchMedia("(min-width: 810px)");
    const resized = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", resized);
    return () => { document.body.classList.remove("menu-open"); window.removeEventListener("keydown", keydown); desktop.removeEventListener("change", resized); };
  }, [open]);
  return <header className={`site-header${open ? " is-menu-open" : ""}`}>
    <div className="site-header__inner">
      <a className="brand-mark" href={`/?lang=${locale}`} aria-label={t("Team Feedback")}>ino<span aria-hidden="true">.</span></a>
      <nav ref={navigation} id="primary-navigation" className={`desktop-nav${open ? " is-open" : ""}`} aria-label={t("Primary navigation")}>
        <a className="nav-primary-link is-active" href={`/?lang=${locale}`} aria-current="page" onClick={() => setOpen(false)}>{t("Home")}</a>
        <a className="nav-primary-link" href="#privacy" onClick={() => setOpen(false)}>{t("Privacy")}</a>
        {signedIn && <button className="nav-primary-link" type="button" onClick={() => { setOpen(false); onSignOut(); }}>{t("Sign out")}</button>}
        <button type="button" role="switch" aria-checked={locale === "pt-BR"} aria-label={t("Language: Portuguese")}
          className={`language-switch${locale === "pt-BR" ? " active" : ""}`} onClick={() => setLocale(locale === "pt-BR" ? "en" : "pt-BR")}>
          <span>{t("Portuguese")}</span><span className="language-switch__track" aria-hidden="true"><span className="language-switch__thumb" /></span>
        </button>
      </nav>
      <button ref={button} className="menu-button" type="button" aria-label={t(open ? "Close menu" : "Open menu")} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
        <span className={`menu-button__icon menu-button__icon--${open ? "close" : "open"}`} aria-hidden="true" />
      </button>
    </div>
  </header>;
}

