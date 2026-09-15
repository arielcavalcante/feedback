import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import type { CurrentUser } from "../api";
import { useLocale } from "../i18n";

export function SiteHeader({ user, onSignOut }: { user: CurrentUser | null; onSignOut: () => void }) {
  const { locale, t } = useLocale();
  const signedIn = Boolean(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pastTop, setPastTop] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

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
      if (event.key === "Escape" && !profileOpen) { setMenuOpen(false); menuButtonRef.current?.focus(); }
    }
    window.addEventListener("keydown", keydown);
    const desktop = window.matchMedia("(min-width: 810px)");
    const resized = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", resized);
    return () => { document.body.classList.remove("menu-open"); window.removeEventListener("keydown", keydown); desktop.removeEventListener("change", resized); };
  }, [menuOpen, profileOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    function closeProfile(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", closeProfile);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("pointerdown", closeProfile);
      window.removeEventListener("keydown", keydown);
    };
  }, [profileOpen]);

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

  const closeMenu = () => { setMenuOpen(false); setProfileOpen(false); };
  return (
    <header className={`site-header${menuOpen ? " is-menu-open" : ""}${pastTop ? " is-scrolled" : ""}`}>
      <div className="site-header__inner">
        <a className="brand-mark" href={`/?lang=${locale}`} aria-label={t("Team Feedback")} onClick={closeMenu}>
          <img src="/assets/logo.svg" alt="" aria-hidden="true" />
        </a>
        <nav ref={navigationRef} id="primary-navigation" className={`desktop-nav${menuOpen ? " is-open" : ""}`} aria-label={t("Primary navigation")} onMouseOver={moveMarkerFromMouse} onMouseLeave={restoreMarker} onFocusCapture={moveMarkerFromFocus}>
          <a className="nav-primary-link is-active" href={`/?lang=${locale}`} aria-current="page" data-nav-marker="below" data-nav-current onClick={closeMenu}>{t("Home")}</a>
          {signedIn && <a className="nav-primary-link" href="#active-feedback" data-nav-marker="below" onClick={closeMenu}>{t("Feedback")}</a>}
          {signedIn && <a className="nav-primary-link" href="#history" data-nav-marker="below" onClick={closeMenu}>{t("History")}</a>}
          <a className="nav-primary-link" href="#privacy" data-nav-marker="below" onClick={closeMenu}>{t("Privacy")}</a>
          {user && (
            <div className={`profile-area${profileOpen ? " is-open" : ""}`} ref={profileRef}>
              <button
                ref={profileButtonRef}
                className="profile-trigger"
                type="button"
                aria-label={t(profileOpen ? "Close profile menu" : "Open profile menu")}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
              >
                <span className="profile-avatar"><img src="/assets/icons/face.svg" alt="" aria-hidden="true" /></span>
                <span className="profile-trigger__label">{t("Profile")}</span>
              </button>
              {profileOpen && (
                <div className="profile-menu" role="menu" aria-label={t("Profile menu")}>
                  <div className="profile-menu__identity">
                    <strong>{user.displayName}</strong>
                    <span title={user.email}>{user.email}</span>
                  </div>
                  <button className="profile-menu__sign-out" type="button" role="menuitem" onClick={onSignOut}>{t("Sign out")}</button>
                </div>
              )}
            </div>
          )}
          <span ref={markerRef} className="desktop-nav__marker" aria-hidden="true" />
        </nav>
        <div className="header-actions">
          <button ref={menuButtonRef} className="menu-button" type="button" aria-label={t(menuOpen ? "Close menu" : "Open menu")} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => { setProfileOpen(false); setMenuOpen((open) => !open); }}>
            <span className={`menu-button__icon menu-button__icon--${menuOpen ? "close" : "open"}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
