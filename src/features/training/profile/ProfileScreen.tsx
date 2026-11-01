import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BasicDataSection } from "./BasicDataSection";
import { HealthSection } from "./HealthSection";
import { getProfile, type Profile } from "./profile";
import { TrainingTypesSection } from "./TrainingTypesSection";
import { WeightSection } from "./WeightSection";
import "./Profile.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; profile: Profile };

/** Saving a change; on error the user can retry the same action. */
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/** What every section gets: the profile, a way to save a change and to put the saved result into the profile. */
export type SectionProps = {
  profile: Profile;
  busy: boolean;
  /** Runs a save; shows "Zapisywanie…" and, on error, a retry. */
  run: (task: () => Promise<void>) => void;
  update: (change: (profile: Profile) => Profile) => void;
};

export function ProfileScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getProfile().then(
      (profile) => !cancelled && setLoad({ status: "ready", profile }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function run(task: () => Promise<void>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await task();
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  function update(change: (profile: Profile) => Profile) {
    setLoad((prev) => (prev.status === "ready" ? { status: "ready", profile: change(prev.profile) } : prev));
  }

  const section =
    load.status === "ready" ? { profile: load.profile, busy: action.status === "saving", run, update } : null;

  return (
    <div className="profile">
      <header className="profile-header">
        <Link to="/training" className="profile-back">
          ← Trening
        </Link>
        <h1 className="profile-title">Profil</h1>
      </header>

      {action.status === "saving" && <p className="profile-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="profile-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
          <button type="button" className="profile-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
          <button type="button" className="profile-button" onClick={() => setAction({ status: "idle" })}>
            Zamknij
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="profile-empty">Ładowanie…</p>}

      {load.status === "error" && (
        <div className="profile-status is-error" role="alert">
          <span>Nie udało się wczytać profilu. {load.message}</span>
          <button type="button" className="profile-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {section && (
        <>
          <BasicDataSection {...section} />
          <WeightSection {...section} />
          <TrainingTypesSection {...section} />
          <HealthSection {...section} />
        </>
      )}
    </div>
  );
}
