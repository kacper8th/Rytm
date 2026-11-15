import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CounterForm } from "./CounterForm";
import { getHabits, updateHabit, type Habit } from "../habits";
import "../Habits.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; counter: Habit };

/** Edit form of one counter: name and the start date of the current run. */
export function EditCounterScreen() {
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
        const counter = habits.find((h) => h.id === id && h.kind === "counter");
        setLoad(counter ? { status: "ready", counter } : { status: "missing" });
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
          <Link to="/habits/counters" className="habits-back">
            ← Liczniki
          </Link>
          <h1 className="habits-title">Edycja licznika</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać licznika. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {load.status === "missing" && <p className="habits-empty">Nie znaleziono licznika - mógł zostać usunięty.</p>}

      {load.status === "ready" && (
        <>
          {load.counter.runCount > 1 && (
            <p className="habits-count">Zmiana startu przesuwa też koniec poprzedniej serii.</p>
          )}
          <CounterForm
            initial={load.counter}
            onSave={async (counter) => {
              await updateHabit(load.counter.id, counter);
              navigate("/habits/counters");
            }}
          />
        </>
      )}
    </div>
  );
}
