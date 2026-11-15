import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { HabitForm } from "../HabitForm";
import { getHabits, updateHabit, type Habit } from "../habits";
import "../Habits.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; limit: Habit };

/** Edit form of one limit; entries are kept and judged by the new limit. */
export function EditLimitScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getHabits().then(
      (habits) => {
        if (cancelled) return;
        const limit = habits.find((h) => h.id === id && h.kind === "limit");
        setLoad(limit ? { status: "ready", limit } : { status: "missing" });
      },
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, reloadCount]);

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits/limits/list" className="habits-back">
            ← Lista limitów
          </Link>
          <h1 className="habits-title">Edycja limitu</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać limitu. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {load.status === "missing" && <p className="habits-empty">Nie znaleziono limitu - mógł zostać usunięty.</p>}

      {load.status === "ready" && (
        <>
          <p className="habits-count">Wpisy zostają. Nowy limit obowiązuje też dla wcześniejszych okresów.</p>
          <HabitForm
            kind="limit"
            initial={load.limit}
            onSave={async (limit) => {
              await updateHabit(load.limit.id, limit);
              navigate("/habits/limits/list");
            }}
          />
        </>
      )}
    </div>
  );
}
