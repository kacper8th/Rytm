import { Fragment, useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { dietBaseLoadCount, isDietBaseLoaded, loadDietBase, subscribeDietBase } from "./diet-base";
import "./DietBaseGate.css";

/**
 * Shows a Diet screen only when the Diet base is loaded: "Ładowanie…" first, an error with retry when the server
 * does not answer.
 */
export function DietBaseGate({ children }: { children: ReactNode }) {
  const loadCount = useSyncExternalStore(subscribeDietBase, dietBaseLoadCount);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isDietBaseLoaded()) return;
    let cancelled = false;
    setError(null);
    loadDietBase().catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // a new load (e.g. after an import) shows the screen anew, so nothing keeps data from before
  if (isDietBaseLoaded()) return <Fragment key={loadCount}>{children}</Fragment>;
  if (error) {
    return (
      <div className="diet-gate is-error" role="alert">
        <span>Nie udało się wczytać danych diety. {error}</span>
        <button type="button" className="diet-gate-button" onClick={() => setAttempt((n) => n + 1)}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }
  return <p className="diet-gate">Ładowanie…</p>;
}

/** A Diet screen shown inside DietBaseGate — used for the routes in src/app/modules.ts. */
export function withDietBase(Screen: ComponentType) {
  return function DietBaseScreen() {
    return (
      <DietBaseGate>
        <Screen />
      </DietBaseGate>
    );
  };
}
