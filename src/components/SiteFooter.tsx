import { useLocale } from "../i18n";

export function SiteFooter() {
  const { t, locale } = useLocale();
  return (
    <footer className="site-footer" id="privacy" tabIndex={-1}>
      <div className="site-footer__inner">
        <div className="footer-brand">
          <a className="footer-mark" href={`/?lang=${locale}`} aria-label={t("Team Feedback")}>
            <img src="/assets/logo.svg" alt="" aria-hidden="true" />
          </a>
        </div>
        <div className="footer-columns">
          <div className="footer-contact-list">
            <p className="footer-title">{t("Feedback, with care.")}</p>
            <p className="footer-privacy"><span className="shell-icon" aria-hidden="true" />{t("Survey responses are anonymous to coordinators and teammates.")}</p>
            <a className="footer-contact-link" href="mailto:ino@mail.praiasertao.com.br">ino@mail.praiasertao.com.br</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
