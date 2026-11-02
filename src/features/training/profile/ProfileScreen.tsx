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
  /** Controls of basic data, training types and health are shown only in edit mode; weight ignores it. */
  editMode: boolean;
  busy: boolean;
  /** Runs a save; shows "Zapisywanie…" and, on error, a retry. */
  run: (task: () => Promise<void>) => void;
  update: (change: (profile: Profile) => Profile) => void;
};

export function ProfileScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  const [editMode, setEditMode] = useState(false);
  /** Changes on every entry into edit mode, so the sections start with closed forms and empty fields. */
  const [editCount, setEditCount] = useState(0);

  function startEditing() {
    setEditCount((n) => n + 1);
    setEditMode(true);
  }

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
    load.status === "ready"
      ? { profile: load.profile, editMode, busy: action.status === "saving", run, update }
      : null;

  return (
    <div className="profile">
      <header className="profile-header">
        <Link to="/training" className="profile-back">
          ← Trening
        </Link>
        <div className="profile-title-row">
          <h1 className="profile-title">Profil</h1>
          {section &&
            (editMode ? (
              <button type="button" className="profile-button is-primary" onClick={() => setEditMode(false)}>
                Gotowe
              </button>
            ) : (
              <button type="button" className="profile-icon" aria-label="Edytuj profil" onClick={startEditing}>
                ✎
              </button>
            ))}
        </div>
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
          <BasicDataSection key={`basic-${editCount}`} {...section} />
          <WeightSection {...section} />
          <TrainingTypesSection key={`types-${editCount}`} {...section} />
          <HealthSection key={`health-${editCount}`} {...section} />
        </>
      )}
    </div>
  );
}
