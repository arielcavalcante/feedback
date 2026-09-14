import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { useLocale } from "../i18n";

export function SiteHeader({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pastTop, setPastTop] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateLogo = () => setPastTop(window.scrollY > 1);
    updateLogo();
    window.addEventListener("scroll", updateLogo, { passive: true });
    return () => window.removeEventListener("scroll", updateLogo);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    if (!menuOpen) return () => document.body.classList.remove("menu-open");
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); }
    }
    window.addEventListener("keydown", keydown);
    const desktop = window.matchMedia("(min-width: 810px)");
    const resized = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", resized);
    return () => { document.body.classList.remove("menu-open"); window.removeEventListener("keydown", keydown); desktop.removeEventListener("change", resized); };
  }, [menuOpen]);

  function moveMarker(target: HTMLElement | null) {
    const navigation = navigationRef.current;
    const marker = markerRef.current;
    if (!navigation || !marker || !target) { marker?.classList.remove("is-ready"); return; }
    const navRect = navigation.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const placement = target.dataset.navMarker || "below";
    marker.style.left = placement === "left" ? `${targetRect.left - navRect.left - 13}px` : `${targetRect.left - navRect.left + targetRect.width / 2}px`;
    marker.style.top = placement === "left" ? `${targetRect.top - navRect.top + targetRect.height / 2}px` : `${targetRect.bottom - navRect.top + 7}px`;
    marker.dataset.placement = placement;
    marker.classList.add("is-ready");
  }

  function restoreMarker() { moveMarker(navigationRef.current?.querySelector<HTMLElement>("[data-nav-current]") ?? null); }
  function moveMarkerFromMouse(event: MouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-nav-marker]") : null;
    if (target) moveMarker(target);
  }
  function moveMarkerFromFocus(event: FocusEvent<HTMLElement>) { moveMarker(event.target.closest<HTMLElement>("[data-nav-marker]")); }

  useEffect(() => {
    const frame = requestAnimationFrame(restoreMarker);
    window.addEventListener("resize", restoreMarker);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", restoreMarker); };
  }, [locale, signedIn]);

  const closeMenu = () => setMenuOpen(false);
  return (
    <header className={`site-header${menuOpen ? " is-menu-open" : ""}${pastTop ? " is-scrolled" : ""}`}>
      <div className="site-header__inner">
        <a className={`brand-mark${pastTop ? " is-scrolled" : ""}`} href={`/?lang=${locale}`} aria-label={t("Team Feedback")} onClick={closeMenu}>
          <img src="/assets/logo.svg" alt="" aria-hidden="true" />
        </a>
        <nav ref={navigationRef} id="primary-navigation" className={`desktop-nav${menuOpen ? " is-open" : ""}`} aria-label={t("Primary navigation")} onMouseOver={moveMarkerFromMouse} onMouseLeave={restoreMarker} onFocusCapture={moveMarkerFromFocus}>
          <a className="nav-primary-link is-active" href={`/?lang=${locale}`} aria-current="page" data-nav-marker="below" data-nav-current onClick={closeMenu}>{t("Home")}</a>
          {signedIn && <a className="nav-primary-link" href="#active-feedback" data-nav-marker="below" onClick={closeMenu}>{t("Feedback")}</a>}
          {signedIn && <a className="nav-primary-link" href="#history" data-nav-marker="below" onClick={closeMenu}>{t("History")}</a>}
          <a className="nav-primary-link" href="#privacy" data-nav-marker="below" onClick={closeMenu}>{t("Privacy")}</a>
          {signedIn && <button className="nav-primary-link nav-action" type="button" data-nav-marker="below" onClick={() => { closeMenu(); onSignOut(); }}>{t("Sign out")}</button>}
          <span ref={markerRef} className="desktop-nav__marker" aria-hidden="true" />
        </nav>
        <button ref={menuButtonRef} className="menu-button" type="button" aria-label={t(menuOpen ? "Close menu" : "Open menu")} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
          <span className={`menu-button__icon menu-button__icon--${menuOpen ? "close" : "open"}`} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
