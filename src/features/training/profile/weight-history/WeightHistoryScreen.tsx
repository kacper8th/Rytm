import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dateLabel, deleteWeight, getProfile, number, type WeightMeasurement } from "../profile";
import { dayLabel, measurementsLabel, monthName, weightMonths } from "./weight-history";
import "../Profile.css";
import "./WeightHistory.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; weights: WeightMeasurement[] };

/** Deleting a measurement; on error the user can retry it. */
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/** "+0,3", "−0,8", "0". */
const change = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** All weight measurements by month (newest first); only the newest month is expanded at first. */
export function WeightHistoryScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  /** Months the user expanded or collapsed; the newest month is expanded unless collapsed. */
  const [toggled, setToggled] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getProfile().then(
      (profile) => !cancelled && setLoad({ status: "ready", weights: profile.weights }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function remove(date: string) {
    if (!window.confirm(`Usunąć pomiar wagi z ${dateLabel(date)}?`)) return;
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await deleteWeight(date);
        setLoad((prev) =>
          prev.status === "ready" ? { status: "ready", weights: prev.weights.filter((w) => w.date !== date) } : prev,
        );
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  function toggle(month: string) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (!next.delete(month)) next.add(month);
      return next;
    });
  }

  const months = load.status === "ready" ? weightMonths(load.weights) : [];
  const busy = action.status === "saving";

  return (
    <div className="profile">
      <header className="profile-header">
        <Link to="/training/profile" className="profile-back">
          ← Profil
        </Link>
        <h1 className="profile-title">Historia wagi</h1>
        {load.status === "ready" && load.weights.length > 0 && (
          <p className="profile-hint">Pomiary: {load.weights.length}</p>
        )}
      </header>

      {action.status === "saving" && <p className="profile-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="profile-status is-error" role="alert">
          <span>Nie udało się usunąć. {action.message}</span>
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
          <span>Nie udało się wczytać pomiarów. {load.message}</span>
          <button type="button" className="profile-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" && months.length === 0 && <p className="profile-empty">Brak pomiarów.</p>}

      {months.map((m, i) => {
        const expanded = (i === 0) !== toggled.has(m.month);
        return (
          <section key={m.month} className="weight-history-month">
            <button
              type="button"
              className="weight-history-month-header"
              aria-expanded={expanded}
              onClick={() => toggle(m.month)}
            >
              <span className="weight-history-month-name">{monthName(m.month)}</span>
              <span className="weight-history-month-meta">
                {measurementsLabel(m.measurements.length)} · śr. {number.format(m.averageKg)} kg
                {m.change !== null && ` · ${change.format(m.change)} kg`}
              </span>
              <span className="weight-history-chevron" aria-hidden="true">
                {expanded ? "▾" : "▸"}
              </span>
            </button>

            {expanded && (
              <ul className="profile-list">
                {m.measurements.map((w) => (
                  <li key={w.date} className="profile-row">
                    <span className="profile-row-main">{dayLabel(w.date)}</span>
                    <span>{number.format(w.weightKg)} kg</span>
                    <span className="weight-history-change">{w.change !== null && change.format(w.change)}</span>
                    <button
                      type="button"
                      className="profile-icon"
                      disabled={busy}
                      aria-label={`Usuń pomiar z ${dateLabel(w.date)}`}
                      onClick={() => remove(w.date)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
