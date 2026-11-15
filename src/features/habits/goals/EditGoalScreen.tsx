import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { HabitForm } from "../HabitForm";
import { getHabits, updateHabit, type Habit } from "../habits";
import "../Habits.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; goal: Habit };

/** Edit form of one goal; entries are kept and judged by the new target. */
export function EditGoalScreen() {
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
        const goal = habits.find((h) => h.id === id && h.kind === "goal");
        setLoad(goal ? { status: "ready", goal } : { status: "missing" });
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
          <Link to="/habits/goals/list" className="habits-back">
            ← Lista celów
          </Link>
          <h1 className="habits-title">Edycja celu</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać celu. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {load.status === "missing" && <p className="habits-empty">Nie znaleziono celu - mógł zostać usunięty.</p>}

      {load.status === "ready" && (
        <>
          <p className="habits-count">Wpisy zostają. Nowy cel obowiązuje też dla wcześniejszych dni.</p>
          <HabitForm
            kind="goal"
            initial={load.goal}
            onSave={async (goal) => {
              await updateHabit(load.goal.id, goal);
              navigate("/habits/goals/list");
            }}
          />
        </>
      )}
    </div>
  );
}
