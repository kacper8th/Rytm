import { useEffect, useState } from "react";
import { cachedPlanNames, getPlanNames, type PlanNames } from "./meal-plans";

export type PlanNamesState = {
  /** null while loading or after an error — planName() then gives the default names. */
  names: PlanNames | null;
  error: string | null;
  reload: () => void;
  /** Puts names returned by renamePlan() into the state. */
  setNames: (names: PlanNames) => void;
};

/** Meal plan names for a screen; loaded once per app session, then taken from the cache. */
export function usePlanNames(): PlanNamesState {
  const [names, setNames] = useState<PlanNames | null>(cachedPlanNames);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (cachedPlanNames() && reloadCount === 0) return;
    let cancelled = false;
    setError(null);
    getPlanNames().then(
      (loaded) => !cancelled && setNames(loaded),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  return { names, error, reload: () => setReloadCount((n) => n + 1), setNames };
}
