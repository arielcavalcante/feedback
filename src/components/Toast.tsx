import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n";

type Toast = { id: number; text: string; link?: { href: string; label: string } };
type ShowToast = (text: string, link?: Toast["link"]) => void;

const ToastContext = createContext<ShowToast>(() => undefined);
const VISIBLE_MS = 6_000;
const VISIBLE_WITH_LINK_MS = 15_000;

/** One status toast at a time: fixed at the top on desktop and at the bottom on mobile. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);

  const show = useCallback<ShowToast>((text, link) => {
    counter.current += 1;
    setPaused(false);
    setToast({ id: counter.current, text, link });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), toast.link ? VISIBLE_WITH_LINK_MS : VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastRegion toast={toast} onClose={() => setToast(null)} onPause={setPaused} />
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

function ToastRegion({ toast, onClose, onPause }: { toast: Toast | null; onClose: () => void; onPause: (paused: boolean) => void }) {
  const { t } = useLocale();
  // The live region stays mounted so screen readers announce each new message.
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div
          className="toast"
          key={toast.id}
          onMouseEnter={() => onPause(true)}
          onMouseLeave={() => onPause(false)}
          onFocus={() => onPause(true)}
          onBlur={() => onPause(false)}
        >
          <span className="toast__mark shell-icon" aria-hidden="true" />
          <p className="toast__text">
            {toast.text}
            {toast.link && <> <a href={toast.link.href}>{toast.link.label}</a></>}
          </p>
          <button className="toast__close" type="button" aria-label={t("Close")} onClick={onClose}>
            <span aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
