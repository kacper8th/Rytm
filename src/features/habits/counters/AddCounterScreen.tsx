import { Link, useNavigate } from "react-router";
import { CounterForm } from "./CounterForm";
import { addHabit } from "../habits";
import "../Habits.css";

export function AddCounterScreen() {
  const navigate = useNavigate();

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits/counters" className="habits-back">
            ← Liczniki
          </Link>
          <h1 className="habits-title">Nowy licznik</h1>
        </div>
      </header>

      <p className="habits-count">Data startu może być wcześniejsza (seria już trwa) albo późniejsza (np. od jutra).</p>
      <CounterForm
        onSave={async (counter) => {
          await addHabit(counter);
          navigate("/habits/counters");
        }}
      />
    </div>
  );
}
