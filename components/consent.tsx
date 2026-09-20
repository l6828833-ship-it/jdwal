"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { NavLink } from "@/components/nav-link";

type ConsentChoice = "accepted" | "rejected" | "unset" | "unknown";

interface ConsentContextValue {
  choice: ConsentChoice;
  setChoice: (choice: "accepted" | "rejected") => void;
  openSettings: () => void;
}

const STORAGE_KEY = "jdwal-privacy-choice-v1";
const listeners = new Set<() => void>();
let memoryChoice: ConsentChoice | null = null;

function readChoice(): ConsentChoice {
  if (memoryChoice) return memoryChoice;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    memoryChoice = stored === "accepted" || stored === "rejected" ? stored : "unset";
  } catch {
    memoryChoice = "unset";
  }
  return memoryChoice;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeChoice(choice: "accepted" | "rejected" | "unset") {
  memoryChoice = choice;
  try {
    if (choice === "unset") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Privacy choice still applies in memory when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

const ConsentContext = createContext<ConsentContextValue | null>(null);
const serverConsentSnapshot = (): ConsentChoice => "unknown";

/**
 * One consent state shared by Analytics and future AdSense integration.
 * Third-party measurement/advertising scripts do not load before acceptance.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(
    subscribe,
    readChoice,
    serverConsentSnapshot,
  );
  const setChoice = useCallback((value: "accepted" | "rejected") => {
    writeChoice(value);
  }, []);
  const openSettings = useCallback(() => writeChoice("unset"), []);
  const value = useMemo(
    () => ({ choice, setChoice, openSettings }),
    [choice, setChoice, openSettings],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      <ConsentBanner />
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("useConsent must be used inside ConsentProvider");
  return value;
}

function ConsentBanner() {
  const { choice, setChoice } = useConsent();
  if (choice !== "unset") return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-consent-title"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-xl rounded-xl border border-border bg-surface-raised p-4 shadow-2xl sm:p-5"
    >
      <h2 id="privacy-consent-title" className="text-sm font-bold text-foreground">
        خيارات الخصوصية
      </h2>
      <p className="mt-2 text-xs leading-6 text-muted">
        يستخدم جدول التخزين المحلي لحفظ اختيارك. لا نحمّل Google Analytics أو
        خدمات الإعلانات المستقبلية إلا بعد موافقتك. يمكنك الرفض والاستمرار في
        استخدام جميع وظائف الموقع.
      </p>
      <p className="mt-1 text-[0.7rem] leading-5 text-muted-dim">
        اقرأ <NavLink href="/privacy" className="text-accent hover:underline">سياسة الخصوصية</NavLink>
        {" "}و<NavLink href="/cookies" className="text-accent hover:underline">سياسة ملفات الارتباط</NavLink>.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setChoice("accepted")}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white"
        >
          موافق
        </button>
        <button
          type="button"
          onClick={() => setChoice("rejected")}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
        >
          رفض غير الضروري
        </button>
      </div>
    </aside>
  );
}

export function ConsentSettingsButton() {
  const { openSettings } = useConsent();
  return (
    <button
      type="button"
      onClick={openSettings}
      className="w-fit text-[0.7rem] text-muted transition-colors hover:text-accent"
    >
      إدارة خيارات الخصوصية
    </button>
  );
}
